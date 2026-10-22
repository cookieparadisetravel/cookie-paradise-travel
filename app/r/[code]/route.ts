import { getSalonPartner, REFERRAL_COOKIE, REFERRAL_COOKIE_SECONDS } from "@/lib/salon-referrals";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  const partner = getSalonPartner((await context.params).code);
  if (!partner) return new Response("Referral partner not found.", { status: 404 });
  const url = new URL(request.url);
  const secure = url.protocol === "https:" ? "; Secure" : "";
  const landingUrl = new URL("/", url);
  // Preserve the ChatGPT ad click reference through partner attribution redirects.
  const clickRef = url.searchParams.get("oppref");
  if (clickRef && clickRef.length <= 2048) landingUrl.searchParams.set("oppref", clickRef);
  return new Response(null, { status: 303, headers: {
    Location: landingUrl.toString(),
    "Cache-Control": "private, no-store",
    "Set-Cookie": `${REFERRAL_COOKIE}=${partner.code}; Path=/; Max-Age=${REFERRAL_COOKIE_SECONDS}; HttpOnly; SameSite=Lax${secure}`,
  } });
}
