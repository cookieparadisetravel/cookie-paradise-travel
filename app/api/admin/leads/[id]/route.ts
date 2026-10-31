import { env } from "cloudflare:workers";
import { z } from "zod";
import { requireOwner } from "@/lib/owner-auth";
import { boundedBody, sameOrigin } from "@/lib/lead-request";
import { leadStages } from "@/lib/trip-guide";
import { ensureTripGuideStorage } from "@/lib/trip-guide-storage";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request) || !await requireOwner("/admin/leads")) return Response.json({ error: "Forbidden." }, { status: 403 });
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return Response.json({ error: "Invalid lead." }, { status: 400 });
  let raw: unknown;
  try { raw = JSON.parse(await boundedBody(request, 1024)); } catch { return Response.json({ error: "Invalid request." }, { status: 400 }); }
  const parsed = z.object({ status: z.enum(leadStages) }).strict().safeParse(raw);
  if (!parsed.success) return Response.json({ error: "Invalid stage." }, { status: 400 });
  await ensureTripGuideStorage();
  const status = parsed.data.status;
  const timestamp = new Date().toISOString();
  const row = await env.DB!.prepare(`UPDATE trip_guide_leads SET status=?,
    contacted_at=CASE WHEN ?='contacted' THEN coalesce(contacted_at,?) ELSE contacted_at END,
    consultation_booked_at=CASE WHEN ?='consultation_booked' THEN coalesce(consultation_booked_at,?) ELSE consultation_booked_at END
    WHERE id=? RETURNING id`).bind(status,status,timestamp,status,timestamp,id).first();
  if (!row) return Response.json({ error: "Lead not found." }, { status: 404 });
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
