import type { AgreementReadiness } from "./agreement-readiness.ts";
import { currentTravelerAgreement } from "./traveler-agreement.ts";

export const AUTOPAY_AUTHORIZATION_VERSION = "1.0";
export const REQUIRED_AGREEMENT_VERSION = "1.0";

export function autopayAvailable(
  readiness: Pick<AgreementReadiness, "agreementActive" | "readyForInvoice">,
) {
  return currentTravelerAgreement.version === REQUIRED_AGREEMENT_VERSION
    && readiness.agreementActive
    && readiness.readyForInvoice;
}

export function buildAutopayAuthorizationText(input: {
  cardholderName: string;
  cardBrand: string;
  last4: string;
  paymentCount: number;
  totalCents: number;
  finalDueDate: string;
}) {
  return `I, ${input.cardholderName}, authorize Cookie Paradise Travel Company LLC to charge my ${formatCardBrand(input.cardBrand)} card ending in ${input.last4}, saved with Square, for the remaining installments shown above: ${input.paymentCount} payments totaling ${money(input.totalCents)}, each on its scheduled due date through ${formatDate(input.finalDueDate)}. No surcharge or fee will be added. The Company will not increase an installment, add a charge, or move a payment to an earlier date without my new written authorization. I can stop automatic payments by emailing trung@cookieparadise.co at least 3 business days before a charge; stopping automatic payments does not cancel the booking or change a payment deadline. If I am not the traveler, I authorize only these payments and do not accept the traveler's other contractual terms. This authorization is made under Section 5(c) of the Traveler Agreement, and I will receive a copy by email.`;
}

export function formatCardBrand(value: string) {
  const normalized = value.trim().toUpperCase().replaceAll("-", "_").replaceAll(" ", "_");
  const knownBrands: Record<string, string> = {
    AMERICAN_EXPRESS: "American Express",
    CHINA_UNIONPAY: "China UnionPay",
    DINERS_CLUB: "Diners Club",
    DISCOVER: "Discover",
    JCB: "JCB",
    MASTERCARD: "Mastercard",
    VISA: "Visa",
  };
  return knownBrands[normalized] ?? (value.trim() || "Card");
}

function money(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

function formatDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (!match) return value;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
