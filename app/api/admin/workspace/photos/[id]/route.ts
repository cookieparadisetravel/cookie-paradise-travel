import { env } from "cloudflare:workers";
import { requireOwner } from "@/lib/owner-auth";
import { ensureWorkspaceMedia, privateMediaHeaders, validPhotoId } from "@/lib/workspace-media";

export const dynamic = "force-dynamic";
export async function GET(_request: Request, {params}:{params:Promise<{id:string}>}) {
  if(!await requireOwner("/admin/inspiration"))return new Response(null,{status:403,headers:privateMediaHeaders});
  const {id}=await params;if(!validPhotoId(id))return new Response(null,{status:404,headers:privateMediaHeaders});
  try {
    await ensureWorkspaceMedia();
    const row=await env.DB!.prepare("SELECT bytes,mime FROM owner_workspace_photos WHERE id=?").bind(id).first<{bytes:ArrayBuffer|number[];mime:string}>();
    if(!row)return new Response(null,{status:404,headers:privateMediaHeaders});
    return new Response(Array.isArray(row.bytes)?new Uint8Array(row.bytes):row.bytes,{headers:{...privateMediaHeaders,"Content-Type":row.mime}});
  }catch{return new Response(null,{status:503,headers:privateMediaHeaders});}
}
