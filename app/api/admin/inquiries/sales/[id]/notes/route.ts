import { z } from "zod";
import { requireOwner } from "@/lib/owner-auth";
import { boundedBody, sameOrigin } from "@/lib/lead-request";
import { getSalesProcess, loadSalesNotes, saveSalesNote } from "@/lib/inquiry-sales";
import { MAX_INQUIRY_NOTE_LENGTH } from "@/lib/inquiry-notes";
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"private, no-store"}});
type Context={params:Promise<{id:string}>};
const validId=(id:string)=>/^[gb]_[a-zA-Z0-9_-]{1,256}$/.test(id);
export async function GET(_request:Request,{params}:Context) {
  if (!await requireOwner("/admin/inquiries")) return json({error:"Not authorized."},403);
  const {id}=await params;
  if (!validId(id)) return json({error:"Invalid inquiry."},400);
  try {const sale=await getSalesProcess(id);return sale ? json({ok:true,notes:await loadSalesNotes(sale)}) : json({error:"Inquiry not found."},404);}
  catch {return json({error:"Notes are unavailable."},503);}
}
export async function POST(request:Request,{params}:Context) {
  if (!sameOrigin(request)) return json({error:"Invalid origin."},403);
  const owner=await requireOwner("/admin/inquiries");
  if (!owner) return json({error:"Not authorized."},403);
  const {id}=await params;
  if (!validId(id)) return json({error:"Invalid inquiry."},400);
  let payload:{id:string;body:string};
  try {payload=z.object({id:z.string().uuid(),body:z.string().trim().min(1).max(MAX_INQUIRY_NOTE_LENGTH)}).strict().parse(JSON.parse(await boundedBody(request,40000)));}
  catch {return json({error:"Enter a valid note."},400);}
  try {const sale=await getSalesProcess(id);return sale ? json({ok:true,note:await saveSalesNote(sale,payload,owner.email)}) : json({error:"Inquiry not found."},404);}
  catch {return json({error:"The note could not be saved. Your text can be retried."},409);}
}
