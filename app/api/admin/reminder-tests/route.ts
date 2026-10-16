import { requireOwner } from "@/lib/owner-auth";
import { hasValidOrigin } from "@/lib/same-origin";
import { hasBookedConsultation } from "@/lib/consultation-calendar";
import { sendInquiryReminderEmail } from "@/lib/mailersend-transactional";

const headers = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  if (!request.headers.get("Origin") || !hasValidOrigin(request)) {
    return Response.json({ error: "Invalid request origin." }, { status: 403, headers });
  }
  const owner = await requireOwner("/admin/reminder-tests");
  if (!owner) return Response.json({ error: "Not authorized." }, { status: 403, headers });
  let payload: Record<string, unknown>;
  try {
    const value: unknown = await request.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid body");
    payload = value as Record<string, unknown>;
  } catch { return Response.json({ error: "Request body must be a JSON object." }, { status: 400, headers }); }

  if (payload.action === "check_calendar") {
    if (Object.keys(payload).some((key) => !["action", "email"].includes(key))
      || typeof payload.email !== "string" || payload.email.length > 254
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(payload.email.trim())) {
      return Response.json({ error: "Enter a valid consultation email to check." }, { status: 400, headers });
    }
    const email = payload.email.trim().toLowerCase();
    try {
      const consultationBooked = await hasBookedConsultation(email);
      return Response.json({ calendarConnected: true, consultationBooked, email }, { headers });
    } catch {
      // Never echo JSON parsing, signing, provider responses or private-key errors.
      return Response.json({ calendarConnected: false, error: "Calendar connection could not be verified. Check that the Google Calendar API is enabled, the calendar secret is saved, and the service account has See all event details permission." }, { status: 502, headers });
    }
  }

  if (payload.action !== "send_previews" || Object.keys(payload).some((key) => key !== "action")) {
    return Response.json({ error: "Invalid reminder test action." }, { status: 400, headers });
  }
  // Recipient is the verified owner, never a customer email supplied by the browser.
  // No inquiry, delivery claim, or consultation-suppression records are modified.
  const deliveries: { reminderDay: 3 | 7; status: "accepted" | "unconfirmed" }[] = [];
  for (const reminderDay of [3, 7] as const) {
    try {
      await sendInquiryReminderEmail({ toEmail: owner.email, toName: "Test Traveler", reminderDay, testPreview: true });
      deliveries.push({ reminderDay, status: "accepted" });
    } catch {
      // A lost provider response may follow acceptance. Do not automatically retry.
      deliveries.push({ reminderDay, status: "unconfirmed" });
    }
  }
  return Response.json({ toEmail: owner.email, deliveries }, { headers });
}
