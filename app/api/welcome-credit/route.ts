import { env } from "cloudflare:workers";
import { boundedBody, sameOrigin } from "@/lib/lead-request";
import { signupSchema } from "@/lib/welcome-credit";
import { allowCreditSignup, registerCredit } from "@/lib/welcome-credit-service";
const reply = (body: unknown,status=200) => Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
export async function POST(request: Request) {
  if (!sameOrigin(request)) return reply({error:"Please submit from this website."},403);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return reply({error:"JSON required."},415);
  let raw: unknown;
  try { raw=JSON.parse(await boundedBody(request,8192)); } catch { return reply({error:"Please review your details."},400); }
  const parsed=signupSchema.safeParse(raw);
  if (!parsed.success) return reply({error:"Please enter your name and email and review the signup notice before submitting."},400);
  if (parsed.data.website) return reply({ok:true});
  try {
    if (!env.TURNSTILE_SECRET_KEY || env.SQUARE_ENV!=="production") throw new Error("Unavailable");
    const body=new URLSearchParams({secret:env.TURNSTILE_SECRET_KEY,response:parsed.data.turnstileToken});
    const ip=request.headers.get("CF-Connecting-IP");
    if(ip) body.set("remoteip",ip);
    const response=await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",{method:"POST",body,signal:AbortSignal.timeout(10000)});
    const check=response.ok?await response.json() as {success?:boolean;action?:string;hostname?:string}:null;
    if(!check?.success || check.action!=="welcome_credit" || check.hostname!==new URL(request.url).hostname) return reply({error:"Please complete the human verification again."},400);
    if(!await allowCreditSignup(ip||"unknown")) return reply({error:"Too many attempts. Please try again in an hour."},429);
    await registerCredit(parsed.data);
    return reply({ok:true});
  } catch {
    console.error("Welcome credit subscription incomplete; review the owner credit dashboard.");
    return reply({error:"We could not confirm your signup. Please wait a minute and try again. If you previously unsubscribed or need help, contact trung@cookieparadise.co."},503);
  }
}
