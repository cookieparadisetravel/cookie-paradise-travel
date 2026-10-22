import { getSalonPartner, REFERRAL_COOKIE, REFERRAL_COOKIE_SECONDS } from "@/lib/salon-referrals";
import { withOpenAIClickReference } from "@/lib/openai-click-reference";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  const partner = getSalonPartner((await context.params).code);
  if (!partner) return new Response("Referral partner not found.", { status: 404 });
  const url = new URL(request.url);
  const secure = url.protocol === "https:" ? "; Secure" : "";
  return new Response(null, { status: 303, headers: {
    Location: new URL(withOpenAIClickReference("/", url.searchParams.get("oppref")), url).toString(),
    "Cache-Control": "private, no-store",
    "Set-Cookie": `${REFERRAL_COOKIE}=${partner.code}; Path=/; Max-Age=${REFERRAL_COOKIE_SECONDS}; HttpOnly; SameSite=Lax${secure}`,
  } });
}
