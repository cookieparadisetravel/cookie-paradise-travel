import type { DashboardInquiry } from "../app/admin/inquiries/dashboard-types";
import type { GuideLeadRow } from "./lead-inbox";
import { isActiveInquiryStage, normalizeInquiryStage } from "./inquiry-stage.ts";

export type InquiryFeedEntry =
  | { kind: "booking"; key: string; inquiry: DashboardInquiry; guide?: GuideLeadRow }
  | { kind: "guide"; key: string; guide: GuideLeadRow };

export function buildInquiryFeed(inquiries: DashboardInquiry[], guides: GuideLeadRow[]): InquiryFeedEntry[] {
  const bookings = inquiries.map(inquiry => ({ kind: "booking" as const, key: `booking-${inquiry.id}`, inquiry, guide: undefined as GuideLeadRow | undefined }));
  const byId = new Map(bookings.map(entry => [entry.inquiry.id, entry]));
  const unmatched: InquiryFeedEntry[] = [];
  for (const guide of guides) {
    const match = guide.booking_id === null ? undefined : byId.get(guide.booking_id);
    if (match && match.inquiry.squareEnvironment === "production"
      && match.inquiry.email.trim().toLowerCase() === guide.email.trim().toLowerCase()
      && (isActiveInquiryStage(match.inquiry.status) || guide.status === "closed")) {
      match.guide = guide;
    } else {
      unmatched.push({ kind: "guide", key: `guide-${guide.id}`, guide });
    }
  }
  return [...bookings, ...unmatched];
}

export const feedName = (entry: InquiryFeedEntry) => entry.kind === "booking" ? entry.inquiry.fullName : entry.guide.first_name;
export const feedCreatedAt = (entry: InquiryFeedEntry) => {
  const created = entry.kind === "booking" ? entry.inquiry.createdAt : entry.guide.created_at;
  return entry.guide?.renewed_at && new Date(entry.guide.renewed_at).getTime() > new Date(created).getTime() ? entry.guide.renewed_at : created;
};
export const feedDeparture = (entry: InquiryFeedEntry) => entry.kind === "booking" ? entry.inquiry.departure : entry.guide.travel_timing === "june_2027" ? "2027-06-01" : "flexible";
export const feedStage = (entry: InquiryFeedEntry) => normalizeInquiryStage(entry.kind === "booking" ? entry.inquiry.status : entry.guide.status);
export const feedIsActive = (entry: InquiryFeedEntry) => entry.kind === "booking" ? isActiveInquiryStage(entry.inquiry.status) : isActiveInquiryStage(entry.guide.status);
export const feedIsNew = (entry: InquiryFeedEntry) => feedStage(entry) === "new";
export function feedMatchesSearch(entry: InquiryFeedEntry, search: string) {
  const contact = entry.kind === "booking"
    ? [entry.inquiry.fullName, entry.inquiry.email, entry.inquiry.phone, String(entry.inquiry.id)] : [];
  const guide = entry.guide ? [entry.guide.first_name, entry.guide.email, entry.guide.phone, entry.guide.id, entry.guide.city, entry.guide.sources ?? "", entry.guide.campaign ?? "", entry.guide.referral_code ?? ""] : [];
  return [...contact, ...guide].some(value => value.toLowerCase().includes(search.trim().toLowerCase()));
}
