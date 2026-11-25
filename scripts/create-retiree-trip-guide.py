"""Create the retiree offer guide without changing the standard trip guide."""
from pathlib import Path
import fitz

ROOT = Path(__file__).resolve().parent.parent
source = fitz.open(ROOT / 'public/vietnam-trip-guide.pdf')
source.delete_page(5)  # Standard departures/pricing do not belong in this offer.
cream = (1, .976, .937)
ink = (.35, .19, .07)
for index, page in enumerate(source):
    replacements = []
    if index == 3:
        page.add_redact_annot(fitz.Rect(385, 356, 554, 393), fill=cream)
        replacements.append((fitz.Rect(386.5, 358, 554, 393), "International airfare, travel insurance,\ngratuities, personal expenses, drinks\nnot listed as included and optional extras.", 8.5, 'helv'))
    original = page.get_pixmap()

    for block in page.get_text('dict')['blocks']:
        for line in block.get('lines', []):
            for span in line['spans']:
                old = span['text']
                text, size = None, span['size']
                if old == 'US$2,875': text = 'US$3,000'
                elif old.startswith('Meals  '): text = 'Meals  All included'
                elif old == 'Daily breakfast, 5 lunches and 3 dinners': text = 'All meals during the eight-day Vietnam tour'; size = 9
                elif old == 'English-speaking local guides': text = 'Experienced tour leader and local guides'; size = 9
                elif old.startswith('Summer & December 2027'): text = 'Retiree package | December 27, 2027 - January 3, 2028'; size = 6.3
                elif old.startswith('SUMMER & DECEMBER 2027'): text = 'DECEMBER 27, 2027 - JANUARY 3, 2028 | RETIREE PACKAGE'; size = 7
                
                if text:
                    rect = fitz.Rect(span['bbox'])
                    background = tuple(c / 255 for c in original.pixel(max(0, int(rect.x0)-2), int(rect.y0)))
                    page.add_redact_annot(rect, fill=background)
                    replacements.append((rect, text, size, 'hebo' if old.startswith('US$') else 'helv'))
    page.apply_redactions(images=0, graphics=0)
    for rect, text, size, font in replacements:
        page.insert_text((rect.x0, rect.y0 + size), text, fontsize=size, fontname=font, color=ink)
# All shared-room prices and meal exclusions must be specific to this package.
out = ROOT / 'public/vietnam-retiree-trip-guide.pdf'
source.subset_fonts()
source.save(out, garbage=4, deflate=True)
source.close()
check = fitz.open(out)
text = '\n'.join(page.get_text() for page in check)
assert '2,875' not in text and 'All dates on page 6' not in text
assert text.count('Meals  All included') == 8
assert 'All meals during the eight-day Vietnam tour' in text
assert text.count('US$3,000') == 2
assert 'International airfare, travel insurance,' in text
render = ROOT / 'work/retiree-guide-review'
render.mkdir(parents=True, exist_ok=True)
for i,page in enumerate(check):
    page.get_pixmap(matrix=fitz.Matrix(1.2,1.2)).save(render / f'page-{i+1}.png')
print('Created five-page retiree guide; standard guide unchanged.')
