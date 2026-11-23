import { requireOwner } from "@/lib/owner-auth";
import { visaHeaders } from "@/lib/visa-information";
import { visaAudit, visaDb } from "@/lib/visa-information-storage";
export const dynamic="force-dynamic";
export async function GET(_request:Request,{params}:{params:Promise<{id:string;travelerId:string;kind:string}>}){
  const owner=await requireOwner("/admin/inquiries");if(!owner)return new Response(null,{status:403,headers:visaHeaders});
  const {id,travelerId,kind}=await params;
  if(!/^[1-9]\d*$/.test(id)||!Number.isSafeInteger(Number(id))||!/^[1-9]\d*$/.test(travelerId)||!Number.isSafeInteger(Number(travelerId))||!["passport","portrait"].includes(kind))return new Response(null,{status:404,headers:visaHeaders});
  try{const db=await visaDb();const row=await db.prepare("SELECT d.mime,d.bytes FROM visa_information_documents d JOIN travelers t ON t.id=d.traveler_id AND t.booking_request_id=d.booking_id WHERE d.booking_id=? AND d.traveler_id=? AND d.kind=?").bind(Number(id),Number(travelerId),kind).first<{mime:string;bytes:ArrayBuffer|number[]}>();
    if(!row)return new Response(null,{status:404,headers:visaHeaders});
    await visaAudit(Number(id),Number(travelerId),`downloaded_${kind}`,owner.email);
    const extension=row.mime==="image/png"?"png":row.mime==="image/webp"?"webp":"jpg";
    return new Response(new Uint8Array(row.bytes),{headers:{...visaHeaders,"Content-Type":row.mime,"Content-Disposition":`attachment; filename="${kind}-${travelerId}.${extension}"`,"Content-Security-Policy":"default-src 'none'; sandbox"}});
  }catch{return new Response(null,{status:503,headers:visaHeaders});}
}
