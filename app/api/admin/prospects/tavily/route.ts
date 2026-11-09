import { requireOwner } from "@/lib/owner-auth";
import { boundedBody, sameOrigin } from "@/lib/lead-request";
import { createProspectSchema, settingsSchema, updateProspectSchema } from "@/lib/web-prospects";
import { createProspect, discoverWebProspects, loadProspectDashboard, ProspectError, saveProspectSettings, updateProspect } from "@/lib/web-prospect-service";

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" } });
export async function GET(request: Request) {
  if (!await requireOwner("/admin/prospects/tavily")) return json({ error: "Not authorized." }, 403);
  try { return json(await loadProspectDashboard(new URL(request.url).searchParams, "tavily")); }
  catch { return json({ error: "Prospects could not be loaded. Please try again." }, 503); }
}
export async function POST(request: Request) {
  if (!sameOrigin(request) || !await requireOwner("/admin/prospects/tavily")) return json({ error: "Not authorized." }, 403);
  let input: { action?: unknown; data?: unknown };
  try { input = JSON.parse(await boundedBody(request, 16000)); if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error(); }
  catch { return json({ error: "Please review the submitted details." }, 400); }
  try {
    if (input.action === "scan") return json({ ok: true, result: await discoverWebProspects(false, "tavily") });
    if (input.action === "settings") {
      const data = settingsSchema.safeParse(input.data);
      if (!data.success) return json({ error: "Use a valid year and one to six searches, each at most 450 characters and 65 words." }, 400);
      await saveProspectSettings(data.data, "tavily");
    } else if (input.action === "create") {
      const data = createProspectSchema.safeParse(input.data);
      if (!data.success) return json({ error: "Enter a public source URL, a title, and a valid travel year." }, 400);
      return json({ ok: true, id: await createProspect(data.data) });
    } else if (input.action === "update") {
      const data = updateProspectSchema.safeParse(input.data);
      if (!data.success) return json({ error: "Check the details and follow-up date. A follow-up date needs a next action." }, 400);
      await updateProspect(data.data);
    } else return json({ error: "Unknown action." }, 400);
    return json({ ok: true });
  } catch (error) {
    if (error instanceof ProspectError) return json({ error: error.message }, 409);
    return json({ error: "The update could not be completed. Please try again." }, 503);
  }
}
