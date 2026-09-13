import Clutter from 'gi://Clutter';
import Cogl from 'gi://Cogl';
import GdkPixbuf from 'gi://GdkPixbuf';
import GLib from 'gi://GLib';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import {PetEngine} from './engine.js';
import {getPose} from './sprite.js';
import {planPocket} from './push.js';

export default class PanelPet extends Extension {
    enable() {
        this._pet = new PetEngine();
        this._shifted = [];
        this._push = null;
        this._pushCooldown = 0;
        this._indicator = new PanelMenu.Button(0.5, '顶栏小伙伴');
        this._indicator.add_child(new St.Icon({icon_name: 'face-smile-symbolic', style_class: 'system-status-icon'}));
        this._status = new PopupMenu.PopupMenuItem('小伙伴正在散步', {reactive: false});
        this._indicator.menu.addMenuItem(this._status);
        const action = (label, fn) => {
            const item = new PopupMenu.PopupMenuItem(label);
            item.connect('activate', fn);
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
        this._frame = 0;
        this._sprite.connect('button-press-event', (_actor, event) => {
            if (event.get_button() === 1) this._pet.pet();
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
            const pose = getPose(this._pet);
            if (pose.frame !== this._frame) { this._art.content = this._textures[pose.frame]; this._frame = pose.frame; }
            this._art.set_scale(this._pet.direction, 1);
            this._art.translation_y = pose.bob;
            this._sprite.set_position(this._pet.x, this._layer.height - this._bodyHeight + this._pet.offset);
            this._sprite.visible = this._pet.spans.length > 0 && this._pet.state !== 'hidden';
            return GLib.SOURCE_CONTINUE;
        });
        this._syncPanel();
    }
    _syncPanel() {
        const panel = Main.panel;
        const [px, py] = panel.get_transformed_position();
        const [width, height] = panel.get_transformed_size();
        const monitor = Main.layoutManager.primaryMonitor;
        const visible = panel.is_mapped() && width > 0 && height > 0 && !Main.overview.visible && !monitor?.inFullscreen;
        this._layer.visible = visible;
        if (!visible) { this._restoreIcons(); return; }
        this._layer.set_position(px, py); this._layer.set_size(width, height);
        // Panel coordinates already include Mutter's UI scale. Do not multiply
        // the user's fractional monitor scale a second time, or cap at 32 px.
        this._bodyHeight = Math.max(12, Math.round(height));
        const size = Math.round(this._bodyHeight * 1.18);
        this._sprite.set_size(size, this._bodyHeight);
        this._art.set_size(size, this._bodyHeight);
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
        if (this._source) { GLib.Source.remove(this._source); this._source = null; }
        if (this._layer) { Main.layoutManager.removeChrome(this._layer); this._layer.destroy(); this._layer = null; }
        this._sprite = null;
        this._art = null;
        this._textures = null;
        this._indicator?.destroy(); this._indicator = null;
        this._pet = null; this._status = null;
    }
}
