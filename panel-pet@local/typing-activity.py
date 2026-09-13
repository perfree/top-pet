"""Optional X11 activity helper: emits a boolean pulse, never key values or text."""
import ctypes
import time

x11 = ctypes.CDLL('libX11.so.6')
x11.XOpenDisplay.argtypes = [ctypes.c_char_p]
x11.XOpenDisplay.restype = ctypes.c_void_p
x11.XQueryKeymap.argtypes = [ctypes.c_void_p, ctypes.c_void_p]
x11.XCloseDisplay.argtypes = [ctypes.c_void_p]
display = x11.XOpenDisplay(None)
if not display:
    raise SystemExit(0)
keys = ctypes.create_string_buffer(32)
last = -5.0
try:
    while True:
        x11.XQueryKeymap(display, keys)
        active = any(keys.raw)
        ctypes.memset(keys, 0, 32)
        now = time.monotonic()
        if active and now-last >= 3:
            print('active', flush=True)
            last = now
        time.sleep(0.08)
finally:
    x11.XCloseDisplay(display)
