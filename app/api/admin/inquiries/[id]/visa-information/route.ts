import { requireOwner } from "@/lib/owner-auth";
import { boundedVisaBody, sameVisaOrigin, visaHeaders } from "@/lib/visa-information";
import { createVisaRequest, visaAudit, visaDb, visaTraveler } from "@/lib/visa-information-storage";
import { z } from "zod";
export const dynamic="force-dynamic";
type Context={params:Promise<{id:string}>};
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:visaHeaders});
const idValue=(value:string)=>/^[1-9]\d*$/.test(value)&&Number.isSafeInteger(Number(value))?Number(value):null;
export async function GET(_request:Request,context:Context){
  if(!await requireOwner("/admin/inquiries"))return json({error:"Not authorized."},403);
  const bookingId=idValue((await context.params).id);if(!bookingId)return json({error:"Invalid inquiry."},400);
  try{const db=await visaDb();const {results}=await db.prepare(`SELECT t.id,t.first_name,t.last_name,t.email,t.traveler_type,t.guardian_legal_name,(SELECT e.status FROM visa_information_emails e WHERE e.traveler_id=t.id AND e.booking_id=t.booking_request_id ORDER BY e.created_at DESC LIMIT 1) AS email_status,(SELECT e.created_at FROM visa_information_emails e WHERE e.traveler_id=t.id AND e.booking_id=t.booking_request_id ORDER BY e.created_at DESC LIMIT 1) AS email_created_at,s.received_at,s.status,(SELECT r.expires_at FROM visa_information_requests r WHERE r.traveler_id=t.id AND r.booking_id=? AND r.completed_at IS NULL AND r.revoked_at IS NULL ORDER BY r.created_at DESC LIMIT 1) AS request_expires_at FROM travelers t LEFT JOIN visa_information_submissions s ON s.traveler_id=t.id AND s.booking_id=t.booking_request_id WHERE t.booking_request_id=? ORDER BY t.id`).bind(bookingId,bookingId).all();return json({travelers:results});}catch{return json({error:"Visa information is temporarily unavailable."},503);}
}
const actionSchema=z.object({travelerId:z.number().int().positive(),action:z.enum(["request","revoke","view","status","delete"]),status:z.enum(["received","submitted","approved"]).optional()}).strict();
export async function POST(request:Request,context:Context){
  const owner=await requireOwner("/admin/inquiries");if(!owner||!sameVisaOrigin(request))return json({error:"Not authorized."},403);
  const bookingId=idValue((await context.params).id);if(!bookingId)return json({error:"Invalid inquiry."},400);
  let input:z.infer<typeof actionSchema>;try{input=actionSchema.parse(JSON.parse(new TextDecoder().decode(await boundedVisaBody(request,2000))));}catch{return json({error:"Invalid request."},400);}
  try{
    const {travelerId,action}=input;if(!await visaTraveler(bookingId,travelerId))return json({error:"Traveler not found in this inquiry."},404);
    const db=await visaDb();
    if(action==="request"){const invitation=await createVisaRequest(bookingId,travelerId,owner.email);return json({url:`${new URL(request.url).origin}/visa-information#token=${invitation!.token}`,expiresAt:invitation!.expiresAt});}
    if(action==="view"){
      const row=await db.prepare("SELECT answers,received_at,status FROM visa_information_submissions WHERE traveler_id=? AND booking_id=?").bind(travelerId,bookingId).first<{answers:string;received_at:string;status:string}>();
      if(!row)return json({error:"No information received yet."},404);
      await visaAudit(bookingId,travelerId,"viewed",owner.email);
      return json({answers:JSON.parse(row.answers),receivedAt:row.received_at,status:row.status});
    }
    const now=new Date().toISOString();
    if(action==="revoke"){await db.batch([db.prepare("UPDATE visa_information_requests SET revoked_at=? WHERE traveler_id=? AND booking_id=? AND completed_at IS NULL AND revoked_at IS NULL").bind(now,travelerId,bookingId),db.prepare("INSERT INTO visa_information_audit VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(),bookingId,travelerId,"request_revoked",owner.email,now)]);return json({ok:true});}
    if(action==="status"){
      if(!input.status)return json({error:"Choose a visa status."},400);
      const result=await db.prepare("UPDATE visa_information_submissions SET status=?,updated_at=? WHERE traveler_id=? AND booking_id=?").bind(input.status,now,travelerId,bookingId).run();if(!result.meta.changes)return json({error:"No information received yet."},404);
      await visaAudit(bookingId,travelerId,`status_${input.status}`,owner.email);return json({ok:true});
    }
    await db.batch([
      db.prepare("UPDATE visa_information_requests SET revoked_at=? WHERE traveler_id=? AND booking_id=? AND revoked_at IS NULL").bind(now,travelerId,bookingId),
      db.prepare("DELETE FROM visa_information_documents WHERE traveler_id=? AND booking_id=?").bind(travelerId,bookingId),
      db.prepare("DELETE FROM visa_information_submissions WHERE traveler_id=? AND booking_id=?").bind(travelerId,bookingId),
      db.prepare("INSERT INTO visa_information_audit VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(),bookingId,travelerId,"information_deleted",owner.email,now),
    ]);return json({ok:true});
  }catch{return json({error:"The request could not be completed. Please try again."},503);}
}
