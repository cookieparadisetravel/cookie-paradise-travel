export type SquareInvoiceTone = "success" | "pending" | "danger" | "neutral";

export type SquareInvoiceStatusPresentation = {
  label: string;
  description: string;
  tone: SquareInvoiceTone;
  invoiceExists: boolean;
  needsAttention: boolean;
};

const statusPresentations: Record<string, SquareInvoiceStatusPresentation> = {
  not_created: {
    label: "Not invoiced",
    description: "No Square invoice has been recorded.",
    tone: "neutral",
    invoiceExists: false,
    needsAttention: false,
  },
  creating: {
    label: "Creating invoice",
    description: "Invoice creation started but has not reached a published Square status.",
    tone: "pending",
    invoiceExists: false,
    needsAttention: true,
  },
  error: {
    label: "Invoice error",
    description: "The application recorded an error while creating or publishing the Square invoice.",
    tone: "danger",
    invoiceExists: false,
    needsAttention: true,
  },
  draft: {
    label: "Invoice draft",
    description: "The invoice remains a Square draft and is not available for customer payment.",
    tone: "pending",
    invoiceExists: true,
    needsAttention: true,
  },
  unpaid: {
    label: "Unpaid",
    description: "The Square invoice is published and has not been paid.",
    tone: "pending",
    invoiceExists: true,
    needsAttention: false,
  },
  scheduled: {
    label: "Scheduled",
    description: "Square has scheduled the invoice for processing.",
    tone: "pending",
    invoiceExists: true,
    needsAttention: false,
  },
  partially_paid: {
    label: "Partially paid",
    description: "Square reports that a partial payment was received.",
    tone: "pending",
    invoiceExists: true,
    needsAttention: false,
  },
  payment_pending: {
    label: "Payment pending",
    description: "Square reports that a payment was initiated but has not finished processing.",
    tone: "pending",
    invoiceExists: true,
    needsAttention: false,
  },
  paid: {
    label: "Paid · verified",
    description: "Square reports that the invoice was paid in full.",
    tone: "success",
    invoiceExists: true,
    needsAttention: false,
  },
  partially_refunded: {
    label: "Partially refunded",
    description: "Square reports that some, but not all, of the paid amount was refunded.",
    tone: "pending",
    invoiceExists: true,
    needsAttention: true,
  },
  refunded: {
    label: "Refunded",
    description: "Square reports that the full amount paid was refunded.",
    tone: "neutral",
    invoiceExists: true,
    needsAttention: true,
  },
  canceled: {
    label: "Canceled",
    description: "Square reports that the invoice was canceled and no longer accepts payment.",
    tone: "neutral",
    invoiceExists: true,
    needsAttention: true,
  },
  failed: {
    label: "Failed",
    description: "Square canceled the invoice after reporting suspicious activity.",
    tone: "danger",
    invoiceExists: true,
    needsAttention: true,
  },
};

export function getSquareInvoiceStatusPresentation(status: string): SquareInvoiceStatusPresentation {
  const normalized = status.trim().toLowerCase();
  const known = statusPresentations[normalized];
  if (known) return known;

  return {
    label: normalized ? `Unknown Square status: ${normalized.replaceAll("_", " ")}` : "Unknown Square status",
    description: "Square returned a status this dashboard does not recognize. Review the invoice in Square before taking another action.",
    tone: "danger",
    invoiceExists: normalized !== "",
    needsAttention: true,
  };
}
