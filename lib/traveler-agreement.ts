import agreementV1 from "./traveler-agreement-v1.json" with { type: "json" };

export type AgreementSegment = {
  text: string;
  strong: boolean;
};

export type AgreementBlock =
  | { type: "paragraph"; segments: AgreementSegment[] }
  | { type: "table"; headers: string[]; rows: string[][] };

export type AgreementSection = {
  heading: string;
  level: 1 | 2;
  blocks: AgreementBlock[];
};

export type AgreementDocument = {
  version: string;
  effectiveDate: string;
  title: string;
  sections: AgreementSection[];
};

const approvedAgreementV1 = agreementV1 as AgreementDocument;

// Agreement 1.0 was approved for interim operational use on October 6, 2026.
// Each invitation stores the complete personalized document and its SHA-256 hash.
export const currentTravelerAgreement: AgreementDocument = approvedAgreementV1;

export function buildPersonalizedTravelerAgreement(input: {
  travelerName: string;
  departure: string;
  occupancy: string;
  tripPriceCents: number;
}) {
  const summary: AgreementSection = {
    heading: "Trip summary",
    level: 1,
    blocks: [{
      type: "table",
      headers: ["Item", "Confirmed information"],
      rows: [
        ["Traveler", input.travelerName],
        ["Departure", formatCalendarDate(input.departure)],
        ["Trip", "Discover Southern Vietnam — 8 days / 7 nights"],
        ["Occupancy", input.occupancy],
        ["Trip Price", money(input.tripPriceCents)],
        ["Agreement", `Version ${approvedAgreementV1.version} — Effective ${approvedAgreementV1.effectiveDate}`],
      ],
    }],
  };
  const acceptance: AgreementSection = {
    heading: "Traveler acknowledgment and acceptance",
    level: 1,
    blocks: [paragraph("By electronically accepting this Agreement, the traveler confirms that the traveler has reviewed the itinerary, confirmed Trip Price, payment and cancellation terms, inclusions and exclusions, physical and travel risks, insurance recommendation, Appendix B, and Appendix C; has had an opportunity to ask questions; and agrees to be bound by this Agreement. Exact installment amounts and due dates, when applicable, are presented through Square’s hosted invoice and payment process. Each adult traveler must complete a separate acceptance before an invoice is issued for that traveler. A payer’s signature does not accept another adult traveler’s risk terms.")],
  };

  return {
    ...approvedAgreementV1,
    sections: [summary, ...approvedAgreementV1.sections, acceptance],
  } satisfies AgreementDocument;
}

export function canonicalizeAgreement(document: AgreementDocument) {
  return JSON.stringify(document);
}

export function parseAgreementDocument(value: string): AgreementDocument | null {
  try {
    const parsed = JSON.parse(value) as Partial<AgreementDocument>;
    if (
      typeof parsed.version !== "string"
      || typeof parsed.effectiveDate !== "string"
      || typeof parsed.title !== "string"
      || !Array.isArray(parsed.sections)
    ) return null;
    return parsed as AgreementDocument;
  } catch {
    return null;
  }
}

export async function hashAgreementDocument(document: AgreementDocument) {
  const bytes = new TextEncoder().encode(canonicalizeAgreement(document));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hashInvitationToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function isValidInvitationToken(token: string) {
  return /^[A-Za-z0-9_-]{43,128}$/.test(token);
}

function paragraph(text: string): AgreementBlock {
  return { type: "paragraph", segments: [{ text, strong: false }] };
}

function money(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

function formatCalendarDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (!match) return value;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return value;
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(date);
}
