import { env } from "cloudflare:workers";

export const VERIFICATION_CODE_LIFETIME_MINUTES = 10;
export const VERIFICATION_CODE_RESEND_SECONDS = 60;
export const VERIFICATION_CODE_MAX_ATTEMPTS = 5;

export function createVerificationCode() {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return String(values[0] % 1_000_000).padStart(6, "0");
}

export async function hashVerificationCode(invitationId: number, code: string) {
  const runtime = env as unknown as Record<string, string | undefined>;
  const secret = runtime.AGREEMENT_OTP_HASH_KEY?.trim();
  if (!secret) throw new Error("Agreement verification is not configured.");

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${invitationId}:${code}`),
  );
  return bytesToHex(new Uint8Array(signature));
}

export function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export function maskEmail(email: string) {
  const [local = "", domain = ""] = email.split("@");
  if (!domain) return "your recorded email address";
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"•".repeat(Math.max(3, local.length - visible.length))}@${domain}`;
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
