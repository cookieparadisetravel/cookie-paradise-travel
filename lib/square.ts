import { env } from "cloudflare:workers";

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

function todayInIndiana() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Indiana/Indianapolis",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
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
  amountCents: number;
  paymentPercent: 50 | 100;
}) {
  const { locationId } = squareConfig();
  const result = await squareRequest<{
    order?: { id?: string; total_money?: { amount?: number | string } };
  }>("/v2/orders", { body: {
    idempotency_key: `cpt-inquiry-${input.inquiryId}-deposit-order-v1`,
    order: {
      location_id: locationId,
      customer_id: input.customerId,
      reference_id: `deposit-inquiry-${input.inquiryId}`,
      line_items: [{
        name: input.paymentPercent === 50 ? "Vietnam 2027 initial payment" : "Vietnam 2027 full payment",
        quantity: "1",
        base_price_money: { amount: input.amountCents, currency: "USD" },
        note: input.paymentPercent === 50
          ? "50% of the confirmed booking price. The first $500 per traveler is a nonrefundable reservation deposit. The remaining balance is due 90 days before departure."
          : "Full payment required because the booking is being accepted within 90 days of departure. The first $500 per traveler is a nonrefundable reservation deposit.",
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
  amountCents: number;
  paymentPercent: 50 | 100;
}) {
  const { locationId } = squareConfig();
  const amount = input.amountCents / 100;
  const result = await squareRequest<{ invoice?: { id?: string; version?: number } }>("/v2/invoices", { body: {
    idempotency_key: `cpt-inquiry-${input.inquiryId}-deposit-invoice-v1`,
    invoice: {
      location_id: locationId,
      order_id: input.orderId,
      primary_recipient: { customer_id: input.customerId },
      payment_requests: [{
        request_type: "BALANCE",
        due_date: todayInIndiana(),
        automatic_payment_source: "NONE",
      }],
      delivery_method: "EMAIL",
      accepted_payment_methods: {
        card: true,
        square_gift_card: false,
        bank_account: true,
        buy_now_pay_later: false,
        cash_app_pay: false,
      },
      title: input.paymentPercent === 50 ? "Vietnam 2027 — 50% initial payment" : "Vietnam 2027 — full payment",
      description: input.paymentPercent === 50
        ? `Initial payment for ${input.partySize} traveler${input.partySize === 1 ? "" : "s"}: $${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}, equal to 50% of the confirmed booking price. The first $500 per traveler is a nonrefundable reservation deposit. The remaining 50% is due 90 days before departure.`
        : `Full payment for ${input.partySize} traveler${input.partySize === 1 ? "" : "s"}: $${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}. Full payment is required because this booking is being accepted within 90 days of departure. The first $500 per traveler is a nonrefundable reservation deposit.`,
      ...(input.departure !== "flexible" ? { sale_or_service_date: input.departure } : {}),
      custom_fields: [{
        label: "Website inquiry",
        value: `#${input.inquiryId}`,
        placement: "ABOVE_LINE_ITEMS",
      }],
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
  const result = await squareRequest<{ invoice?: { id?: string; public_url?: string; status?: string } }>(
    `/v2/invoices/${encodeURIComponent(input.invoiceId)}/publish`,
    { body: {
      version: input.version,
      idempotency_key: `cpt-inquiry-${input.inquiryId}-deposit-publish-v1`,
    } },
  );
  if (!result.invoice?.id) throw new Error("Square did not publish the invoice.");
  return {
    publicUrl: result.invoice.public_url || null,
    status: result.invoice.status?.toLowerCase() || "published",
  };
}

export async function getSquareInvoiceVersion(invoiceId: string) {
  const result = await squareRequest<{
    invoice?: { version?: number; status?: string; public_url?: string };
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
  };
}
