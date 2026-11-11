import { env } from "cloudflare:workers";
import { requireOwner } from "@/lib/owner-auth";
import { ensureWorkspaceMedia, listWorkspacePhotos, privateMediaHeaders, rasterMime, validPhotoId } from "@/lib/workspace-media";

export const dynamic = "force-dynamic";
const json = (body: unknown, status=200) => Response.json(body,{status,headers:privateMediaHeaders});
export async function GET() {
  if (!await requireOwner("/admin/inspiration")) return json({error:"Not authorized."},403);
  try { return json({photos:await listWorkspacePhotos()}); }
  catch { return json({error:"Your photos could not be loaded."},503); }
}
export async function POST(request: Request) {
  if (!await requireOwner("/admin/inspiration")) return json({error:"Not authorized."},403);
  if (request.headers.get("origin") !== new URL(request.url).origin) return json({error:"Invalid request origin."},403);
  // Bound the streamed body before JSON/base64 decoding, regardless of Content-Length.
  const reader=request.body?.getReader();if(!reader)return json({error:"Choose a photo."},400);
  let size=0;const chunks:Uint8Array[]=[];
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>2_100_000){await reader.cancel();return json({error:"Choose a photo under 1.5 MB."},413);}chunks.push(value);}
  try {
    const body=new Uint8Array(size);let offset=0;for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.length;}
    const input=JSON.parse(new TextDecoder().decode(body));
    if (!input || typeof input!=="object" || typeof input.id!=="string" || !validPhotoId(input.id)
      || typeof input.title!=="string" || !input.title.trim() || input.title.length>100
      || typeof input.alt!=="string" || input.alt.length>250
      || typeof input.position!=="string" || !/^\d{1,3}% \d{1,3}%$/.test(input.position)
      || input.position.split(" ").some((part:string)=>parseInt(part)>100)
      || typeof input.data!=="string") return json({error:"This photo has invalid details."},400);
    const decoded=atob(input.data);if(decoded.length>1_500_000)return json({error:"Choose a photo under 1.5 MB."},413);
    const bytes=Uint8Array.from(decoded,character=>character.charCodeAt(0));const mime=rasterMime(bytes);
    if(!mime)return json({error:"Choose a JPG, PNG, or WebP photo."},400);
    await ensureWorkspaceMedia();
    const now=new Date().toISOString();
    // Atomic cap; replacements remain possible when the 50-photo collection is full.
    const result=await env.DB!.prepare(`INSERT INTO owner_workspace_photos (id,title,alt,position,mime,bytes,created_at,updated_at)
      SELECT ?,?,?,?,?,?,?,? WHERE (SELECT count(*) FROM owner_workspace_photos)<50 OR EXISTS(SELECT 1 FROM owner_workspace_photos WHERE id=?)
      ON CONFLICT(id) DO UPDATE SET title=excluded.title,alt=excluded.alt,position=excluded.position,mime=excluded.mime,bytes=excluded.bytes,updated_at=excluded.updated_at`)
      .bind(input.id,input.title.trim(),input.alt,input.position,mime,bytes.buffer,now,now,input.id).run();
    if(!result.meta.changes)return json({error:"Your collection is full (50 photos)."},409);
    return json({ok:true});
  } catch { return json({error:"The photo could not be saved. Please try again."},400); }
}
