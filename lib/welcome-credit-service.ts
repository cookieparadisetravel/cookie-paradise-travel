import { env } from "cloudflare:workers";
import { ensureCreditStorage } from "./welcome-credit-storage";
import { welcomeGroupId, welcomeConsent, welcomeTerms, type WelcomeCredit } from "./welcome-credit";

export async function allowCreditSignup(ip: string) {
  const db = await ensureCreditStorage(), now = Math.floor(Date.now() / 1000);
  // Store only short-lived hashes, not raw network addresses.
  const bucket = Math.floor(now / 3600);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${bucket}:${ip}`));
  const key = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
  await db.prepare("DELETE FROM welcome_credit_limits WHERE expires_at < ?").bind(now).run();
  const claim = await db.prepare(`INSERT INTO welcome_credit_limits (key,attempts,expires_at) VALUES (?,1,?)
    ON CONFLICT(key) DO UPDATE SET attempts=attempts+1 WHERE attempts<10`).bind(key, now + 7200).run();
  return !!claim.meta.changes;
}
export async function registerCredit(input: { name: string; email: string; source: string }) {
  const token = (env as unknown as Record<string, string | undefined>).MAILERLITE_API_TOKEN?.trim();
  if (!token) throw new Error("Email integration unavailable");
  const db = await ensureCreditStorage(), now = new Date().toISOString(), email = input.email.trim().toLowerCase();
  await db.prepare(`INSERT INTO welcome_credits (id,email,name,source,created_at,consent_text,terms_text)
    VALUES (?,?,?,?,?,?,?) ON CONFLICT(email) DO NOTHING`).bind(crypto.randomUUID(), email, input.name, input.source, now, welcomeConsent, welcomeTerms).run();
  const lease = crypto.randomUUID();
  const claim = await db.prepare(`UPDATE welcome_credits SET sync_lease=?,sync_attempt_at=?
    WHERE email=? AND sync_status!='synced' AND (sync_attempt_at IS NULL OR sync_attempt_at<?)`)
    .bind(lease, now, email, new Date(Date.now()-60000).toISOString()).run();
  if (!claim.meta.changes) {
    const existing = await db.prepare("SELECT sync_status FROM welcome_credits WHERE email=?").bind(email).first<{sync_status:string}>();
    if (existing?.sync_status === "synced") return;
    throw new Error("Please wait a minute before retrying");
  }
  let status = "error";
  try {
    const response = await fetch("https://connect.mailerlite.com/api/subscribers", {
      method:"POST", signal:AbortSignal.timeout(10000),
      headers:{Authorization:`Bearer ${token}`, Accept:"application/json", "Content-Type":"application/json"},
      body:JSON.stringify({email,fields:{name:input.name},groups:[welcomeGroupId],resubscribe:false,opted_in_at:now.replace("T"," ").slice(0,19)}),
    });
    if (response.ok) {
      const result = await response.json() as {data?:{status?:string}};
      status = result.data?.status === "active" ? "synced" : "needs_confirmation";
    }
  } finally {
    await db.prepare("UPDATE welcome_credits SET sync_status=?,sync_lease=NULL WHERE email=? AND sync_lease=?").bind(status,email,lease).run();
  }
  if (status !== "synced") throw new Error("Subscription could not be confirmed");
}
export async function listCredits(query = "") {
  const db = await ensureCreditStorage();
  const search = `%${query.trim().slice(0,180).replace(/[\\%_]/g,"\\$&")}%`;
  const rows = await db.prepare("SELECT id,email,name,source,created_at,sync_status,redeemed_at,booking_reference,redeemed_by FROM welcome_credits WHERE email LIKE ? ESCAPE '\\' OR name LIKE ? ESCAPE '\\' ORDER BY created_at DESC LIMIT 100").bind(search,search).all<WelcomeCredit>();
  return rows.results;
}
export async function redeemCredit(id: string, reference: string, owner: string) {
  const db = await ensureCreditStorage();
  // A single conditional update makes concurrent/repeated claims safe across Workers.
  const result = await db.prepare(`UPDATE welcome_credits SET redeemed_at=?,booking_reference=?,redeemed_by=?
    WHERE id=? AND sync_status='synced' AND redeemed_at IS NULL`)
    .bind(new Date().toISOString(),reference.trim().toLowerCase(),owner,id).run();
  return !!result.meta.changes;
}
