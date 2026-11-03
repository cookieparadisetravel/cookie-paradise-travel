from pathlib import Path
from collections import defaultdict
from PIL import Image
import json,hashlib,math
source=Path('public/cookie-paradise-travel-logo.png')
im=Image.open(source).convert('RGBA')
alpha=im.getchannel('A')
x0,y0,x1,y1=25,380,1255,466
pixels={(x,y) for y in range(y0,y1) for x in range(x0,x1) if alpha.getpixel((x,y))>=128}
edges=defaultdict(list)
for x,y in pixels:
 if (x,y-1) not in pixels:edges[(x,y)].append((x+1,y))
 if (x+1,y) not in pixels:edges[(x+1,y)].append((x+1,y+1))
 if (x,y+1) not in pixels:edges[(x+1,y+1)].append((x,y+1))
 if (x-1,y) not in pixels:edges[(x,y+1)].append((x,y))
loops=[]
while edges:
 start=min(edges);current=start;points=[start]
 while True:
  end=edges[current].pop()
  if not edges[current]:del edges[current]
  points.append(end);current=end
  if current==start:break
 loops.append(points)
def area(points):return sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(points,points[1:]))/2
assert round(sum(area(p) for p in loops))==len(pixels)
def simplify(points,tolerance=.35):
 if len(points)<3:return points
 a,b=points[0],points[-1];dx,dy=b[0]-a[0],b[1]-a[1];length=math.hypot(dx,dy)
 distances=[abs(dy*(p[0]-a[0])-dx*(p[1]-a[1]))/length if length else math.dist(a,p) for p in points[1:-1]]
 distance=max(distances,default=0)
 if distance<=tolerance:return [a,b]
 index=distances.index(distance)+1
 return simplify(points[:index+1],tolerance)[:-1]+simplify(points[index:],tolerance)
paths=[]
for points in loops:
 midpoint=len(points)//2
 points=simplify(points[:midpoint+1])[:-1]+simplify(points[midpoint:])
 path=f'M{points[0][0]} {points[0][1]}'
 for previous,current in zip(points,points[1:]):
  dx,dy=current[0]-previous[0],current[1]-previous[1]
  if dy==0:path+=f'h{dx}'
  elif dx==0:path+=f'v{dy}'
  else:path+=f'l{dx} {dy}'
 paths.append(path+'z')
path=''.join(paths)
assert abs(sum(area(p) for p in loops)-len(pixels))<.001
metadata={'source':str(source),'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'crop':[x0,y0,x1,y1],'alphaThreshold':128,'simplificationToleranceInOriginalPixels':.35,'opaquePixels':len(pixels),'contours':len(loops),'pathCharacters':len(path)}
Path('docs/mobile-logo-fix/trace.json').write_text(json.dumps(metadata,indent=2)+'\n')
Path('app/components/brand-logo-subtitle.ts').write_text('// Traced from the supplied logo subtitle; original image coordinates and lettering are retained.\n// Native SVG fill keeps the subtitle legible without browser image-filter support.\nexport const travelCompanyPath = '+json.dumps(path)+';\n')
print(json.dumps(metadata))
