import { z } from "zod";
import { requireOwner } from "@/lib/owner-auth";
import { boundedVisaBody, sameVisaOrigin, visaHeaders } from "@/lib/visa-information";
import { createVisaRequest, visaDb } from "@/lib/visa-information-storage";
import { buildVisaEmail, type VisaEmailTraveler } from "@/lib/visa-information-email";
import { sendVisaInformationEmail, transactionalEmailConfigured } from "@/lib/mailersend-transactional";
export const dynamic = "force-dynamic";
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: visaHeaders });
const schema = z.object({ travelerId: z.number().int().positive(), operationId: z.string().uuid(), expectedEmail: z.string().email() }).strict();
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const owner = await requireOwner("/admin/inquiries");
  if (!owner || !sameVisaOrigin(request)) return json({ error: "Not authorized." }, 403);
  const { id } = await context.params;
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) return json({ error: "Invalid inquiry." }, 400);
  let input: z.infer<typeof schema>;
  try { input = schema.parse(JSON.parse(new TextDecoder().decode(await boundedVisaBody(request, 2000)))); }
  catch { return json({ error: "Invalid request." }, 400); }
  const bookingId = Number(id);
  try {
    const db = await visaDb();
    const traveler = await db.prepare("SELECT first_name,last_name,email,traveler_type,guardian_legal_name FROM travelers WHERE id=? AND booking_request_id=?").bind(input.travelerId, bookingId).first<VisaEmailTraveler & { email: string }>();
    if (!traveler) return json({ error: "Traveler not found in this inquiry." }, 404);
    if (traveler.email !== input.expectedEmail) return json({ error: "The recipient has changed. Refresh the inquiry and preview again." }, 409);
    if (!transactionalEmailConfigured()) return json({ error: "Email sending is not configured. You can still create and copy a request link." }, 503);
    const previous = await db.prepare("SELECT status,booking_id,traveler_id FROM visa_information_emails WHERE id=?").bind(input.operationId).first<{ status: string; booking_id: number; traveler_id: number }>();
    if (previous) {
      if (previous.booking_id === bookingId && previous.traveler_id === input.travelerId && previous.status === "accepted") return json({ accepted: true });
      return json({ error: "This send has already been attempted. Check email activity before starting another request." }, 409);
    }
    const now = new Date().toISOString();
    // Claim once before calling the provider; concurrent clicks cannot generate multiple messages.
    const claim = await db.prepare("INSERT OR IGNORE INTO visa_information_emails(id,booking_id,traveler_id,recipient_email,status,created_at) SELECT ?,?,?,?,'sending',? WHERE NOT EXISTS(SELECT 1 FROM visa_information_emails WHERE traveler_id=? AND booking_id=? AND created_at>?)").bind(input.operationId, bookingId, input.travelerId, traveler.email, now, input.travelerId, bookingId, new Date(Date.now() - 90000).toISOString()).run();
    if (!claim.meta.changes) return json({ error: "A request was just sent or is being processed. Wait before sending another." }, 409);
    try {
      const invitation = await createVisaRequest(bookingId, input.travelerId, owner.email);
      if (!invitation) throw new Error("Traveler unavailable");
      const url = `https://cookieparadisetravel.com/visa-information#token=${invitation.token}`;
      const result = await sendVisaInformationEmail({ toEmail: traveler.email, toName: traveler.traveler_type === "minor" ? traveler.guardian_legal_name || "Parent or guardian" : `${traveler.first_name} ${traveler.last_name}`, ...buildVisaEmail(traveler, url) });
      await db.batch([
        db.prepare("UPDATE visa_information_emails SET status='accepted',sent_at=?,message_id=? WHERE id=?").bind(result.sentAt, result.messageId, input.operationId),
        db.prepare("INSERT INTO visa_information_audit VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), bookingId, input.travelerId, "request_email_accepted", owner.email, result.sentAt),
      ]);
      return json({ accepted: true });
    } catch {
      await db.prepare("UPDATE visa_information_emails SET status='unconfirmed' WHERE id=?").bind(input.operationId).run();
      // A timeout can occur after acceptance. Keep the link usable; never retry automatically.
      return json({ error: "Email delivery is unconfirmed. Check MailerSend activity before sending again. Any link already emailed remains usable." }, 503);
    }
  } catch { return json({ error: "Unable to confirm this email request. Refresh and check email activity before trying again." }, 503); }
}
