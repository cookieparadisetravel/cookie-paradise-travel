export const RESERVATION_DEPOSIT_CENTS_PER_TRAVELER = 50_000;

export type PaymentInstallment = {
  dueDate: string;
  amountCents: number;
};

export type PaymentPlan = {
  paymentType: "deposit" | "full";
  initialAmountCents: number;
  depositAmountCents: number;
  remainingBalanceCents: number;
  finalPaymentDeadline: string;
  installments: PaymentInstallment[];
};

export type PaymentPreference = "payment_plan" | "full";

export function createPaymentPlan(input: {
  bookingTotalCents: number;
  partySize: number;
  departure: string;
  acceptanceDate: string;
}): PaymentPlan {
  const { bookingTotalCents, partySize, departure, acceptanceDate } = input;
  if (!Number.isSafeInteger(bookingTotalCents) || bookingTotalCents < 1) {
    throw new Error("The confirmed booking total is invalid.");
  }
  if (!Number.isInteger(partySize) || partySize < 1) {
    throw new Error("The traveler count is invalid.");
  }

  const departureDate = parseDateOnly(departure);
  const acceptedDate = parseDateOnly(acceptanceDate);
  if (!departureDate || !acceptedDate) throw new Error("The payment schedule dates are invalid.");
  if (departureDate.getTime() <= acceptedDate.getTime()) {
    throw new Error("The departure date must be after the booking acceptance date.");
  }

  const finalPaymentDate = addDays(departureDate, -90);
  const finalPaymentDeadline = formatDateOnly(finalPaymentDate);
  const depositAmountCents = RESERVATION_DEPOSIT_CENTS_PER_TRAVELER * partySize;
  if (bookingTotalCents < depositAmountCents) {
    throw new Error(`The confirmed booking total cannot be less than the $${(depositAmountCents / 100).toLocaleString("en-US")} reservation deposit.`);
  }

  if (acceptedDate.getTime() >= finalPaymentDate.getTime()) {
    return {
      paymentType: "full",
      initialAmountCents: bookingTotalCents,
      depositAmountCents,
      remainingBalanceCents: 0,
      finalPaymentDeadline,
      installments: [],
    };
  }

  const remainingBalanceCents = bookingTotalCents - depositAmountCents;
  if (remainingBalanceCents === 0) {
    return {
      paymentType: "deposit",
      initialAmountCents: depositAmountCents,
      depositAmountCents,
      remainingBalanceCents,
      finalPaymentDeadline,
      installments: [],
    };
  }

  const monthlyDueDates: Date[] = [];
  for (let month = 1; month <= 12; month += 1) {
    const dueDate = addMonthsClamped(acceptedDate, month);
    if (dueDate.getTime() > finalPaymentDate.getTime()) break;
    monthlyDueDates.push(dueDate);
  }

  const dueDates = monthlyDueDates.length >= 2 ? monthlyDueDates : [finalPaymentDate];
  const baseAmount = Math.floor(remainingBalanceCents / dueDates.length);
  const installments = dueDates.map((dueDate, index) => ({
    dueDate: formatDateOnly(dueDate),
    amountCents: index === dueDates.length - 1
      ? remainingBalanceCents - baseAmount * (dueDates.length - 1)
      : baseAmount,
  }));

  return {
    paymentType: "deposit",
    initialAmountCents: depositAmountCents,
    depositAmountCents,
    remainingBalanceCents,
    finalPaymentDeadline,
    installments,
  };
}

export function applyPaymentPreference(
  paymentPlan: PaymentPlan,
  bookingTotalCents: number,
  paymentPreference: PaymentPreference,
): PaymentPlan {
  if (paymentPlan.paymentType === "full" || paymentPreference === "payment_plan") {
    return paymentPlan;
  }

  return {
    ...paymentPlan,
    paymentType: "full",
    initialAmountCents: bookingTotalCents,
    remainingBalanceCents: 0,
    installments: [],
  };
}

export function todayInIndiana(referenceDate = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Indiana/Indianapolis",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(referenceDate);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function parseDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? date
    : null;
}

function formatDateOnly(value: Date) {
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
}

function addDays(value: Date, days: number) {
  const result = new Date(value);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function addMonthsClamped(value: Date, months: number) {
  const targetMonth = value.getUTCMonth() + months;
  const targetYear = value.getUTCFullYear() + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(targetYear, normalizedMonth, Math.min(value.getUTCDate(), lastDay)));
}
