import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { bookingRequests, inquiryOwnerNotes } from "@/db/schema";
import { requireOwner } from "@/lib/owner-auth";
import { hasValidOrigin } from "@/lib/same-origin";
import { MAX_INQUIRY_NOTE_LENGTH } from "@/lib/inquiry-notes";

type Context = { params: Promise<{ id: string }> };
const notePayload = z.object({
  id: z.string().uuid(),
  body: z.string().trim().min(1).max(MAX_INQUIRY_NOTE_LENGTH),
}).strict();
const noteFields = {
  id: inquiryOwnerNotes.id, body: inquiryOwnerNotes.body,
  createdBy: inquiryOwnerNotes.createdBy, createdAt: inquiryOwnerNotes.createdAt,
};

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

async function inquiryId(context: Context) {
  const { id } = await context.params;
  const value = Number(id);
  return /^\d+$/.test(id) && Number.isSafeInteger(value) && value > 0 ? value : null;
}

export async function GET(_request: Request, context: Context) {
  const id = await inquiryId(context);
  if (!id) return json({ error: "Invalid inquiry." }, 400);
  if (!(await requireOwner(`/admin/inquiries/${id}`))) return json({ error: "Not authorized." }, 403);
  try {
    const db = getDb();
    const [inquiry] = await db.select({ id: bookingRequests.id }).from(bookingRequests).where(eq(bookingRequests.id, id)).limit(1);
    if (!inquiry) return json({ error: "Inquiry not found." }, 404);
    const notes = await db.select(noteFields).from(inquiryOwnerNotes)
      .where(eq(inquiryOwnerNotes.bookingRequestId, id))
      .orderBy(desc(inquiryOwnerNotes.createdAt), desc(inquiryOwnerNotes.id));
    return json({ ok: true, notes });
  } catch {
    return json({ error: "Notes are unavailable. Please try again later." }, 503);
  }
}

export async function POST(request: Request, context: Context) {
  if (!hasValidOrigin(request)) return json({ error: "Invalid request origin." }, 403);
  const id = await inquiryId(context);
  if (!id) return json({ error: "Invalid inquiry." }, 400);
  const owner = await requireOwner(`/admin/inquiries/${id}`);
  if (!owner) return json({ error: "Not authorized." }, 403);
  let payload: z.infer<typeof notePayload>;
  try {
    const raw = await request.text();
    if (raw.length > 40000) return json({ error: "The note is too long." }, 400);
    const parsed = notePayload.safeParse(JSON.parse(raw));
    if (!parsed.success) return json({ error: `Enter a note of 1–${MAX_INQUIRY_NOTE_LENGTH.toLocaleString("en-US")} characters.` }, 400);
    payload = parsed.data;
  } catch {
    return json({ error: "Request body must be valid JSON." }, 400);
  }
  try {
    const db = getDb();
    const [inquiry] = await db.select({ id: bookingRequests.id }).from(bookingRequests).where(eq(bookingRequests.id, id)).limit(1);
    if (!inquiry) return json({ error: "Inquiry not found." }, 404);
    // Reusing the submission ID makes retrying a timed-out save safe.
    await db.insert(inquiryOwnerNotes).values({
      id: payload.id, bookingRequestId: id, body: payload.body,
      createdBy: owner.email, createdAt: new Date().toISOString(),
    }).onConflictDoNothing({ target: inquiryOwnerNotes.id });
    const [note] = await db.select(noteFields).from(inquiryOwnerNotes).where(and(
      eq(inquiryOwnerNotes.id, payload.id), eq(inquiryOwnerNotes.bookingRequestId, id),
    )).limit(1);
    if (!note || note.body !== payload.body || note.createdBy !== owner.email) {
      return json({ error: "This submission has already been used. Please reload and try again." }, 409);
    }
    return json({ ok: true, note });
  } catch {
    return json({ error: "The note could not be saved. Please try again." }, 503);
  }
}
