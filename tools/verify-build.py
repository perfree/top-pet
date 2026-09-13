#!/usr/bin/env python3
"""Verify release checksums, archive layout and embedded preview sources."""
import base64
import hashlib
import json
from pathlib import Path
from zipfile import ZipFile

root = Path(__file__).resolve().parent.parent
dist = root / 'dist'
for line in (dist / 'SHA256SUMS').read_text().splitlines():
    expected, name = line.split('  ', 1)
    assert hashlib.sha256((dist / name).read_bytes()).hexdigest() == expected, name
expected_files = {'metadata.json', 'extension.js', 'engine.js', 'push.js', 'sprite.js', 'assets/capybara-atlas.png'}
with ZipFile(dist / 'panel-pet@local.shell-extension.zip') as z:
    assert z.testzip() is None
    assert set(z.namelist()) == expected_files
    metadata = json.loads(z.read('metadata.json'))
    assert metadata['uuid'] == 'panel-pet@local' and metadata['shell-version'] == ['46']
    for name in expected_files:
        assert z.read(name) == (root / 'panel-pet@local' / name).read_bytes(), name
preview = (dist / 'top-pet-preview.html').read_text()
for marker in ['/* ENGINE */', '/* SPRITE */', '/* ATLAS_DATA */']:
    assert marker not in preview, marker
atlas = (root / 'panel-pet@local/assets/capybara-atlas.png').read_bytes()
assert base64.b64encode(atlas).decode() in preview
assert preview == (root / 'preview.html').read_text()
print('Verified release archive, embedded preview and both SHA-256 checksums')
