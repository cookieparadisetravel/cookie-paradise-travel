import { env } from "cloudflare:workers";
import { boundedBody, sameOrigin } from "@/lib/lead-request";
import { ensureTripGuideStorage } from "@/lib/trip-guide-storage";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return new Response("Invalid origin.", { status: 403 });
  let token: string;
  try { token = new URLSearchParams(await boundedBody(request, 1024)).get("token") ?? ""; }
  catch { return new Response("Invalid request.", { status: 400 }); }
  if (!/^[0-9a-f-]{36}$/i.test(token)) return new Response("Invalid preference link.", { status: 400 });
  await ensureTripGuideStorage();
  await env.DB!.prepare("UPDATE trip_guide_leads SET status='closed' WHERE stop_token=?").bind(token).run();
  return Response.redirect(new URL(`/trip-guide/stop/${token}?saved=1`, request.url), 303);
}
