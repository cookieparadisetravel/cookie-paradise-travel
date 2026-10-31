import { z } from "zod";
import { leadCities, leadTimings } from "./trip-guide.ts";

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  try { return !!origin && new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}

export async function boundedBody(request: Request, limit: number) {
  if (Number(request.headers.get("content-length")) > limit) throw new Error("Request is too large.");
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) { await reader.cancel(); throw new Error("Request is too large."); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

const safeText = (length: number) => z.string().trim().min(1).max(length).refine(value => !/[\u0000-\u001f\u007f]/.test(value));
export const guideRequestSchema = z.object({
  firstName: safeText(60), email: z.string().trim().toLowerCase().email().max(180),
  phone: z.string().trim().max(40).default(""), city: z.enum(leadCities), timing: z.enum(leadTimings),
  contactConsent: z.literal(true), marketingConsent: z.boolean().default(false),
  submissionId: z.string().uuid(), turnstileToken: z.string().min(1).max(2048),
  website: z.string().max(500).default(""), attribution: z.unknown().optional(),
}).strict();
