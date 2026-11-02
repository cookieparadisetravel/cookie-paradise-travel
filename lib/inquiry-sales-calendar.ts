import { env } from "cloudflare:workers";
import { ensureInquirySalesStorage } from "./inquiry-sales-storage";
import { getSalesProcess, markSalesConsultation } from "./inquiry-sales";
import { findCustomerConsultation } from "./consultation-calendar";

export async function synchronizeInquiryConsultations(now=new Date()) {
  const result={checked:0,booked:0,failed:0};
  if (env.SQUARE_ENV!=="production" || !env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON || !env.CONSULTATION_CALENDAR_ID) return {...result,paused:true};
  await ensureInquirySalesStorage();
  const {results}=await env.DB!.prepare(`SELECT p.id FROM inquiry_sales p LEFT JOIN booking_requests b ON b.id=p.booking_request_id
    LEFT JOIN trip_guide_leads l ON l.id=p.guide_lead_id WHERE p.archived_at IS NULL AND coalesce(b.square_environment,'production')='production'
    AND coalesce(b.status,l.status) IN ('new','considering','contacted','consultation_booked') AND p.consultation_starts_at IS NULL
    ORDER BY coalesce(p.calendar_checked_at,'') ASC,p.created_at ASC LIMIT 25`).all<{id:string}>();
  for (const row of results) {
    const sale=await getSalesProcess(row.id);
    if (!sale) continue;
    try {
      const since=new Date(sale.createdAt.includes("T") ? sale.createdAt : `${sale.createdAt.replace(" ","T")}Z`).toISOString();
      const appointment=await findCustomerConsultation(sale.email,since);
      if (appointment) {await markSalesConsultation(sale,appointment.startsAt);result.booked++;}
      result.checked++;
    } catch {result.failed++;}
    // Rotate unsuccessful lookups too; one unreachable calendar must not starve later inquiries.
    await env.DB!.prepare("UPDATE inquiry_sales SET calendar_checked_at=? WHERE id=?").bind(now.toISOString(),row.id).run();
  }
  return result;
}
