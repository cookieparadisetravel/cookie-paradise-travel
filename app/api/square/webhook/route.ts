import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { bookingRequests } from "@/db/schema";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function decodeBase64(value: string): Uint8Array | null {
  try {
    const binary = atob(value);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

async function hasValidSignature(
  signature: string,
  rawBody: string,
  notificationUrl: string,
  signatureKey: string,
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(signatureKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expected = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(notificationUrl + rawBody),
    ),
  );
  const received = decodeBase64(signature);

  if (!received || received.length !== expected.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) {
    mismatch |= expected[index] ^ received[index];
  }

  return mismatch === 0;
}

function getInvoice(payload: unknown) {
  if (!isRecord(payload) || !isRecord(payload.data)) {
    return null;
  }

  const object = payload.data.object;
  if (!isRecord(object) || !isRecord(object.invoice)) {
    return null;
  }

  return object.invoice;
}

export async function POST(request: Request) {
  const signatureKey = env.SQUARE_WEBHOOK_SIGNATURE_KEY?.trim();
  const notificationUrl = env.SQUARE_WEBHOOK_NOTIFICATION_URL?.trim();

  if (!signatureKey || !notificationUrl) {
    return Response.json(
      { error: "Square webhook configuration is unavailable." },
      { status: 503 },
    );
  }

  const signature = request.headers.get("x-square-hmacsha256-signature");
  const rawBody = await request.text();

  if (
    !signature ||
    !(await hasValidSignature(signature, rawBody, notificationUrl, signatureKey))
  ) {
    return Response.json({ error: "Invalid Square webhook signature." }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isRecord(payload) || typeof payload.type !== "string") {
    return Response.json({ error: "Invalid Square webhook payload." }, { status: 400 });
  }

  if (payload.type !== "invoice.payment_made" && payload.type !== "invoice.updated") {
    return Response.json({ ok: true, ignored: true });
  }

  const invoice = getInvoice(payload);
  if (
    !invoice ||
    typeof invoice.id !== "string" ||
    typeof invoice.status !== "string"
  ) {
    return Response.json({ error: "Square invoice data is incomplete." }, { status: 400 });
  }

  const changes: {
    squareDepositInvoiceStatus: string;
    squareDepositInvoiceUrl?: string;
  } = {
    squareDepositInvoiceStatus: invoice.status.toLowerCase(),
  };

  if (typeof invoice.public_url === "string" && invoice.public_url.length > 0) {
    changes.squareDepositInvoiceUrl = invoice.public_url;
  }

  await getDb()
    .update(bookingRequests)
    .set(changes)
    .where(eq(bookingRequests.squareDepositInvoiceId, invoice.id));

  return Response.json({ ok: true });
}
