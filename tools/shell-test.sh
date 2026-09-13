#!/bin/bash
# A genuine GNOME Shell, isolated from the user's desktop and settings.
set -euo pipefail
PROJECT=$(cd "$(dirname "$0")/.." && pwd)
TASK_ROOT=$(mktemp -d /tmp/top-pet-test.XXXXXX)
export XDG_DATA_HOME="$TASK_ROOT/data" XDG_CONFIG_HOME="$TASK_ROOT/config" XDG_CACHE_HOME="$TASK_ROOT/cache" XDG_RUNTIME_DIR="$TASK_ROOT/runtime"
export PANEL_PET_TEST_OUTPUT="$PROJECT/test-results"
export LIBGL_ALWAYS_SOFTWARE=1 GSETTINGS_BACKEND=keyfile
mkdir -p "$XDG_DATA_HOME/gnome-shell/extensions" "$XDG_CONFIG_HOME" "$XDG_CACHE_HOME" "$XDG_RUNTIME_DIR" "$PANEL_PET_TEST_OUTPUT"
chmod 700 "$XDG_RUNTIME_DIR"
cp -r "$PROJECT/panel-pet@local" "$PROJECT/tools/shell-test@local" "$XDG_DATA_HOME/gnome-shell/extensions/"
rm -f "$PANEL_PET_TEST_OUTPUT/report.json"
/usr/bin/dbus-run-session -- bash -c '
 gsettings set org.gnome.shell enabled-extensions "[\"shell-test@local\"]"
 gsettings set org.gnome.shell disable-user-extensions false
 gsettings set org.gnome.desktop.interface scaling-factor 2
 gnome-shell --headless --wayland --no-x11 --virtual-monitor "${PANEL_PET_TEST_MONITOR:-2560x1600}" > "$PANEL_PET_TEST_OUTPUT/shell.log" 2>&1 &
 shell_pid=$!
 trap "kill $shell_pid 2>/dev/null || true; wait $shell_pid 2>/dev/null || true" EXIT
 for ((i=0;i<65;i++)); do
   if [ -f "$PANEL_PET_TEST_OUTPUT/report.json" ]; then break; fi
   if ! kill -0 "$shell_pid" 2>/dev/null; then break; fi
   sleep 1
 done
 gnome-extensions info panel-pet@local > "$PANEL_PET_TEST_OUTPUT/extension-info.txt" 2>&1 || true
' > "$PANEL_PET_TEST_OUTPUT/session.log" 2>&1
python3 - "$PANEL_PET_TEST_OUTPUT/report.json" <<'PY'
import json,sys
from pathlib import Path
p=Path(sys.argv[1])
if not p.exists():
    print('No test report; inspect test-results/shell.log'); sys.exit(1)
r=json.loads(p.read_text())
for t in r['tests']: print(('PASS' if t['passed'] else 'FAIL')+': '+t['name'])
if r['error']: print(r['error'])
sys.exit(0 if r['passed'] else 1)
PY
