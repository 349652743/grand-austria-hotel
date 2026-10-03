"""Extract original embedded royal-card art from the 2022 official rules PDF.
Requires PyMuPDF and Pillow. Use the pinned source digest; never upscale images.
"""
import argparse
import hashlib
import io
import json
from pathlib import Path
import pymupdf
from PIL import Image, ImageDraw

p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--pdf', type=Path, required=True)
p.add_argument('--assets', type=Path, required=True)
p.add_argument('--contact-sheet', type=Path)
a = p.parse_args()
source_hash = hashlib.sha256(a.pdf.read_bytes()).hexdigest()
assert source_hash == '7fd17c0fe0a3f96e7629f6102bc94bb7ae70f284f309ab58e2e001d8d142c711', 'Unexpected PDF edition; re-verify IDs before extraction'
doc = pymupdf.open(a.pdf)
# IDs follow the printed rulebook layout, NOT numeric order on page 19.
sets = [
    (19, 'objective', [105, 108, 107, 106, 109, 112, 110, 111, 113, 114, 115, 116],
     [3598, 3600, 3602, 3604, 3606, 3608, 3610, 3612, 3590, 3592, 3594, 3596]),
    (20, 'emperor', ['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4', 'C1', 'C2', 'C3', 'C4'],
     [3634, 3636, 3646, 3648, 3650, 3652, 3654, 3656, 3658, 3660, 3638, 3640]),
]
a.assets.mkdir(parents=True, exist_ok=True)
manifest_path = a.assets / 'sources.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
entries, thumbnails = [], []
for page, kind, ids, xrefs in sets:
    available = {im['xref'] for im in doc[page-1].get_image_info(xrefs=True)}
    for card_id, xref in zip(ids, xrefs, strict=True):
        assert xref in available, f'PDF layout changed: {xref}'
        source = doc.extract_image(xref)
        image = Image.open(io.BytesIO(source['image'])).convert('RGB')
        assert image.size == ((117, 180) if kind == 'objective' else (135, 166))
        name = f'{kind}-{card_id}.png'
        image.save(a.assets / name)
        entries.append(dict(file=name, url='https://www.lookout-spiele.de/upload/de_grandaustriahotel.html_GAH_Retail21_Rules_152_EN_WEB.pdf',
                            source='raw/assets/grand-austria-hotel/official-rules-en.pdf', source_sha256=source_hash,
                            page=page, xref=xref, width=image.width, height=image.height,
                            method='Original embedded image decoded to PNG, native resolution; no upscaling.',
                            sha256=hashlib.sha256((a.assets/name).read_bytes()).hexdigest(),
                            rights='Klemens Franz / atelier198 / Lookout Games. Open redistribution license not verified; private local prototype.'))
        thumbnails.append((name, image))
assert len(entries) == 24 and len({e['file'] for e in entries}) == 24
names = {e['file'] for e in entries}
manifest = [e for e in manifest if e['file'] not in names] + entries
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
if a.contact_sheet:
    sheet = Image.new('RGB', (6*160, 4*210), '#f7f4ec')
    draw = ImageDraw.Draw(sheet)
    for i, (name, image) in enumerate(thumbnails):
        x, y = (i%6)*160, (i//6)*210
        draw.text((x+4, y+4), name, fill='#263c36')
        sheet.paste(image, (x+(160-image.width)//2, y+24))
    a.contact_sheet.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(a.contact_sheet)
print(json.dumps({'artworks':len(entries),'source_sha256':source_hash,'manifest':str(manifest_path)}))
