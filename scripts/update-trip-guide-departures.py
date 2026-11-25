"""Refresh the published PDF's dates from the website departure configuration."""
import calendar
import io
from datetime import date
from pathlib import Path
import re
import fitz
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor

ROOT = Path(__file__).resolve().parent.parent
PDF = ROOT / 'public/vietnam-trip-guide.pdf'
rows = re.findall(r'departure: "([^"]+)", label: "[^"]+", dateRange: "([^"]+)", endDate: "([^"]+)"', (ROOT / 'lib/trip-availability.ts').read_text())
assert len(rows) == 7
source = fitz.open(PDF)
if source.page_count == 6 and 'Choose your departure' in source[-1].get_text():
    source.delete_page(5)
assert source.page_count == 5
cream = (1, 0.976, 0.937)
ink = (0.35, 0.19, 0.07)
# Existing booklet keeps its itinerary, photos, QR links and registration page.
for page, rect, text, size, right in [
    (source[0], fitz.Rect(350, 38, 563, 47), 'Summer & December 2027 | All dates on page 6', 7.2, True),
    (source[3], fitz.Rect(49, 231, 310, 243), 'SUMMER & DECEMBER 2027 / ALL DATES ON PAGE 6', 7.2, False),
]:
    page.add_redact_annot(rect, fill=cream)
    page.apply_redactions(images=0, graphics=0)
    x = rect.x1 - fitz.get_text_length(text, fontname='helv', fontsize=size) if right else rect.x0 + 1
    page.insert_text((x, rect.y0 + size), text, fontname='helv', fontsize=size, color=ink)

buffer = io.BytesIO()
c = canvas.Canvas(buffer, pagesize=(612, 792))
c.setFillColor(HexColor('#fff9ef')); c.rect(0, 0, 612, 792, fill=1, stroke=0)

def text(x, y, value, size=11, font='Helvetica', color='#593012'):
    c.setFillColor(HexColor(color)); c.setFont(font, size); c.drawString(x, y, value)

def line(y):
    c.setStrokeColor(HexColor('#e4d4bc')); c.setLineWidth(.6); c.line(46, y, 566, y)

text(46, 751, 'COOKIE PARADISE TRAVEL COMPANY', 9, 'Helvetica-Bold')
line(735)
text(46, 702, 'DISCOVER SOUTHERN VIETNAM', 9, 'Helvetica-Bold')
text(46, 666, 'Choose your departure', 29, 'Times-Bold')
text(46, 641, 'Eight days. Seven nights. Your own group of 4–8 guests.', 11)
text(46, 622, 'US$2,875 per person sharing a room • Private room +$399', 11)

text(46, 606, 'Optional: all tour meals +$125 per person (US$3,000 shared-room total).', 10)

c.setFillColor(HexColor('#f0e2cd')); c.rect(46, 570, 520, 30, fill=1, stroke=0)
text(58, 581, 'TRIP DATES', 9, 'Helvetica-Bold')
text(380, 581, 'FINAL PAYMENT DUE', 9, 'Helvetica-Bold')
y=548
for start, label, end in rows:
    d=date.fromisoformat(start)
    month=d.month-2; year=d.year
    if month <= 0: month += 12; year -= 1
    due=date(year, month, min(d.day, calendar.monthrange(year, month)[1]))
    text(58, y, label, 11, 'Helvetica-Bold')
    text(380, y, f'{due:%B} {due.day}, {due.year}', 11)
    line(y-15); y-=43
text(46, 225, 'A simple way to plan ahead', 19, 'Times-Bold')
for yy, value in [
    (201, '$500 nonrefundable deposit per traveler, with monthly payments available.'),
    (183, 'Your final payment is due two months before your departure.'),
    (155, 'Arrive in Ho Chi Minh City (SGN) on the first date listed above.'),
    (137, 'Fly home from Da Nang (DAD) on the last date. International flights are extra.'),
    (109, 'Request your preferred departure at cookieparadisetravel.com/#pricing.'),
    (91, 'See page 5 and your personalized booking documents for booking terms.'),
]: text(46, yy, value, 10)
c.linkURL('https://cookieparadisetravel.com/#pricing', (46, 104, 566, 121), relative=0)
line(65)
text(46, 48, 'cookieparadisetravel.com', 9, 'Helvetica-Bold')
text(552, 48, '06', 9)
c.showPage(); c.save()
extra=fitz.open(stream=buffer.getvalue(), filetype='pdf')
source.insert_pdf(extra)
output=PDF.with_suffix('.tmp.pdf')
source.save(output, garbage=4, deflate=True)
source.close(); output.replace(PDF)
check=fitz.open(PDF)
assert check.page_count==6
for _, label, _ in rows: assert label in check[-1].get_text()
for index, name in [(0,'cover'),(3,'details'),(5,'departures')]:
    check[index].get_pixmap(matrix=fitz.Matrix(1,1)).save(f'/tmp/summer-guide-{name}.png')
print('Updated guide: six pages, all seven departures verified.')
