import { indianaDate, nextSalesAction, type SalesProcess } from "./inquiry-sales-types.ts";
import { normalizeInquiryStage } from "./inquiry-stage.ts";
import type { DashboardInquiry } from "../app/admin/inquiries/dashboard-types.ts";
import type { GuideLeadRow } from "./lead-inbox.ts";
import { guideEmailState } from "./guide-email-state.ts";
export function workspaceOverview(inquiries:DashboardInquiry[],leads:GuideLeadRow[],processes:SalesProcess[],today=indianaDate()){
  const bookings=inquiries.filter(row=>row.squareEnvironment==="production"),sales=processes.filter(row=>row.squareEnvironment==="production");
  const reserved=bookings.filter(row=>normalizeInquiryStage(row.status)==="reserved");
  const actions=sales.map(sale=>({sale,action:nextSalesAction(sale,today)})).filter(({sale,action})=>action&&(sale.bookingId!==null||leads.find(lead=>lead.id===sale.guideId)?.contact_permission!==0));
  const priority=({sale,action}:typeof actions[number])=>action?.due?0:sale.stage==="new"?1:sale.consultationBookedAt&&!sale.consultationCompletedAt?2:action?.date?3:4;
  actions.sort((a,b)=>priority(a)-priority(b)||(a.action?.date||"9999").localeCompare(b.action?.date||"9999")||a.sale.createdAt.localeCompare(b.sale.createdAt));
  return {metrics:{guides:leads.length,calls:sales.filter(sale=>sale.consultationBookedAt).length,started:bookings.filter(row=>row.bookingIntent==="ready_to_book"&&!["closed","waitlist"].includes(normalizeInquiryStage(row.status))).length,reservedTravelers:reserved.reduce((sum,row)=>sum+row.partySize,0)},
    actions:actions.map(({sale,action})=>({id:sale.id,name:sale.name,label:action!.label,date:action!.date,due:action!.due,href:sale.bookingId?`/admin/inquiries/${sale.bookingId}?section=overview`:`/admin/inquiries/guide/${sale.guideId}`})),
    guideReview:leads.filter(lead=>["needs_guide","guide_review"].includes(guideEmailState(lead).bucket)).length};
}
