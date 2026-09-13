import Clutter from 'gi://Clutter';
import Cogl from 'gi://Cogl';
import GdkPixbuf from 'gi://GdkPixbuf';
import GLib from 'gi://GLib';
import St from 'gi://St';
import Meta from 'gi://Meta';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import {PetEngine} from './engine.js';
import {getPose} from './sprite.js';
import {planPocket} from './push.js';
import {ActivityMonitor} from './activity.js';

export default class PanelPet extends Extension {
    enable() {
        this._pet = new PetEngine();
        this._typingUntil = 0;
        this._nextSpeech = 12;
        this._speechUntil = 0;
        this._chatEnabled = true;
        this._activity = new ActivityMonitor(this.path, () => this._noteTyping(), !Meta.is_wayland_compositor());
        this._keySignal = global.stage.connect('captured-event', (_stage,event) => {
            if (event.type() === Clutter.EventType.KEY_PRESS) this._noteTyping();
            return Clutter.EVENT_PROPAGATE;
        });
        this._shifted = [];
        this._push = null;
        this._pushCooldown = 0;
        this._indicator = new PanelMenu.Button(0.5, '顶栏小伙伴');
        this._indicator.add_child(new St.Icon({icon_name: 'face-smile-symbolic', style_class: 'system-status-icon'}));
        this._status = new PopupMenu.PopupMenuItem('小伙伴正在散步', {reactive: false});
        this._indicator.menu.addMenuItem(this._status);
        const action = (label, fn) => {
            const item = new PopupMenu.PopupMenuItem(label);
            item.connect('activate', () => { this._restoreIcons(true); this._syncPanel(); fn(); });
            this._indicator.menu.addMenuItem(item);
        };
        action('摸摸它 ♡', () => this._pet.pet());
        action('喂一根胡萝卜', () => this._pet.feed());
        action('一起追逐', () => this._pet.play());
        action('捉迷藏', () => this._pet.hide());
        const squeeze = new PopupMenu.PopupSwitchMenuItem('图标给卡皮让让路', true);
        this._squeezeEnabled = true;
        squeeze.connect('toggled', (_item, value) => { this._squeezeEnabled = value; this._restoreIcons(); });
        this._indicator.menu.addMenuItem(squeeze);
        const chat = new PopupMenu.PopupSwitchMenuItem('卡皮悄悄话', true);
        chat.connect('toggled', (_item,value) => { this._chatEnabled=value; if(!value)this._bubble.hide(); });
        this._indicator.menu.addMenuItem(chat);
        const pause = new PopupMenu.PopupSwitchMenuItem('休息一下', false);
        pause.connect('toggled', (_item, value) => { this._pet.paused = value; });
        this._indicator.menu.addMenuItem(pause);
        Main.panel.addToStatusArea(this.uuid, this._indicator);
        this._indicator.menu.connect('open-state-changed', (_menu, open) => {
            if (open) this._status.label.text = `${this._pet.message} · 饱食 ${Math.round(this._pet.hunger)} · 心情 ${Math.round(this._pet.joy)}`;
        });
        this._layer = new St.Widget({layout_manager: new Clutter.FixedLayout(), reactive: false, clip_to_allocation: true});
        this._textures = [];
        const atlas = GdkPixbuf.Pixbuf.new_from_file(`${this.path}/assets/capybara-atlas.png`);
        for (let i = 0; i < 8; i++) {
            const col = i % 4, row = Math.floor(i / 4);
            const x = Math.floor(col * atlas.width / 4), y = Math.floor(row * atlas.height / 2);
            const width = Math.floor((col + 1) * atlas.width / 4) - x;
            const height = Math.floor((row + 1) * atlas.height / 2) - y;
            // Crop transparent atlas margins at load time; preserve the source asset.
            const frame = atlas.new_subpixbuf(x + Math.floor(width * 0.02), y + Math.floor(height * 0.035),
                Math.floor(width * 0.975), Math.floor(height * 0.845)).scale_simple(256, 224, GdkPixbuf.InterpType.BILINEAR);
            const texture = new Clutter.Image();
            texture.set_data(frame.get_pixels(), frame.has_alpha ? Cogl.PixelFormat.RGBA_8888 : Cogl.PixelFormat.RGB_888,
                frame.width, frame.height, frame.rowstride);
            this._textures.push(texture);
        }
        // Keep the input target untransformed; only mirror the visual child.
        this._sprite = new St.Widget({reactive: true, layout_manager: new Clutter.FixedLayout(),
            accessible_name: '卡皮巴拉，左键摸摸，右键菜单'});
        this._art = new Clutter.Actor({reactive: false, content: this._textures[0],
            content_gravity: Clutter.ContentGravity.RESIZE_FILL});
        this._art.set_pivot_point(0.5, 0.5);
        this._sprite.add_child(this._art);
        // Vector headphones stay crisp at fractional scales and follow the capy's pose.
        this._headphones = new St.DrawingArea({reactive:false});
        this._headphones.connect('repaint', area => {
            const cr=area.get_context(); const [w,h]=area.get_surface_size();
            cr.scale(w,h);
            cr.setSourceRGBA(0.22,0.17,0.31,1); cr.setLineWidth(0.055);
            cr.arc(0.72,0.37,0.17,Math.PI,Math.PI*2); cr.stroke();
            for(const x of [0.535,0.825]) {
                cr.setSourceRGBA(0.43,0.32,0.61,1); cr.rectangle(x,0.30,0.075,0.21); cr.fill();
                cr.setSourceRGBA(0.83,0.74,0.96,1); cr.rectangle(x+0.015,0.335,0.025,0.12); cr.fill();
            }
            cr.$dispose();
        });
        this._headphones.set_pivot_point(0.5,0.5);
        this._sprite.add_child(this._headphones);
        this._bubble = new St.Label({reactive:false, visible:false,
            style:'background-color: rgba(48, 36, 28, 0.94); color: #fff5df; border: 1px solid #bca58b; border-radius: 14px; padding: 9px 14px; font-size: 14px;'});
        Main.layoutManager.addChrome(this._bubble, {affectsInputRegion:false,trackFullscreen:true});
        this._frame = 0;
        this._sprite.connect('button-press-event', (_actor, event) => {
            if (event.get_button() === 1) { this._restoreIcons(true); this._pet.pet(); }
            else if (event.get_button() === 3) this._indicator.menu.toggle();
            return Clutter.EVENT_STOP;
        });
        this._layer.add_child(this._sprite);
        Main.layoutManager.addChrome(this._layer, {affectsInputRegion: true, trackFullscreen: true});
        this._geometryElapsed = 1;
        this._lastTime = GLib.get_monotonic_time();
        this._source = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 33, () => {
            const now = GLib.get_monotonic_time();
            const dt = Math.min(0.08, (now - this._lastTime) / 1e6);
            this._lastTime = now;
            this._geometryElapsed += dt;
            if (this._geometryElapsed >= 0.3) { this._geometryElapsed = 0; this._syncPanel(); }
            const moving = this._layer.visible && !this._indicator.menu.isOpen && !this._pet.paused;
            if (moving) {
                this._pushCooldown = Math.max(0, this._pushCooldown - dt);
                if (this._push?.phase === 'opening') {
                    this._push.elapsed += dt;
                    if (this._push.elapsed >= 0.48) {
                        this._syncPanel();
                        this._pet.portal(this._push.target);
                        this._push.phase = 'visiting';
                    }
                } else {
                    const previous = this._pet.state;
                    const previousDirection = this._pet.direction;
                    this._pet.tick(dt);
                    if (this._squeezeEnabled && !this._push && this._pushCooldown === 0 &&
                        ['walk','run'].includes(previous) && (this._pet.state === 'sink' || this._pet.direction !== previousDirection)) {
                        const afterDirection = this._pet.direction;
                        this._pet.direction = previousDirection;
                        if (!this._tryPush()) this._pet.direction = afterDirection;
                    }
                    if (this._push?.phase === 'visiting' && this._pet.state === 'walk') {
                        this._push.phase = 'resting';
                        this._pet.act('idle', 1.4, '借过一下，挤进来啦');
                    } else if (this._push?.phase === 'resting' && ['walk','run'].includes(this._pet.state)) {
                        this._push.phase = 'leaving';
                        this._pet.portal(this._push.exit);
                    } else if (this._push?.phase === 'leaving' && this._pet.state === 'hidden') {
                        this._restoreIcons();
                    }
                }
            }
            const dancing = this._activity.playing && ['walk','idle','run'].includes(this._pet.state) && moving && !this._push;
            const pose = getPose(this._pet);
            if (dancing) { pose.frame = Math.sin(this._pet.time*9)>0 ? 1 : 2; pose.bob=-Math.abs(Math.sin(this._pet.time*9))*this._bodyHeight*0.10; }
            this._art.rotation_angle_z = dancing ? Math.sin(this._pet.time*9)*8 : 0;
            this._headphones.visible = this._activity.playing;
            this._headphones.set_scale(this._pet.direction,1);
            this._headphones.rotation_angle_z=this._art.rotation_angle_z;
            this._headphones.translation_y=pose.bob;
            this._updateSpeech(moving);
            if (pose.frame !== this._frame) { this._art.content = this._textures[pose.frame]; this._frame = pose.frame; }
            this._art.set_scale(this._pet.direction, 1);
            this._art.translation_y = pose.bob;
            this._sprite.set_position(this._pet.x, this._layer.height - this._bodyHeight + this._pet.offset);
            this._sprite.visible = this._pet.spans.length > 0 && this._pet.state !== 'hidden';
            return GLib.SOURCE_CONTINUE;
        });
        this._syncPanel();
    }
    _noteTyping() { this._typingUntil = GLib.get_monotonic_time()/1e6 + 8; }
    _updateSpeech(moving) {
        const now = this._pet.time;
        if (!moving || !this._chatEnabled || this._pet.seek || ['sink','hidden','rise'].includes(this._pet.state)) {
            this._bubble.hide(); return;
        }
        if (now >= this._nextSpeech) {
            const typing = GLib.get_monotonic_time()/1e6 < this._typingUntil;
            const lines = this._activity.playing
                ? ['这首歌好好听，陪你摇一摇 ♪','耳机戴好，烦恼跑掉～','你的专属伴舞上线啦！']
                : typing ? ['哒哒哒，辛苦啦！卡皮陪着你。','慢慢写，你已经很努力啦。','专注的主人，记得放松肩膀哦～']
                : ['喝口水，再继续吧～','今天也有卡皮陪着你。','不用着急，一点一点来就好。'];
            let text=lines[Math.floor(Math.random()*lines.length)];
            if(text===this._lastSpeech)text=lines[(lines.indexOf(text)+1)%lines.length];
            this._lastSpeech=text; this._bubble.text=text;
            this._speechUntil=now+5;
            this._nextSpeech=now+40+Math.random()*40;
        }
        this._bubble.visible=now<this._speechUntil;
        if(this._bubble.visible) {
            const [,width]=this._bubble.get_preferred_width(-1);
            const [,height]=this._bubble.get_preferred_height(width);
            this._bubble.set_size(width,height);
            const monitor=Main.layoutManager.primaryMonitor;
            this._bubble.set_position(Math.max(monitor.x+6,Math.min(monitor.x+monitor.width-width-6,
                this._layer.x+this._pet.x+this._pet.size/2-width/2)), this._layer.y+this._layer.height+6);
        }
    }
    _syncPanel() {
        const panel = Main.panel;
        const [px, py] = panel.get_transformed_position();
        const [width, height] = panel.get_transformed_size();
        const monitor = Main.layoutManager.primaryMonitor;
        const visible = panel.is_mapped() && width > 0 && height > 0 && !Main.overview.visible && !monitor?.inFullscreen;
        this._layer.visible = visible;
        if (!visible) { this._bubble.hide(); this._restoreIcons(); return; }
        this._layer.set_position(px, py); this._layer.set_size(width, height);
        // Panel coordinates already include Mutter's UI scale. Do not multiply
        // the user's fractional monitor scale a second time, or cap at 32 px.
        this._bodyHeight = Math.max(12, Math.round(height));
        const size = Math.round(this._bodyHeight * 1.18);
        this._sprite.set_size(size, this._bodyHeight);
        this._art.set_size(size, this._bodyHeight);
        this._headphones.set_size(size,this._bodyHeight);
        const obstacles = [];
        const controls = [];
        // Top-level panel controls include labels and their click targets, not only icon pixels.
        for (const box of [panel._leftBox, panel._centerBox, panel._rightBox]) {
            if (!box) continue;
            for (const actor of box.get_children()) {
                if (!actor.is_mapped()) continue;
                const [ax] = actor.get_transformed_position();
                const [aw] = actor.get_transformed_size();
                if (aw > 0) {
                    obstacles.push([ax - px, ax - px + aw]);
                    controls.push({actor, range: [ax - px, ax - px + aw]});
                }
            }
        }
        this._controls = controls.sort((a,b)=>a.range[0]-b.range[0]);
        if (this._push?.phase !== 'opening') this._pet.layout(width, obstacles, size);
    }
    _tryPush() {
        const plan = planPocket(this._layer.width, this._controls.map(c=>c.range),
            this._pet.size, this._pet.x, this._pet.direction);
        if (!plan) return false;
        const origin = this._pet.x;
        const previousTarget = this._pet.target;
        this._pet.target = undefined;
        this._pet.act('idle', 2, '借过一下，让我挤挤');
        this._pet.x = origin;
        this._push = {phase:'opening', elapsed:0, target:plan.target,
            exit:previousTarget ?? origin};
        for (let i=0;i<this._controls.length;i++) {
            if (Math.abs(plan.shifts[i])<0.1) continue;
            const actor=this._controls[i].actor;
            const entry={actor,original:actor.translation_x};
            entry.destroyId=actor.connect('destroy',()=>{entry.actor=null;});
            this._shifted.push(entry);
            actor.ease({translation_x:entry.original+plan.shifts[i],duration:420,mode:Clutter.AnimationMode.EASE_OUT_CUBIC});
        }
        return true;
    }
    _restoreIcons(immediate = false) {
        for (const entry of this._shifted ?? []) {
            if (!entry.actor) continue;
            entry.actor.disconnect(entry.destroyId);
            entry.actor.remove_transition('translation-x');
            if (immediate) entry.actor.translation_x=entry.original;
            else entry.actor.ease({translation_x:entry.original,duration:360,mode:Clutter.AnimationMode.EASE_OUT_CUBIC});
        }
        this._shifted=[]; this._push=null; this._pushCooldown=8;
    }
    disable() {
        this._restoreIcons(true);
        if(this._keySignal)global.stage.disconnect(this._keySignal);
        this._keySignal=0;
        this._activity?.destroy();this._activity=null;
        if(this._bubble){Main.layoutManager.removeChrome(this._bubble);this._bubble.destroy();this._bubble=null;}
        if (this._source) { GLib.Source.remove(this._source); this._source = null; }
        if (this._layer) { Main.layoutManager.removeChrome(this._layer); this._layer.destroy(); this._layer = null; }
        this._sprite = null;
        this._art = null;
        this._textures = null;
        this._indicator?.destroy(); this._indicator = null;
        this._pet = null; this._status = null;
    }
}
