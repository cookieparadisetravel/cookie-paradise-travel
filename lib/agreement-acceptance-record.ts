import { env } from "cloudflare:workers";

export type AgreementAcceptanceSnapshot = {
  agreementVersion: string;
  agreementDocumentHash: string;
  agreementCanonicalJson: string;
  invitationId: number;
  travelerId: number;
  bookingRequestId: number;
  travelerName: string;
  travelerType: string;
  signerType: "traveler" | "guardian";
  signerLegalName: string;
  signerEmail: string;
  travelerInitials: string;
  guardianRelationship: string | null;
  minorDateOfBirth: string | null;
  electronicSignatureConsent: true;
  electronicRecordsDisclosureAccepted: true;
  agreementConsent: true;
  depositAcknowledged: true;
  cancellationAcknowledged: true;
  insuranceSelection: "purchased" | "will_purchase" | "declined";
  insuranceProvider: string | null;
  insuranceAcknowledged: true;
  releaseAcknowledged: true;
  agreementViewedToEnd: true;
  photoMediaOptIn: boolean;
  emailVerifiedAt: string;
  acceptedAt: string;
  ipHash: string;
  userAgent: string;
};

export function canonicalizeAcceptanceSnapshot(snapshot: AgreementAcceptanceSnapshot) {
  return JSON.stringify(snapshot);
}

export async function signAcceptanceSnapshot(canonicalSnapshot: string) {
  const runtime = env as unknown as Record<string, string | undefined>;
  const secret = runtime.ACCEPTANCE_RECORD_SIGNING_KEY?.trim();
  if (!secret) throw new Error("Agreement record signing is not configured.");
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
    new TextEncoder().encode(canonicalSnapshot),
  );
  return bytesToHex(new Uint8Array(signature));
}

export async function sha256Hex(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes).buffer);
  return bytesToHex(new Uint8Array(digest));
}

export function retentionUntilForDeparture(departure: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(departure);
  if (!match) throw new Error("A fixed departure date is required before agreement acceptance.");
  const tripStart = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (
    tripStart.getUTCFullYear() !== Number(match[1])
    || tripStart.getUTCMonth() !== Number(match[2]) - 1
    || tripStart.getUTCDate() !== Number(match[3])
  ) {
    throw new Error("The booking departure date is invalid.");
  }
  const tripEnd = new Date(tripStart);
  tripEnd.setUTCDate(tripEnd.getUTCDate() + 7);
  tripEnd.setUTCFullYear(tripEnd.getUTCFullYear() + 7);
  return tripEnd.toISOString();
}

export function isValidPastDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.getUTCFullYear() === Number(match[1])
    && date.getUTCMonth() === Number(match[2]) - 1
    && date.getUTCDate() === Number(match[3])
    && date.getTime() < Date.now();
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
