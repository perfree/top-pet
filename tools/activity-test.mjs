// Optional local test: reads only activity booleans; does not inject input.
import GLib from 'gi://GLib';
import {ActivityMonitor} from '../panel-pet@local/activity.js';
const path=GLib.build_filenamev([GLib.get_current_dir(),'panel-pet@local']);
const loop=new GLib.MainLoop(null,false);
const monitor=new ActivityMonitor(path,()=>{},true);
GLib.timeout_add(GLib.PRIORITY_DEFAULT,1000,()=>{
    monitor.destroy();
    GLib.timeout_add(GLib.PRIORITY_DEFAULT,150,()=>{
        if(monitor._process || monitor._source || monitor._stream)throw new Error('Activity monitor leaked resources');
        print('PASS: activity monitor cancels pending reads and stops its child process');
        loop.quit();return GLib.SOURCE_REMOVE;
    });
    return GLib.SOURCE_REMOVE;
});
loop.run();
