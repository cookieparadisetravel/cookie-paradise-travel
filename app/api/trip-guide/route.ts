import { env } from "cloudflare:workers";
import { boundedBody, guideRequestSchema, sameOrigin } from "@/lib/lead-request";
import { campaignAttribution } from "@/lib/trip-guide";
import { saveTripGuideLead } from "@/lib/trip-guide-service";
import { referralFromCookie } from "@/lib/salon-referrals";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Please submit from this website." }, { status: 403 });
  if (!request.headers.get("content-type")?.startsWith("application/json")) return Response.json({ error: "JSON is required." }, { status: 415 });
  let raw: unknown;
  try { raw = JSON.parse(await boundedBody(request, 16_384)); }
  catch { return Response.json({ error: "Please review your request and try again." }, { status: 400 }); }
  if (raw && typeof raw === "object" && "website" in raw && raw.website) return Response.json({ ok: true, emailStatus: "not_sent" });
  const parsed = guideRequestSchema.safeParse(raw);
  if (!parsed.success) return Response.json({ error: "Please complete your name, email, city, travel interest and contact permission." }, { status: 400 });
  const secret = env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret || env.SQUARE_ENV !== "production") return Response.json({ error: "The request form is temporarily unavailable. Please book a consultation or try again later." }, { status: 503 });
  try {
    const body = new URLSearchParams({ secret, response: parsed.data.turnstileToken });
    const ip = request.headers.get("CF-Connecting-IP");
    if (ip) body.set("remoteip", ip);
    const check = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body, signal: AbortSignal.timeout(10_000) });
    const verification = check.ok ? await check.json() as { success?: boolean; action?: string; hostname?: string } : null;
    if (!verification?.success || verification.action !== "trip_guide" || verification.hostname !== new URL(request.url).hostname) {
      return Response.json({ error: "Human verification expired. Please try again." }, { status: 400 });
    }
    const { firstName, email, phone, city, timing, marketingConsent, submissionId, attribution } = parsed.data;
    const result = await saveTripGuideLead({ firstName, email, phone, city, timing, marketingConsent,
      submissionId: `website:${submissionId}`, attribution: campaignAttribution(attribution), source: "website",
      referralCode: referralFromCookie(request.headers.get("cookie"))?.code ?? null });
    return Response.json({ ok: true, ...result }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch {
    console.error("Trip guide request could not be completed; review lead delivery status.");
    return Response.json({ error: "We could not finish your request. Please try again or book a consultation." }, { status: 503 });
  }
}
