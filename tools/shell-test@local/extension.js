// Test-only extension; copied only into a disposable GNOME session by shell-test.sh.
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Shell from 'gi://Shell';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
export default class IntegrationTest extends Extension {
    enable() {
        this._sources = new Set(); this.results = [];
        this.delay(5500).then(() => this.run()).catch(e => this.finish(e));
    }
    delay(ms) {
        return new Promise(resolve => {
            const id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
                this._sources.delete(id); resolve(); return GLib.SOURCE_REMOVE;
            }); this._sources.add(id);
        });
    }
    async until(fn, label, timeout = 4000) {
        for (let t = 0; t < timeout; t += 25) { if (fn()) return; await this.delay(25); }
        throw new Error(`Timed out: ${label}`);
    }
    assert(condition, name, detail = {}) {
        this.results.push({name, passed: Boolean(condition), ...detail});
        GLib.file_set_contents(`${GLib.getenv('PANEL_PET_TEST_OUTPUT')}/progress.json`,JSON.stringify(this.results,null,2));
        if (!condition) throw new Error(`Assertion failed: ${name}`);
    }
    async shot(name) {
        const file = Gio.File.new_for_path(`${GLib.getenv('PANEL_PET_TEST_OUTPUT')}/${name}.png`);
        const stream = file.replace(null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
        await new Shell.Screenshot().screenshot(false, stream);
        stream.close(null);
    }
    async click(actor, button = 1) {
        const [x,y] = actor.get_transformed_position(), [w,h] = actor.get_transformed_size();
        this.pointer.notify_absolute_motion(GLib.get_monotonic_time(), x+w/2, y+h/2);
        await this.delay(70);
        this.pointer.notify_button(GLib.get_monotonic_time(), button, Clutter.ButtonState.PRESSED);
        await this.delay(35);
        this.pointer.notify_button(GLib.get_monotonic_time(), button, Clutter.ButtonState.RELEASED);
        await this.delay(70);
    }
    async run() {
        Main.overview.hide(); await this.delay(600);
        // Enable the subject after this harness, so Shell rebasing cannot stop the test runner.
        Main.extensionManager.enableExtension('panel-pet@local');
        await this.until(() => Main.extensionManager.lookup('panel-pet@local')?.state === 1, 'extension activation');
        await this.delay(400);
        const record = Main.extensionManager.lookup('panel-pet@local');
        this.assert(record?.state === 1, 'extension ACTIVE', {state:record?.state});
        const ext = record.stateObj; const pet = ext._pet;
        ext._squeezeEnabled=false;
        this.assert(pet.size>=ext._layer.height*1.15 && ext._bodyHeight===Math.round(ext._layer.height), 'pet follows real panel scale without 32px cap', {width:pet.size,height:ext._bodyHeight});
        this.pointer = Clutter.get_default_backend().get_default_seat().create_virtual_device(Clutter.InputDeviceType.POINTER_DEVICE);
        this.assert(ext._textures.length === 8, 'all eight transparent textures loaded');
        this.assert(ext._layer.visible && ext._sprite.is_mapped(), 'pet mapped onto real panel', {
            panel: {x:ext._layer.x,y:ext._layer.y,width:ext._layer.width,height:ext._layer.height},spans:pet.spans});
        await this.shot('01-real-panel');
        // Use a real GNOME panel button as the obstacle, and test its click target too.
        this.obstacle = new PanelMenu.Button(0.5, '测试图标');
        this.obstacle.add_child(new St.Label({text:'◈',width:80,y_align:Clutter.ActorAlign.CENTER}));
        this.obstacle.menu.addMenuItem(new PopupMenu.PopupMenuItem('图标可正常点击'));
        Main.panel.addToStatusArea('pet-test-obstacle', this.obstacle, 0, 'center');
        await this.delay(500);
        this.assert(pet.spans.length >= 2, 'real panel controls divide walkable spaces', {spans:pet.spans});
        const x0=pet.x; pet.act('walk',20,'测试散步'); await this.delay(600);
        this.assert(pet.x !== x0, 'live timer moves pet');
        // Physical pointer events, not a direct call to pet().
        pet.paused=true; pet.x=(pet.spans[0][0]+pet.spans[0][1])/2; pet.offset=0; await this.delay(80);
        await this.click(ext._sprite);
        this.assert(pet.state==='happy' && pet.hearts>0, 'left mouse click pets capybara');
        await this.delay(60); await this.shot('02-petted');
        await this.click(ext._sprite,3);
        this.assert(ext._indicator.menu.isOpen, 'right mouse click opens interaction menu');
        await this.shot('03-menu');
        pet.hunger=60; const before=pet.hunger;
        const feed = ext._indicator.menu._getMenuItems().find(item=>item.label?.text==='喂一根胡萝卜');
        await this.click(feed);
        this.assert(pet.state==='eat' && pet.hunger>before, 'physical menu click feeds carrot');
        await this.delay(60); await this.shot('04-fed');
        ext._indicator.menu.close();
        await this.click(this.obstacle);
        this.assert(this.obstacle.menu.isOpen, 'underlying panel icon still receives clicks');
        this.obstacle.menu.close(); pet.paused=false;
        for (const direction of [1,-1]) {
            pet.act('walk',20,'测试闪现');
            const spans=pet.spans; const left=spans[0],right=spans[1];
            pet.direction=direction;pet.x=direction===1?left[1]-0.1:right[0]+0.1;
            await this.until(()=>pet.state==='sink','sink');
            this.assert(pet.target === (direction===1?right[0]:left[1]), `portal target ${direction}`);
            await this.until(()=>pet.state==='hidden','hidden');
            await this.delay(35);
            this.assert(!ext._sprite.visible && pet.offset===pet.size, `fully hidden before crossing ${direction}`);
            await this.until(()=>pet.state==='rise','rise');
            this.assert(pet.x === (direction===1?right[0]:left[1]), `crossed actual icon ${direction}`);
            await this.until(()=>pet.state==='walk' && pet.offset===0,'emerge');
            this.assert(ext._sprite.visible, `visible after emerging ${direction}`);
        }
        pet.hide(); await this.until(()=>pet.state==='hidden','hide and seek');
        await this.until(()=>pet.state==='peek','peek',4500);
        pet.paused=true; await this.delay(60); await this.click(ext._sprite);
        this.assert(pet.message==='被你找到啦！','hide and seek can be won with a real click');
        pet.paused=false;
        Main.overview.show(); await this.delay(600);
        this.assert(!ext._layer.visible,'pet hidden in overview'); Main.overview.hide(); await this.delay(600);
        this.assert(ext._layer.visible,'pet returns after overview');
        pet.paused=false;ext._squeezeEnabled=true;ext._pushCooldown=0;
        pet.act('walk',20,'测试图标让位');pet.direction=1;pet.x=pet.spans.at(-1)[1]-0.1;
        await this.until(()=>ext._push?.phase==='opening','icons start making room');
        await this.until(()=>ext._push?.phase==='resting','pet enters pocket',5000);
        this.assert(ext._shifted.length>0,'crowded icons animated aside');
        this.assert(ext._shifted.some(e=>e.actor&&Math.abs(e.actor.translation_x-e.original)>1),'actual panel actors moved');
        const moved=ext._shifted.map(e=>({actor:e.actor,original:e.original}));
        this.assert(pet.spans.some(([a,b])=>pet.x>=a&&pet.x<=b),'new pocket fits enlarged pet');
        pet.paused=true;await this.shot('06-icons-making-room');
        pet.paused=false;pet.nextChoice=pet.time;pet.random=()=>0.7;
        await this.until(()=>!ext._push,'icons automatically restore after pet exits',5000);
        await this.delay(700);
        this.assert(pet.spans.some(([a,b])=>pet.x>=a&&pet.x<=b), 'pet safely exits the temporary pocket');
        this.assert(moved.every(e=>Math.abs(e.actor.translation_x-e.original)<0.1),'all icon positions restored');
        pet.paused=false;
        const children=Main.layoutManager.uiGroup.get_children().length;
        const previous=ext._layer;
        await Main.extensionManager.disableExtension('panel-pet@local'); await this.delay(350);
        this.assert(!ext._source && !ext._layer && !ext._indicator,'disable removes timer, overlay and menu');
        await Main.extensionManager.enableExtension('panel-pet@local'); await this.delay(450);
        this.assert(ext._source && ext._layer && ext._layer!==previous,'re-enable creates working fresh actors');
        this.assert(Main.layoutManager.uiGroup.get_children().length===children,'re-enable does not leak overlay actors');
        this.obstacle.destroy(); this.obstacle=null;
        await this.delay(400); await this.shot('05-final-panel');
        this.finish();
    }
    finish(error) {
        this.obstacle?.destroy(); this.obstacle=null;
        const report={passed:!error, error:error ? `${error.message}\n${error.stack}` : null, tests:this.results};
        GLib.file_set_contents(`${GLib.getenv('PANEL_PET_TEST_OUTPUT')}/report.json`,JSON.stringify(report,null,2));
        if (error) console.error(`PANEL_PET_TEST_FAILED: ${error.stack}`);
        else console.log('PANEL_PET_TEST_PASSED');
    }
    disable() { for(const id of this._sources) GLib.Source.remove(id);this._sources.clear();this.obstacle?.destroy();this.pointer=null; }
}
