export type AgreementSection = {
  heading: string;
  paragraphs: string[];
};

export type AgreementDocument = {
  version: string;
  effectiveDate: string;
  title: string;
  sections: AgreementSection[];
};

// Keep this null until counsel approves the final traveler agreement.
// Activating an agreement requires replacing null with the approved,
// versioned text and creating invitations that store its computed hash.
export const currentTravelerAgreement: AgreementDocument | null = null;

export function canonicalizeAgreement(document: AgreementDocument) {
  return JSON.stringify({
    version: document.version,
    effectiveDate: document.effectiveDate,
    title: document.title,
    sections: document.sections.map((section) => ({
      heading: section.heading,
      paragraphs: section.paragraphs,
    })),
  });
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
