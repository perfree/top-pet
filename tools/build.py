#!/usr/bin/env python3
"""Build reproducible release artifacts with Python's standard library."""
import base64
import hashlib
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

root = Path(__file__).resolve().parent.parent
extension = root / 'panel-pet@local'
preview = (root / 'preview.template.html').read_text()
for name in ['engine', 'sprite']:
    preview = preview.replace('/* ' + name.upper() + ' */',
                              (extension / f'{name}.js').read_text().replace('export ', ''))
preview = preview.replace('/* ATLAS_DATA */', 'data:image/png;base64,' +
                          base64.b64encode((extension / 'assets/capybara-atlas.png').read_bytes()).decode())
(root / 'preview.html').write_text(preview)
dist = root / 'dist'
dist.mkdir(exist_ok=True)
preview_path = dist / 'top-pet-preview.html'
preview_path.write_text(preview)
zip_path = dist / 'panel-pet@local.shell-extension.zip'
with ZipFile(zip_path, 'w', ZIP_DEFLATED) as archive:
    for path in sorted(extension.rglob('*')):
        if path.is_file() and path.suffix in {'.js', '.json', '.png'}:
            entry = ZipInfo(path.relative_to(extension).as_posix(), date_time=(1980, 1, 1, 0, 0, 0))
            entry.compress_type = ZIP_DEFLATED
            entry.external_attr = 0o100644 << 16
            archive.writestr(entry, path.read_bytes())
checksums = ''.join(f'{hashlib.sha256(path.read_bytes()).hexdigest()}  {path.name}\n'
                    for path in [zip_path, preview_path])
(dist / 'SHA256SUMS').write_text(checksums)
print('Built extension ZIP, offline preview and SHA256SUMS in dist/')
