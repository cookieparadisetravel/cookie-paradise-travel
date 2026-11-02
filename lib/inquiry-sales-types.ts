import { normalizeInquiryStage } from "./inquiry-stage.ts";

export type SalesProcess = {
  id: string; guideId: string | null; bookingId: number | null;
  name: string; email: string; phone: string; stage: string;
  bookingIntent: string | null; squareEnvironment: string; source: string;
  tripSlug?: string; campaign?: string | null; acquisitionSource?: string | null; activityJson?: string;
  referralCode: string | null; timing: string; nextAction: string; followUpDate: string | null;
  consultationBookedAt: string | null; consultationStartsAt: string | null; consultationCompletedAt: string | null;
  createdAt: string; updatedAt: string;
  invitationStatus: string | null; invitationSentAt: string | null;
};
export const salesStage = (value: string) => value === "consultation_booked" ? "considering" : normalizeInquiryStage(value);
export function indianaDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Indiana/Indianapolis", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export function nextSalesAction(sale: SalesProcess, today: string) {
  if (["closed", "waitlist", "reserved"].includes(salesStage(sale.stage))) return null;
  const followUp=sale.followUpDate && sale.nextAction ? { label:sale.nextAction,date:sale.followUpDate,due:sale.followUpDate<=today } : null;
  if (followUp?.due) return followUp;
  if (sale.consultationBookedAt && !sale.consultationCompletedAt) {
    const day=sale.consultationStartsAt ? indianaDate(new Date(sale.consultationStartsAt)) : null;
    if (day && (!followUp || day<=followUp.date)) return {label:day<today ? "Record consultation outcome and set the next follow-up" : "Prepare for consultation and record its outcome",date:day,due:day<=today};
    if (!followUp) return {label:"Review consultation and record its outcome",date:null,due:false};
  }
  if (followUp) return followUp;
  if (sale.nextAction) return {label:sale.nextAction,date:sale.followUpDate,due:false};
  if (sale.bookingIntent === "ready_to_book") return {label:"Continue booking steps",date:null,due:false};
  return {label:salesStage(sale.stage) === "new" ? "Contact customer and invite them to a free call" : "Set the next follow-up or send a booking link",date:null,due:false};
}
export function salesFunnel(processes: SalesProcess[]) {
  const guides = processes.filter(sale => sale.guideId !== null);
  const count = (rows: SalesProcess[]) => ({ guides: rows.length, calls: rows.filter(sale => sale.consultationBookedAt).length,
    started: rows.filter(sale => sale.bookingId !== null && sale.bookingIntent === "ready_to_book").length,
    reserved: rows.filter(sale => salesStage(sale.stage) === "reserved").length });
  const sources = new Map<string, SalesProcess[]>();
  for (const sale of guides) {
    const label = sale.referralCode ? `Referral: ${sale.referralCode}` : sale.source === "meta" ? "Facebook lead form" : ["facebook","fb","meta"].includes((sale.acquisitionSource || "").toLowerCase()) ? "Facebook landing page" : "Website";
    const campaignLabel=sale.campaign ? `${label} · ${sale.campaign}` : label;
    sources.set(campaignLabel,[...(sources.get(campaignLabel) ?? []),sale]);
  }
  return { ...count(guides), sources: [...sources].map(([source,rows])=>({ source,...count(rows) })) };
}
