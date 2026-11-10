import { env } from "cloudflare:workers";
import { z } from "zod";
import { requireOwner } from "@/lib/owner-auth";
import { boundedBody, sameOrigin } from "@/lib/lead-request";
import { ensureFollowupHistoryStorage, followupEventId } from "@/lib/followup-history";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request) || !await requireOwner('/admin/inquiries')) return Response.json({ error: 'Forbidden.' }, { status: 403 });
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return Response.json({ error: 'Invalid inquiry.' }, { status: 400 });
  let input;
  try { input = z.object({ action: z.enum(['record', 'undo']), renewedAt: z.string().nullable() }).strict().parse(JSON.parse(await boundedBody(request, 1024))); }
  catch { return Response.json({ error: 'Invalid request.' }, { status: 400 }); }
  await ensureFollowupHistoryStorage();
  const lead = await env.DB!.prepare('SELECT id FROM trip_guide_leads WHERE id=?').bind(id).first();
  if (!lead) return Response.json({ error: 'Request not found.' }, { status: 404 });
  const renewed = await env.DB!.prepare("SELECT cycle_id,created_at FROM inquiry_followup_history WHERE guide_lead_id=? AND event='reopened' ORDER BY julianday(created_at) DESC,rowid DESC LIMIT 1").bind(id).first<{cycle_id:string;created_at:string}>();
  if ((renewed?.created_at ?? null) !== input.renewedAt) return Response.json({ error: 'A newer request arrived. Refresh before recording this email.' }, { status: 409 });
  const cycle = renewed?.cycle_id ?? id;
  const eventId = followupEventId(`guide:${id}`, cycle, 'manual_guide_sent');
  if (input.action === 'undo') {
    await env.DB!.prepare("DELETE FROM inquiry_followup_history WHERE id=? AND event='manual_guide_sent'").bind(eventId).run();
  } else {
    const now = new Date().toISOString();
    await env.DB!.prepare(`INSERT INTO inquiry_followup_history (id,guide_lead_id,cycle_id,event,status,created_at,sent_at,details_json)
      VALUES (?,?,?,'manual_guide_sent','sent',?,?,?) ON CONFLICT DO NOTHING`)
      .bind(eventId,id,cycle,now,now,JSON.stringify({ note: 'Owner confirms guide sent externally; timestamp is when recorded, not verified delivery.' })).run();
  }
  return Response.json({ ok: true }, { headers: { 'Cache-Control': 'private, no-store' } });
}
