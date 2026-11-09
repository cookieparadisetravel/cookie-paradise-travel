import { requireOwner } from "@/lib/owner-auth";
import { sameOrigin } from "@/lib/lead-request";
import { metaSyncStatus, synchronizeMetaLeads } from "@/lib/meta-sync";

const headers = { "Cache-Control": "private, no-store" };
export async function GET() {
  if (!await requireOwner("/admin/inquiries")) return Response.json({ error: "Forbidden." }, { status: 403, headers });
  try { return Response.json(await metaSyncStatus(), { headers }); }
  catch { return Response.json({ error: "Unable to read Facebook sync status." }, { status: 503, headers }); }
}
export async function POST(request: Request) {
  if (!sameOrigin(request) || !await requireOwner("/admin/inquiries")) return Response.json({ error: "Forbidden." }, { status: 403, headers });
  try { return Response.json(await synchronizeMetaLeads(), { headers }); }
  catch { return Response.json({ error: "Sync did not complete. Retry; saved leads will not be duplicated." }, { status: 503, headers }); }
}
