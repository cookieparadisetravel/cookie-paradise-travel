import { env } from "cloudflare:workers";
import { ensureTripGuideStorage } from "./trip-guide-storage";
import { ensureFollowupHistoryStorage, followupEventId, claimFollowupEvent, finishFollowupEvent } from "./followup-history";
import { sendTripGuideEmail } from "./trip-guide-email";
import { addConsentedSubscriber } from "./mailerlite";
import { sendTripGuideEmailMessage } from "./mailersend-transactional";
import { boundedText, campaignAttribution, type CampaignAttribution, type LeadSource, type LeadTiming } from "./trip-guide";

export type TripGuideInput = {
  firstName: string; email: string; phone: string; city: string; timing: LeadTiming;
  marketingConsent: boolean; referralCode: string | null; source: LeadSource;
  submissionId: string; formId?: string; submittedAt?: string; attribution: CampaignAttribution;
  contactConsent?: boolean; followupMode?: "manual" | "guide_only";
};
// Cutover prevents historical recovery from emailing an old, previously unseen lead.
export const metaGuideAutomationStartsAt = "2026-11-10T20:06:16Z";
export async function saveMetaDashboardLead(input: TripGuideInput) {
  const eligible = Boolean(input.submittedAt)
    && Date.parse(input.submittedAt!) >= Date.parse(metaGuideAutomationStartsAt);
  return saveTripGuideLead({ ...input, source: "meta", contactConsent: input.contactConsent === true,
    marketingConsent: false, followupMode: eligible ? "guide_only" : "manual" });
}
export async function saveTripGuideLead(input: TripGuideInput) {
  if (env.SQUARE_ENV !== "production") throw new Error("Lead intake is available on the production website only.");
  await ensureTripGuideStorage();
  await ensureFollowupHistoryStorage();
  const db = env.DB!;
  const now = new Date().toISOString();
  const submittedAt = input.source === "meta" && input.submittedAt ? new Date(input.submittedAt).toISOString() : now;
  let id = crypto.randomUUID();
  let stopToken = crypto.randomUUID();
  const email = input.email.trim().toLowerCase();
  const attribution = campaignAttribution(input.attribution);
  const contactConsent = input.contactConsent ?? true;
  // A requested guide is fulfilled separately from permission for later contact.
  // Restrict this exception to the approved Meta guide intake, not other forms.
  const followupMode = input.source === "meta" && input.followupMode === "guide_only"
    ? "guide_only" : !contactConsent ? "manual" : input.followupMode ?? "automatic";
  // One lead per normalized email, with an immutable record of each source submission.
  // Only a distinct new submission can reopen a closed lead; delivery replays remain inert.
  const batch = await db.batch([
    db.prepare(`INSERT INTO trip_guide_leads (id,first_name,email,phone,city,travel_timing,referral_code,source,contact_consented_at,stop_token,created_at,guide_email_status,owner_notification_status)
      SELECT ?,?,?,?,?,?,?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM trip_guide_submissions WHERE id=?)
      ON CONFLICT(email) DO NOTHING RETURNING id`)
      .bind(id,input.firstName,email,input.phone,input.city,input.timing,input.referralCode,input.source,contactConsent ? submittedAt : "",stopToken,submittedAt,followupMode === "manual" ? "manual_follow_up" : "pending",followupMode === "manual" ? "not_requested" : "pending",input.submissionId),
    db.prepare(`INSERT INTO trip_guide_submissions (id,lead_id,source,form_id,utm_source,utm_medium,utm_campaign,utm_content,utm_term,audience,campaign_id,ad_set_id,ad_id,marketing_consent,created_at)
      SELECT ?,id,?,?,?,?,?,?,?,?,?,?,?,?,? FROM trip_guide_leads WHERE email=?
      ON CONFLICT(id) DO NOTHING RETURNING id`)
      .bind(input.submissionId,input.source,input.formId ?? "",attribution.utmSource,attribution.utmMedium,attribution.utmCampaign,attribution.utmContent,attribution.utmTerm,attribution.audience,attribution.campaignId,attribution.adSetId,attribution.adId,input.marketingConsent ? 1 : 0,submittedAt,email),
    db.prepare(`INSERT INTO trip_guide_submission_preferences (submission_id,contact_consent,followup_mode)
      SELECT s.id,?,? FROM trip_guide_submissions s JOIN trip_guide_leads l ON l.id=s.lead_id
      WHERE s.id=? AND l.email=? ON CONFLICT(submission_id) DO NOTHING`)
      .bind(contactConsent ? 1 : 0,followupMode,input.submissionId,email),
  ]);
  const created = Boolean(batch[0].results?.length);
  const submission = await db.prepare(`SELECT l.id,l.email,l.stop_token FROM trip_guide_submissions s JOIN trip_guide_leads l ON l.id=s.lead_id WHERE s.id=?`).bind(input.submissionId).first<{ id: string; email: string; stop_token: string }>();
  if (submission?.email !== email) throw new Error("Submission identifier is already in use.");
  id = submission.id;
  stopToken = submission.stop_token;
  let reopened = false;
  if (!created && batch[1].results?.length) {
    const eventId = followupEventId(`guide:${id}`, input.submissionId, "reopened");
    const details = JSON.stringify({ firstName: input.firstName, phone: input.phone, city: input.city,
      timing: input.timing, source: input.source, referralCode: input.referralCode });
    // Record the new cycle and reopen atomically. An older delayed Meta delivery cannot
    // replace a newer submission or a closure recorded after its original submission time.
    const renewal = await db.batch([
      db.prepare(`INSERT INTO inquiry_followup_history
        (id,guide_lead_id,cycle_id,event,status,created_at,details_json)
        SELECT ?,id,?,'reopened','new',?,? FROM trip_guide_leads l
        WHERE id=? AND status='closed' AND julianday(?)>=julianday(l.created_at)
        AND NOT EXISTS (SELECT 1 FROM trip_guide_submissions s WHERE s.lead_id=l.id AND julianday(s.created_at)>julianday(?))
        AND NOT EXISTS (SELECT 1 FROM inquiry_followup_history h WHERE h.guide_lead_id=l.id AND h.event='closed' AND julianday(h.created_at)>julianday(?))
        ON CONFLICT DO NOTHING RETURNING id`).bind(eventId,input.submissionId,submittedAt,details,id,submittedAt,submittedAt,submittedAt),
      db.prepare(`UPDATE trip_guide_leads SET status='new' WHERE id=? AND status='closed'
        AND EXISTS (SELECT 1 FROM inquiry_followup_history WHERE id=?)`).bind(id,eventId),
    ]);
    reopened = Boolean(renewal[0].results?.length);
  }
  if (input.marketingConsent && followupMode === "automatic" && batch[1].results?.length) {
    const consent = await db.prepare(`UPDATE trip_guide_leads SET marketing_consent=1,marketing_consented_at=?,mailerlite_status='pending'
      WHERE email=? AND (marketing_consent=0 OR mailerlite_status IN ('error','not_configured')) AND status!='closed' RETURNING id`).bind(now,email).first();
    if (consent) {
      const [firstName, ...lastName] = input.firstName.trim().split(/\s+/);
      const status = await addConsentedSubscriber({ firstName, lastName: lastName.join(" "), email }, { groupName: "Interest List" });
      await db.prepare("UPDATE trip_guide_leads SET mailerlite_status=? WHERE email=?").bind(status,email).run();
    }
  }
  if (!created && !reopened) return { created: false, emailStatus: "already_requested", eventId: input.submissionId };
  if (followupMode === "manual") {
    if (reopened) {
      const claim = await claimFollowupEvent({ guideId: id, cycle: input.submissionId, event: "guide_email", at: now });
      if (claim) await finishFollowupEvent(claim, "manual_follow_up");
    }
    return { created, reopened, emailStatus: "manual_follow_up", eventId: input.submissionId };
  }
  let emailStatus = "not_configured";
  if (env.MAILERSEND_API_TOKEN?.trim() && env.MAILERSEND_FROM_EMAIL?.trim()) {
    // Claim before contacting the mail provider. Ambiguous failures are never resent automatically.
    const historyClaim = reopened ? await claimFollowupEvent({ guideId: id, cycle: input.submissionId, event: "guide_email", at: now }) : null;
    const claim = reopened ? historyClaim : await db.prepare(`UPDATE trip_guide_leads SET guide_email_status='sending',guide_email_claimed_at=?
      WHERE id=? AND guide_email_status='pending' RETURNING id`).bind(now,id).first();
    if (claim) {
      try {
        const sent = await sendTripGuideEmail({ toEmail: email, firstName: input.firstName, timing: input.timing, stopToken, includeReminders: followupMode === "automatic" });
        emailStatus = "sent";
        if (historyClaim) await finishFollowupEvent(historyClaim, "sent", sent);
        else await db.prepare(`UPDATE trip_guide_leads SET guide_email_status='sent',guide_email_sent_at=?,guide_email_message_id=? WHERE id=?`)
          .bind(sent.sentAt,sent.messageId,id).run();
      } catch {
        emailStatus = "failed";
        if (historyClaim) await finishFollowupEvent(historyClaim, "failed");
        else await db.prepare("UPDATE trip_guide_leads SET guide_email_status='failed' WHERE id=?").bind(id).run();
      }
    }
  } else if (reopened) {
    const claim = await claimFollowupEvent({ guideId: id, cycle: input.submissionId, event: "guide_email", at: now });
    if (claim) await finishFollowupEvent(claim, "not_configured");
  } else {
    await db.prepare("UPDATE trip_guide_leads SET guide_email_status='not_configured' WHERE id=?").bind(id).run();
  }
  const runtime = env as unknown as Record<string, string | undefined>;
  const ownerEmail = runtime.OWNER_NOTIFICATION_EMAIL?.trim() || runtime.ADMIN_OWNER_EMAIL?.trim();
  let ownerStatus = "not_configured";
  const ownerClaim = reopened ? await claimFollowupEvent({ guideId: id, cycle: input.submissionId, event: "owner_notification", at: now }) : null;
  if ((!reopened || ownerClaim) && ownerEmail && env.MAILERSEND_API_TOKEN?.trim() && env.MAILERSEND_FROM_EMAIL?.trim()) {
    try {
      const text = [reopened ? "Returning Vietnam trip guide inquiry (reopened)" : "New Vietnam trip guide request", `Name: ${input.firstName}`, `Email: ${email}`, `Phone: ${input.phone || "Not provided"}`, `City: ${input.city}`, `Interest: ${input.timing}`, `Source: ${input.source}`, `Campaign: ${boundedText(attribution.utmCampaign) || "Not provided"}`, `Guide email: ${emailStatus}`, "", "Review this inquiry:", `https://cookieparadisetravel.com/admin/inquiries/guide/${id}`].join("\n");
      const escaped = text.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
      await sendTripGuideEmailMessage({ toEmail: ownerEmail, toName: "Trung", subject: reopened ? "Returning Vietnam trip guide inquiry" : "New Vietnam trip guide inquiry", text, html: `<pre style="font:15px/1.7 Arial,sans-serif;white-space:pre-wrap">${escaped}</pre><p><a href="https://cookieparadisetravel.com/admin/inquiries/guide/${id}">Open inquiry</a></p>` });
      ownerStatus = "sent";
    } catch { ownerStatus = "error"; }
  } else if ((!reopened || ownerClaim) && runtime.OWNER_NOTIFICATION_WEBHOOK_URL) {
    try {
      const response = await fetch(runtime.OWNER_NOTIFICATION_WEBHOOK_URL, {
        method: "POST", signal: AbortSignal.timeout(5000), headers: { "content-type": "application/json" },
        body: JSON.stringify({ event: reopened ? "travel_guide.reopened" : "travel_guide.requested", submittedAt: now,
          lead: { id, firstName: input.firstName, email, phone: input.phone, city: input.city,
            timing: input.timing, source: input.source, campaign: boundedText(attribution.utmCampaign),
            referralCode: input.referralCode, emailStatus, dashboardUrl: `https://cookieparadisetravel.com/admin/inquiries/guide/${id}` } }),
      });
      ownerStatus = response.ok ? "sent" : "error";
    } catch { ownerStatus = "error"; }
  }
  if (reopened) { if (ownerClaim) await finishFollowupEvent(ownerClaim, ownerStatus); }
  else await db.prepare("UPDATE trip_guide_leads SET owner_notification_status=? WHERE id=?").bind(ownerStatus,id).run();
  return { created, reopened, emailStatus, eventId: input.submissionId };
}
