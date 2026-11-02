import { z } from "zod";
import { requireOwner } from "@/lib/owner-auth";
import { boundedBody, sameOrigin } from "@/lib/lead-request";
import { getSalesProcess, saveSalesFollowUp, setSalesStage, markSalesConsultation, completeSalesConsultation } from "@/lib/inquiry-sales";
import { sendSalesBookingInvitation } from "@/lib/inquiry-booking-invitations";

const payloadSchema=z.discriminatedUnion("action",[
  z.object({action:z.literal("followup"),nextAction:z.string().trim().max(500),dueDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()}).strict(),
  z.object({action:z.literal("contacted")}).strict(),
  z.object({action:z.literal("consultation_booked")}).strict(),
  z.object({action:z.literal("consultation_completed")}).strict(),
  z.object({action:z.literal("start_booking"),submissionId:z.string().uuid()}).strict(),
]);
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"private, no-store"}});
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}) {
  if (!sameOrigin(request) || !await requireOwner("/admin/inquiries")) return json({error:"Not authorized."},403);
  const {id}=await params;
  if (!/^[gb]_[a-zA-Z0-9_-]{1,256}$/.test(id)) return json({error:"Invalid inquiry."},400);
  let payload:z.infer<typeof payloadSchema>;
  try { payload=payloadSchema.parse(JSON.parse(await boundedBody(request,4096))); }
  catch {return json({error:"Please review the follow-up details."},400);}
  try {
    const sale=await getSalesProcess(id);
    if (!sale) return json({error:"Inquiry not found."},404);
    if (payload.action==="followup") {
      if (payload.dueDate && (!payload.nextAction || (Number.isNaN(Date.parse(`${payload.dueDate}T12:00:00Z`)) || new Date(`${payload.dueDate}T12:00:00Z`).toISOString().slice(0,10)!==payload.dueDate))) return json({error:"Enter a next action and a valid follow-up date."},400);
      await saveSalesFollowUp(sale,payload.nextAction,payload.dueDate);
    } else if (payload.action==="contacted") {
      if (sale.stage==="new") await setSalesStage(sale,"considering");
    } else if (payload.action==="consultation_booked") await markSalesConsultation(sale);
    else if (payload.action==="consultation_completed") await completeSalesConsultation(sale);
    else return json({ok:true,...await sendSalesBookingInvitation(sale,payload.submissionId)});
    return json({ok:true});
  } catch (error) {
    return json({error:error instanceof Error ? error.message : "The update could not be saved."},409);
  }
}
