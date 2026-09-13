import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

// Read PlaybackStatus only. No titles, URLs or input contents are collected.
export class ActivityMonitor {
    constructor(path, onTyping, x11) {
        this.playing = false;
        this._cancel = new Gio.Cancellable();
        this._busy = false;
        this._source = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2500, () => {
            this.refresh(); return GLib.SOURCE_CONTINUE;
        });
        this.refresh();
        if (x11) {
            try {
                this._process = Gio.Subprocess.new(['python3', `${path}/typing-activity.py`],
                    Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE);
                this._stream = new Gio.DataInputStream({base_stream:this._process.get_stdout_pipe()});
                const read = () => this._stream.read_line_async(GLib.PRIORITY_DEFAULT, this._cancel, (stream,result) => {
                    let again=false;
                    try {
                        const [line] = stream.read_line_finish_utf8(result);
                        if (line !== null && !this._cancel.is_cancelled()) {
                            if (line === 'active') onTyping();
                            again=true;
                        }
                    } catch (_) { /* Cancelled or optional X11 helper unavailable. */ }
                    if(again)read();
                    else { try { stream.close(null); } catch (_) { /* Already closed. */ } }
                });
                read();
            } catch (_) { /* Python/X11 is optional; Shell events still work. */ }
        }
    }
    _call(name, path, iface, method, args) {
        return new Promise((resolve,reject) => Gio.DBus.session.call(name,path,iface,method,args,null,
            Gio.DBusCallFlags.NONE,1500,this._cancel,(bus,result) => {
                try { resolve(bus.call_finish(result).deep_unpack()); } catch(e) { reject(e); }
            }));
    }
    async refresh() {
        if (this._busy || this._cancel.is_cancelled()) return;
        this._busy=true;
        try {
            const [names] = await this._call('org.freedesktop.DBus','/org/freedesktop/DBus',
                'org.freedesktop.DBus','ListNames',null);
            const statuses = await Promise.all(names.filter(n=>n.startsWith('org.mpris.MediaPlayer2.')).map(async name=>{
                try {
                    const [value] = await this._call(name,'/org/mpris/MediaPlayer2','org.freedesktop.DBus.Properties',
                        'Get',new GLib.Variant('(ss)',['org.mpris.MediaPlayer2.Player','PlaybackStatus']));
                    return value.deep_unpack() === 'Playing';
                } catch (_) { return false; }
            }));
            if (!this._cancel.is_cancelled()) this.playing=statuses.some(Boolean);
        } catch (_) { if (!this._cancel.is_cancelled()) this.playing=false; }
        finally { this._busy=false; }
    }
    destroy() {
        this._cancel.cancel();
        if(this._source) GLib.Source.remove(this._source);
        this._source=0;
        this._process?.force_exit(); this._process=null;
        // The pending read callback closes its stream after cancellation completes.
        this._stream=null;
    }
}
