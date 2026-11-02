import { z } from "zod";
import { requireOwner } from "@/lib/owner-auth";
import { boundedBody, sameOrigin } from "@/lib/lead-request";
import { inquiryStageOptions, normalizeInquiryStage } from "@/lib/inquiry-stage";
import { getSalesForGuide, setSalesStage, markSalesConsultation } from "@/lib/inquiry-sales";

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}) {
  if (!sameOrigin(request) || !await requireOwner("/admin/inquiries")) return Response.json({error:"Forbidden."},{status:403});
  const {id}=await params;
  if (!z.string().uuid().safeParse(id).success) return Response.json({error:"Invalid inquiry."},{status:400});
  let value:unknown;
  try {value=JSON.parse(await boundedBody(request,1024));} catch {return Response.json({error:"Invalid request."},{status:400});}
  const parsed=z.object({status:z.string()}).strict().safeParse(value);
  const stage=parsed.success ? normalizeInquiryStage(parsed.data.status) : "";
  if (!inquiryStageOptions.some(([option])=>option===stage)) return Response.json({error:"Invalid stage."},{status:400});
  try {
    const sale=await getSalesForGuide(id);
    if (!sale) return Response.json({error:"Inquiry not found."},{status:404});
    if (parsed.success && parsed.data.status==="consultation_booked") await markSalesConsultation(sale);
    else await setSalesStage(sale,stage);
    return Response.json({ok:true},{headers:{"Cache-Control":"private, no-store"}});
  } catch(error) {return Response.json({error:error instanceof Error ? error.message : "The stage could not be saved."},{status:409});}
}
