import { requireOwner } from "@/lib/owner-auth";
import { sameOrigin, boundedBody } from "@/lib/lead-request";
import { redeemSchema } from "@/lib/welcome-credit";
import { redeemCredit } from "@/lib/welcome-credit-service";
export async function POST(request: Request) {
  const owner=await requireOwner("/admin/welcome-credits");
  const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"private, no-store"}});
  if(!owner)return reply({error:"Unauthorized"},401);
  if(!sameOrigin(request))return reply({error:"Invalid origin"},403);
  let parsed;
  try { parsed=redeemSchema.safeParse(JSON.parse(await boundedBody(request,2048))); } catch { return reply({error:"Invalid request"},400); }
  if(!parsed.success)return reply({error:"Enter a booking reference and confirm the credit was applied."},400);
  try {
    if(!await redeemCredit(parsed.data.id,parsed.data.bookingReference,owner.email))return reply({error:"This credit is already used or its subscription is not confirmed. Refresh the page."},409);
    return reply({ok:true});
  }catch{return reply({error:"Could not save. This booking reference may already have a credit; refresh and check before trying again."},409);}
}
