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

  const { acceptedDate, finalPaymentDate, finalPaymentDeadline } = paymentDates(departure, acceptanceDate);

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

export function isFullPaymentRequired(departure: string, acceptanceDate: string) {
  const { acceptedDate, finalPaymentDate } = paymentDates(departure, acceptanceDate);
  return acceptedDate.getTime() >= finalPaymentDate.getTime();
}

export function getFinalPaymentDeadline(departure: string, acceptanceDate: string) {
  return paymentDates(departure, acceptanceDate).finalPaymentDeadline;
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

export function combineTravelerPaymentPlans(
  plans: PaymentPlan[],
  bookingTotalCents: number,
): PaymentPlan | null {
  const firstPlan = plans[0];
  if (!firstPlan || !Number.isSafeInteger(bookingTotalCents) || bookingTotalCents < 1) {
    return null;
  }

  const schedulesMatch = plans.every((plan) => (
    plan.paymentType === firstPlan.paymentType
    && plan.finalPaymentDeadline === firstPlan.finalPaymentDeadline
    && plan.installments.length === firstPlan.installments.length
    && plan.installments.every((installment, index) => (
      installment.dueDate === firstPlan.installments[index]?.dueDate
    ))
  ));
  if (!schedulesMatch) return null;

  const combinedPlan: PaymentPlan = {
    paymentType: firstPlan.paymentType,
    initialAmountCents: plans.reduce((sum, plan) => sum + plan.initialAmountCents, 0),
    depositAmountCents: plans.reduce((sum, plan) => sum + plan.depositAmountCents, 0),
    remainingBalanceCents: plans.reduce((sum, plan) => sum + plan.remainingBalanceCents, 0),
    finalPaymentDeadline: firstPlan.finalPaymentDeadline,
    installments: firstPlan.installments.map((installment, index) => ({
      dueDate: installment.dueDate,
      amountCents: plans.reduce((sum, plan) => sum + plan.installments[index].amountCents, 0),
    })),
  };

  const installmentTotalCents = combinedPlan.installments.reduce(
    (sum, installment) => sum + installment.amountCents,
    0,
  );
  const scheduledTotalCents = combinedPlan.initialAmountCents + installmentTotalCents;
  const depositScheduleIsValid = combinedPlan.paymentType === "full"
    || (
      combinedPlan.initialAmountCents === combinedPlan.depositAmountCents
      && combinedPlan.depositAmountCents + installmentTotalCents === bookingTotalCents
      && combinedPlan.remainingBalanceCents === installmentTotalCents
    );

  return scheduledTotalCents === bookingTotalCents && depositScheduleIsValid
    ? combinedPlan
    : null;
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

function paymentDates(departure: string, acceptanceDate: string) {
  const departureDate = parseDateOnly(departure);
  const acceptedDate = parseDateOnly(acceptanceDate);
  if (!departureDate || !acceptedDate) throw new Error("The payment schedule dates are invalid.");
  if (departureDate.getTime() <= acceptedDate.getTime()) {
    throw new Error("The departure date must be after the booking acceptance date.");
  }
  const finalPaymentDate = addDays(departureDate, -90);
  return {
    departureDate,
    acceptedDate,
    finalPaymentDate,
    finalPaymentDeadline: formatDateOnly(finalPaymentDate),
  };
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
