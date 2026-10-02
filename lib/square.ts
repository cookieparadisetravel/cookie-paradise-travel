import { env } from "cloudflare:workers";
import type { PaymentInstallment } from "@/lib/payment-schedule";

const SQUARE_API_VERSION = "2026-09-16";

type JsonObject = Record<string, unknown>;

function squareConfig() {
  const runtime = env as unknown as Record<string, string | undefined>;
  const accessToken = runtime.SQUARE_ACCESS_TOKEN;
  const locationId = runtime.SQUARE_LOCATION_ID;
  const environment = runtime.SQUARE_ENV === "production" ? "production" : "sandbox";

  if (!accessToken || !locationId) {
    throw new Error("Square is not fully configured.");
  }

  return {
    accessToken,
    locationId,
    baseUrl: environment === "production"
      ? "https://connect.squareup.com"
      : "https://connect.squareupsandbox.com",
  };
}

async function squareRequest<T>(path: string, options: { method?: "GET" | "POST"; body?: JsonObject } = {}): Promise<T> {
  const config = squareConfig();
  const response = await fetch(`${config.baseUrl}${path}`, {
    method: options.method || "POST",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
      "Square-Version": SQUARE_API_VERSION,
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });

  const payload = await response.json() as { errors?: Array<{ code?: string; detail?: string }> } & T;
  if (!response.ok) {
    const detail = payload.errors?.map((item) => item.detail || item.code).filter(Boolean).join("; ");
    throw new Error(detail || "Square rejected the request.");
  }
  return payload;
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  return {
    givenName: parts[0] || fullName,
    familyName: parts.slice(1).join(" ") || undefined,
  };
}

function requireSquareAmount(value: unknown) {
  const amount = typeof value === "number"
    ? value
    : typeof value === "string" && /^\d+$/.test(value)
      ? Number(value)
      : NaN;
  if (!Number.isSafeInteger(amount) || amount < 1) {
    throw new Error("Square did not return a valid order amount.");
  }
  return amount;
}

export async function createSquareCustomer(input: {
  inquiryId: number;
  fullName: string;
  email: string;
  phone: string;
}) {
  const name = splitName(input.fullName);
  const result = await squareRequest<{ customer?: { id?: string } }>("/v2/customers", { body: {
    idempotency_key: `cpt-inquiry-${input.inquiryId}-customer-v1`,
    given_name: name.givenName,
    ...(name.familyName ? { family_name: name.familyName } : {}),
    email_address: input.email,
    ...(input.phone ? { phone_number: input.phone } : {}),
    reference_id: `website-inquiry-${input.inquiryId}`,
    note: "Cookie Paradise Travel Company website inquiry",
  } });
  if (!result.customer?.id) throw new Error("Square did not return a customer ID.");
  return result.customer.id;
}

export async function createSquareDepositOrder(input: {
  inquiryId: number;
  customerId: string;
  bookingTotalCents: number;
  paymentType: "deposit" | "full";
}) {
  const { locationId } = squareConfig();
  const result = await squareRequest<{
    order?: { id?: string; total_money?: { amount?: number | string } };
  }>("/v2/orders", { body: {
    idempotency_key: `cpt-inquiry-${input.inquiryId}-payment-plan-order-v3-${input.bookingTotalCents}`,
    order: {
      location_id: locationId,
      customer_id: input.customerId,
      reference_id: `booking-inquiry-${input.inquiryId}`,
      line_items: [{
        name: "Vietnam 2027 trip booking",
        quantity: "1",
        base_price_money: { amount: input.bookingTotalCents, currency: "USD" },
        note: "Payment for the Vietnam 2027 trip booking. The first $500 per traveler is the nonrefundable reservation-deposit portion, subject to the Traveler Agreement.",
      }],
    },
  } });
  if (!result.order?.id) throw new Error("Square did not return an order ID.");
  return {
    id: result.order.id,
    amountCents: requireSquareAmount(result.order.total_money?.amount),
  };
}

export async function getSquareOrderAmountCents(orderId: string) {
  const result = await squareRequest<{
    order?: { id?: string; total_money?: { amount?: number | string } };
  }>(`/v2/orders/${encodeURIComponent(orderId)}`, { method: "GET" });
  if (!result.order?.id) throw new Error("Square did not return the order.");
  return requireSquareAmount(result.order.total_money?.amount);
}

export async function createSquareDepositInvoice(input: {
  inquiryId: number;
  customerId: string;
  orderId: string;
  partySize: number;
  departure: string;
  acceptanceDate: string;
  bookingTotalCents: number;
  initialAmountCents: number;
  paymentType: "deposit" | "full";
  installments: PaymentInstallment[];
  finalPaymentDeadline: string;
}) {
  const { locationId } = squareConfig();
  const bookingTotal = input.bookingTotalCents / 100;
  const initialAmount = input.initialAmountCents / 100;
  const paymentRequests = buildPaymentRequests(input);
  const result = await squareRequest<{ invoice?: { id?: string; version?: number } }>("/v2/invoices", { body: {
    idempotency_key: `cpt-inquiry-${input.inquiryId}-payment-plan-invoice-v4-${input.paymentType}-${input.bookingTotalCents}-${input.acceptanceDate}`,
    invoice: {
      location_id: locationId,
      order_id: input.orderId,
      primary_recipient: { customer_id: input.customerId },
      payment_requests: paymentRequests,
      delivery_method: "EMAIL",
      accepted_payment_methods: {
        card: true,
        square_gift_card: false,
        bank_account: true,
        buy_now_pay_later: false,
        cash_app_pay: false,
      },
      title: input.paymentType === "deposit" ? "Vietnam 2027 — payment plan" : "Vietnam 2027 — full payment",
      description: input.paymentType === "deposit"
        ? depositInvoiceDescription(input.partySize, initialAmount, bookingTotal, input.installments, input.finalPaymentDeadline)
        : `Full payment selected for ${input.partySize} traveler${input.partySize === 1 ? "" : "s"}: $${bookingTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}. The first $500 per traveler is the nonrefundable reservation-deposit portion, subject to the Traveler Agreement. No payment surcharge is added.`,
      ...(input.departure !== "flexible" ? { sale_or_service_date: input.departure } : {}),
      store_payment_method_enabled: false,
    },
  } });
  if (!result.invoice?.id || result.invoice.version === undefined) {
    throw new Error("Square did not return a complete invoice.");
  }
  return { id: result.invoice.id, version: result.invoice.version };
}

export async function publishSquareInvoice(input: {
  inquiryId: number;
  invoiceId: string;
  version: number;
}) {
  const result = await squareRequest<{
    invoice?: { id?: string; public_url?: string; status?: string; version?: number };
  }>(
    `/v2/invoices/${encodeURIComponent(input.invoiceId)}/publish`,
    { body: {
      version: input.version,
      idempotency_key: `cpt-inquiry-${input.inquiryId}-reservation-publish-v2-${input.version}`,
    } },
  );
  if (!result.invoice?.id || result.invoice.version === undefined) {
    throw new Error("Square did not return the complete published invoice.");
  }
  return {
    publicUrl: result.invoice.public_url || null,
    status: result.invoice.status?.toLowerCase() || "published",
    version: result.invoice.version,
  };
}

function depositInvoiceDescription(
  partySize: number,
  depositAmount: number,
  bookingTotal: number,
  installments: PaymentInstallment[],
  finalPaymentDeadline: string,
) {
  const travelerLabel = `${partySize} traveler${partySize === 1 ? "" : "s"}`;
  const schedule = installments.length === 0
    ? "No remaining balance is scheduled."
    : installments.length === 1
      ? `The remaining balance is due in one payment on ${formatInvoiceDate(installments[0].dueDate)}.`
      : `The remaining balance is divided into ${installments.length} monthly installments beginning ${formatInvoiceDate(installments[0].dueDate)}; the final installment is due ${formatInvoiceDate(installments.at(-1)!.dueDate)}.`;
  return `Total booking price for ${travelerLabel}: $${bookingTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}. The first payment is a $${depositAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })} reservation deposit ($500 per traveler). The deposit is nonrefundable, subject to the Traveler Agreement. ${schedule} Full payment is due no later than ${formatInvoiceDate(finalPaymentDeadline)}, 90 days before departure. No payment surcharge is added.`;
}

function buildPaymentRequests(input: {
  paymentType: "deposit" | "full";
  initialAmountCents: number;
  installments: PaymentInstallment[];
  acceptanceDate: string;
}) {
  if (input.paymentType === "full" || input.installments.length === 0) {
    return [{
      request_type: "BALANCE",
      due_date: input.acceptanceDate,
      automatic_payment_source: "NONE",
    }];
  }

  const deposit = {
    request_type: "DEPOSIT",
    due_date: input.acceptanceDate,
    fixed_amount_requested_money: {
      amount: input.initialAmountCents,
      currency: "USD",
    },
    automatic_payment_source: "NONE",
  };

  if (input.installments.length === 1) {
    return [deposit, {
      request_type: "BALANCE",
      due_date: input.installments[0].dueDate,
      automatic_payment_source: "NONE",
      ...paymentReminderFields(input.installments[0].dueDate, input.acceptanceDate),
    }];
  }

  return [deposit, ...input.installments.map((installment) => ({
    request_type: "INSTALLMENT",
    due_date: installment.dueDate,
    fixed_amount_requested_money: {
      amount: installment.amountCents,
      currency: "USD",
    },
    automatic_payment_source: "NONE",
    ...paymentReminderFields(installment.dueDate, input.acceptanceDate),
  }))];
}

function paymentReminderFields(dueDate: string, acceptanceDate: string) {
  const dueTime = Date.parse(`${dueDate}T00:00:00Z`);
  const acceptanceTime = Date.parse(`${acceptanceDate}T00:00:00Z`);
  const daysUntilDue = (dueTime - acceptanceTime) / 86_400_000;
  return daysUntilDue >= 8 ? { reminders: paymentReminders() } : {};
}

function paymentReminders() {
  return [{
    relative_scheduled_days: -7,
    message: "Your Cookie Paradise Travel Company installment is due in one week.",
  }];
}

function formatInvoiceDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export async function getSquareInvoiceVersion(invoiceId: string) {
  const result = await squareRequest<{
    invoice?: {
      version?: number;
      status?: string;
      public_url?: string;
      payment_requests?: Array<{ request_type?: string }>;
    };
  }>(
    `/v2/invoices/${encodeURIComponent(invoiceId)}`,
    { method: "GET" },
  );
  if (result.invoice?.version === undefined || !result.invoice.status) {
    throw new Error("Square did not return the complete invoice state.");
  }
  return {
    version: result.invoice.version,
    status: result.invoice.status.toLowerCase(),
    publicUrl: result.invoice.public_url || null,
    paymentType: result.invoice.payment_requests?.some((request) => request.request_type === "DEPOSIT" || request.request_type === "INSTALLMENT")
      ? "deposit" as const
      : "full" as const,
  };
}
