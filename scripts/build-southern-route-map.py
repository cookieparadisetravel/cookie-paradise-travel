"""Render our route over public-domain Natural Earth 1:50m country outlines."""
import json, math
from pathlib import Path
from html import escape
ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'public/travel/southern-vietnam-route.svg'

def xy(lon,lat): return (40+(lon-100)*67,100+(19-lat)*67)
def point(lon,lat): return '%.1f %.1f'%xy(lon,lat)
parts=['''<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="950" viewBox="0 0 1000 950" role="img" aria-labelledby="title desc">
<title id="title">Discover Southern Vietnam: eight-day route</title>
<desc id="desc">Start in Ho Chi Minh City on days 1–3, with a return excursion to the Mekong Delta on day 3. Fly to Hue on day 4 and stay through day 5. Travel by road via Hai Van Pass to Hoi An on day 6, stay on day 7, and transfer to Da Nang airport to depart on day 8.</desc>
<defs><clipPath id="map"><rect x="0" y="113" width="1000" height="732"/></clipPath>
<g id="plane"><path d="M0 -20 L5 -5 L24 4 L24 9 L5 4 L5 16 L11 21 L11 25 L0 21 L-11 25 L-11 21 L-5 16 L-5 4 L-24 9 L-24 4 L-5 -5Z"/></g>
<style>text{font-family:Arial,Helvetica,sans-serif;fill:#352719}.label{font-size:34px;font-weight:700;paint-order:stroke;stroke:#f9f6ef;stroke-width:6;stroke-linejoin:round}.sub{font-size:22px;fill:#604f3d;paint-order:stroke;stroke:#f9f6ef;stroke-width:4}.country{font-size:22px;letter-spacing:5px;fill:#7a867d}.leader{fill:none;stroke:#706e5b;stroke-width:1.5;stroke-linecap:round}.road{fill:none;stroke:#a0442e;stroke-width:6;stroke-linecap:round;stroke-linejoin:round}</style></defs>
<rect width="1000" height="950" rx="24" fill="#f9f6ef"/>
<text x="40" y="43" font-size="16" letter-spacing="2" font-weight="700">COOKIE PARADISE TRAVEL COMPANY</text>
<text x="40" y="85" font-family="Georgia,serif" font-size="34" font-weight="700">Discover Southern Vietnam</text>
<text x="960" y="80" text-anchor="end" font-size="21">8 days · 7 nights</text>
<g clip-path="url(#map)"><rect y="113" width="1000" height="732" fill="#c9e3e9"/>
''']
j=json.loads((ROOT/'scripts/map-data/southeast-asia.geojson').read_text())
for f in j['features']:
 g=f['geometry']; polygons=g['coordinates'] if g['type']=='MultiPolygon' else [g['coordinates']]
 for polygon in polygons:
  cmds=[]
  for ring in polygon:
   cmds.append('M'+' L'.join(point(*p) for p in ring)+'Z')
  fill='#f9f6ef' if f['properties']['name']=='Vietnam' else '#e3e6dc'
  parts.append(f'<path d="{" ".join(cmds)}" fill="{fill}" stroke="#a4b2a7" stroke-width="1.4"/>')
hcm=point(106.7,10.776);hue=point(107.59,16.463);dad=point(108.202,16.043);hoi=point(108.328,15.88);delta=point(106.15,10.15)
parts.append(f'''<text x="208" y="265" class="country">LAOS</text>
<text x="175" y="505" class="country">CAMBODIA</text>
<text x="405" y="437" class="country" transform="rotate(57 405 437)">VIETNAM</text>
<!-- Day 3 is an excursion returning to Ho Chi Minh City. -->
<path d="M{hcm} Q451 657 {delta} Q488 724 {hcm}" class="road"/>
<!-- Schematic flight connection, not a flight track. -->
<path d="M{hcm} C750 642 790 295 {hue}" fill="none" stroke="#a0442e" stroke-width="5" stroke-dasharray="12 10"/>
<g transform="translate(698 463) rotate(6)" fill="#a0442e"><use href="#plane"/></g>
<text x="780" y="490" font-size="24" fill="#713e2a" font-weight="700">Domestic flight</text>
<text x="780" y="518" font-size="21">Day 4</text>
<!-- Road via Hai Van Pass, followed by Day 8 airport transfer. -->
<path d="M{hue} L{point(107.99,16.21)} L{point(108.133,16.19)} L{point(108.22,16.10)} L{hoi}" class="road"/>
<path d="M{hoi} Q616 291 {dad}" fill="none" stroke="#a0442e" stroke-width="3"/>
<path d="M{hue} L605 210 L635 210" class="leader"/>
<text x="651" y="211" class="label">Hue</text><text x="651" y="240" class="sub">Days 4–5</text>
<path d="M{dad} L712 284 L737 284" class="leader"/>
<text x="751" y="286" class="label">Da Nang</text><text x="751" y="315" class="sub">Depart · Day 8</text>
<path d="M{hoi} L647 370 L740 370" class="leader"/>
<text x="756" y="378" class="label">Hoi An</text><text x="756" y="407" class="sub">Days 6–7</text>
<text x="357" y="339" font-size="21" font-style="italic">Hai Van Pass</text><path d="M493 335 L{point(108.133,16.19)}" class="leader"/>
<path d="M{hcm} L420 616 L95 616" class="leader"/>
<text x="95" y="574" class="label">Ho Chi Minh City</text><text x="95" y="604" class="sub">Start · Days 1–3</text>
<path d="M{delta} L433 753 L257 753" class="leader"/>
<text x="257" y="789" class="label">Mekong Delta</text><text x="257" y="819" class="sub">Day 3 · Return excursion</text>
''')
for lon,lat in [(107.59,16.463),(108.328,15.88),(106.15,10.15)]:
 x,y=xy(lon,lat);parts.append(f'<circle cx="{x}" cy="{y}" r="8" fill="#352719" stroke="#f9f6ef" stroke-width="3"/>')
x,y=xy(106.7,10.776)
star=' '.join(f'{x+math.sin(i*math.pi/5)*(13 if i%2==0 else 5.5):.1f},{y-math.cos(i*math.pi/5)*(13 if i%2==0 else 5.5):.1f}' for i in range(10))
parts.append(f'<circle cx="{x}" cy="{y}" r="19" fill="#352719" stroke="#f9f6ef" stroke-width="3"/><polygon points="{star}" fill="#fff"/>')
x,y=xy(108.202,16.043)
parts.append(f'<circle cx="{x}" cy="{y}" r="9" fill="#f9f6ef" stroke="#352719" stroke-width="2.5"/><g transform="translate({x} {y-1}) scale(.24)" fill="#352719"><use href="#plane"/></g>')
parts.append('''</g>
<path d="M40 878 H99" class="road"/><text x="115" y="885" font-size="21">Road / excursion</text>
<path d="M350 878 H414" stroke="#a0442e" stroke-width="5" stroke-dasharray="12 9"/><text x="432" y="885" font-size="21">Flight</text>
<circle cx="592" cy="878" r="7" fill="#352719"/><text x="612" y="885" font-size="21">Destination</text>
<text x="40" y="924" font-size="16" fill="#6d7166">Route lines are illustrative. Map data: Natural Earth (public domain).</text>
<text x="960" y="924" text-anchor="end" font-size="16">cookieparadisetravel.com</text>
</svg>''')
OUT.write_text(''.join(parts))
print(OUT)
# Render a shareable PNG from the same vector artwork.
import subprocess
subprocess.run(['node','-e',"require('sharp')('public/travel/southern-vietnam-route.svg').resize(2000).png().toFile('public/travel/southern-vietnam-route.png')"],cwd=ROOT,check=True)
