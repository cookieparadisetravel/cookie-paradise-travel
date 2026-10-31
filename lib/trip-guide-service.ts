import { env } from "cloudflare:workers";
import { ensureTripGuideStorage } from "./trip-guide-storage";
import { sendTripGuideEmail } from "./trip-guide-email";
import { addConsentedSubscriber } from "./mailerlite";
import { sendTripGuideEmailMessage } from "./mailersend-transactional";
import { boundedText, campaignAttribution, type CampaignAttribution, type LeadSource, type LeadTiming } from "./trip-guide";

export type TripGuideInput = {
  firstName: string; email: string; phone: string; city: string; timing: LeadTiming;
  marketingConsent: boolean; referralCode: string | null; source: LeadSource;
  submissionId: string; formId?: string; submittedAt?: string; attribution: CampaignAttribution;
};
export async function saveTripGuideLead(input: TripGuideInput) {
  if (env.SQUARE_ENV !== "production") throw new Error("Lead intake is available on the production website only.");
  await ensureTripGuideStorage();
  const db = env.DB!;
  const now = new Date().toISOString();
  const submittedAt = input.source === "meta" && input.submittedAt ? new Date(input.submittedAt).toISOString() : now;
  const id = crypto.randomUUID();
  const stopToken = crypto.randomUUID();
  const email = input.email.trim().toLowerCase();
  const attribution = campaignAttribution(input.attribution);
  // One lead per normalized email, with an immutable record of each source submission.
  // Public resubmissions cannot reopen a closed lead or replace another person's details.
  const batch = await db.batch([
    db.prepare(`INSERT INTO trip_guide_leads (id,first_name,email,phone,city,travel_timing,referral_code,source,contact_consented_at,stop_token,created_at)
      SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM trip_guide_submissions WHERE id=?)
      ON CONFLICT(email) DO NOTHING RETURNING id`)
      .bind(id,input.firstName,email,input.phone,input.city,input.timing,input.referralCode,input.source,submittedAt,stopToken,submittedAt,input.submissionId),
    db.prepare(`INSERT INTO trip_guide_submissions (id,lead_id,source,form_id,utm_source,utm_medium,utm_campaign,utm_content,utm_term,audience,campaign_id,ad_set_id,ad_id,marketing_consent,created_at)
      SELECT ?,id,?,?,?,?,?,?,?,?,?,?,?,?,? FROM trip_guide_leads WHERE email=?
      ON CONFLICT(id) DO NOTHING RETURNING id`)
      .bind(input.submissionId,input.source,input.formId ?? "",attribution.utmSource,attribution.utmMedium,attribution.utmCampaign,attribution.utmContent,attribution.utmTerm,attribution.audience,attribution.campaignId,attribution.adSetId,attribution.adId,input.marketingConsent ? 1 : 0,submittedAt,email),
  ]);
  const created = Boolean(batch[0].results?.length);
  const submission = await db.prepare(`SELECT l.email FROM trip_guide_submissions s JOIN trip_guide_leads l ON l.id=s.lead_id WHERE s.id=?`).bind(input.submissionId).first<{ email: string }>();
  if (submission?.email !== email) throw new Error("Submission identifier is already in use.");
  if (input.marketingConsent && batch[1].results?.length) {
    const consent = await db.prepare(`UPDATE trip_guide_leads SET marketing_consent=1,marketing_consented_at=?,mailerlite_status='pending'
      WHERE email=? AND marketing_consent=0 AND status!='closed' RETURNING id`).bind(now,email).first();
    if (consent) {
      const status = await addConsentedSubscriber({ firstName: input.firstName, lastName: "", email });
      await db.prepare("UPDATE trip_guide_leads SET mailerlite_status=? WHERE email=?").bind(status,email).run();
    }
  }
  if (!created) return { created: false, emailStatus: "already_requested", eventId: input.submissionId };
  let emailStatus = "not_configured";
  if (env.MAILERSEND_API_TOKEN?.trim() && env.MAILERSEND_FROM_EMAIL?.trim()) {
    // Claim before contacting the mail provider. Ambiguous failures are never resent automatically.
    const claim = await db.prepare(`UPDATE trip_guide_leads SET guide_email_status='sending',guide_email_claimed_at=?
      WHERE id=? AND guide_email_status='pending' RETURNING id`).bind(now,id).first();
    if (claim) {
      try {
        const sent = await sendTripGuideEmail({ toEmail: email, firstName: input.firstName, timing: input.timing, stopToken });
        emailStatus = "sent";
        await db.prepare(`UPDATE trip_guide_leads SET guide_email_status='sent',guide_email_sent_at=?,guide_email_message_id=? WHERE id=?`)
          .bind(sent.sentAt,sent.messageId,id).run();
      } catch {
        emailStatus = "failed";
        await db.prepare("UPDATE trip_guide_leads SET guide_email_status='failed' WHERE id=?").bind(id).run();
      }
    }
  } else {
    await db.prepare("UPDATE trip_guide_leads SET guide_email_status='not_configured' WHERE id=?").bind(id).run();
  }
  const runtime = env as unknown as Record<string, string | undefined>;
  let ownerStatus = "not_configured";
  if (env.ADMIN_OWNER_EMAIL && env.MAILERSEND_API_TOKEN?.trim() && env.MAILERSEND_FROM_EMAIL?.trim()) {
    try {
      const text = [`New Vietnam trip guide request`, `Name: ${input.firstName}`, `Email: ${email}`, `Phone: ${input.phone || "Not provided"}`, `City: ${input.city}`, `Interest: ${input.timing}`, `Source: ${input.source}`, `Campaign: ${boundedText(attribution.utmCampaign) || "Not provided"}`, `Guide email: ${emailStatus}`, "", "Review and update this lead:", "https://cookieparadisetravel.com/admin/leads"].join("\n");
      const escaped = text.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
      await sendTripGuideEmailMessage({ toEmail: env.ADMIN_OWNER_EMAIL.trim(), toName: "Trung", subject: "New Vietnam trip guide inquiry", text, html: `<pre style="font:15px/1.7 Arial,sans-serif;white-space:pre-wrap">${escaped}</pre><p><a href="https://cookieparadisetravel.com/admin/leads">Open guide leads</a></p>` });
      ownerStatus = "sent";
    } catch { ownerStatus = "error"; }
  } else if (runtime.OWNER_NOTIFICATION_WEBHOOK_URL) {
    try {
      const response = await fetch(runtime.OWNER_NOTIFICATION_WEBHOOK_URL, {
        method: "POST", signal: AbortSignal.timeout(5000), headers: { "content-type": "application/json" },
        body: JSON.stringify({ event: "travel_guide.requested", submittedAt: now,
          lead: { id, firstName: input.firstName, email, phone: input.phone, city: input.city,
            timing: input.timing, source: input.source, campaign: boundedText(attribution.utmCampaign),
            referralCode: input.referralCode, emailStatus, dashboardUrl: "https://cookieparadisetravel.com/admin/leads" } }),
      });
      ownerStatus = response.ok ? "sent" : "error";
    } catch { ownerStatus = "error"; }
  }
  await db.prepare("UPDATE trip_guide_leads SET owner_notification_status=? WHERE id=?").bind(ownerStatus,id).run();
  return { created: true, emailStatus, eventId: input.submissionId };
}
