import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, LockKeyhole, ShieldAlert } from "lucide-react";
import { getPaymentPreferenceInvitation } from "@/lib/payment-preference-invitation";
import { PaymentPreferenceForm } from "./payment-preference-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Secure Payment Preference | Cookie Paradise Travel Company",
  robots: { index: false, follow: false },
};

const departureLabels: Record<string, string> = {
  "2027-06-01": "June 1, 2027",
  "2027-06-29": "June 29, 2027",
  "2027-07-27": "July 27, 2027",
};

export default async function PaymentPreferencePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await getPaymentPreferenceInvitation(token);

  return (
    <main className="min-h-screen bg-[var(--sand)] px-5 py-8 text-[var(--ink)] sm:py-12">
      <div className="mx-auto max-w-3xl">
        <header className="mb-7 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
          <Link className="flex min-w-0 items-center gap-2 sm:gap-3" href="/" aria-label="Cookie Paradise Travel Company home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="h-auto w-40 rounded-sm sm:w-52" src="/cookie-paradise-logo.png" alt="Cookie Paradise" />
            <span className="shrink-0 border-l border-[var(--line)] pl-2 text-[0.65rem] font-bold uppercase leading-3 tracking-[0.14em] text-[var(--orange)] sm:pl-3 sm:text-xs sm:leading-4 sm:tracking-[0.18em]">Travel<br />Company</span>
          </Link>
          <p className="flex items-center gap-2 whitespace-nowrap text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-ink)]"><LockKeyhole className="h-4 w-4" /> Secure payment choice</p>
        </header>

        {(result.status === "invalid" || result.status === "revoked") && <StatusCard icon="alert" title="This payment-choice link is unavailable">The link is invalid, has been replaced or was revoked. Please contact Cookie Paradise Travel Company for a new secure link.</StatusCard>}
        {result.status === "expired" && <StatusCard icon="alert" title="This payment-choice link has expired">Please contact Cookie Paradise Travel Company to request a new secure link.</StatusCard>}
        {result.status === "completed" && <StatusCard icon="check" title="Payment preference received">
          <span>This secure link has already been used{result.completedAt ? ` on ${new Date(result.completedAt).toLocaleDateString("en-US", { dateStyle: "long" })}` : ""}. Your selection was {result.paymentPreference === "full" ? "pay in full" : result.paymentPreference === "payment_plan" ? "deposit and monthly installments" : "recorded"}.</span>
          {result.invoiceUrl ? <a className="mx-auto mt-6 inline-flex rounded-full bg-[var(--orange)] px-6 py-3 font-bold text-white" href={result.invoiceUrl}>Open Square invoice</a> : <span className="mt-3 block">The payment choice is recorded, but the Square invoice link is not available. Please contact Cookie Paradise Travel Company.</span>}
        </StatusCard>}
        {result.status === "ready" && <PaymentPreferenceForm
          token={token}
          primaryContactName={result.primaryContactName}
          departure={departureLabels[result.departure] ?? result.departure}
          partySize={result.partySize}
          bookingTotalCents={result.bookingTotalCents}
          depositAmountCents={result.depositAmountCents}
          remainingBalanceCents={result.remainingBalanceCents}
          installmentCount={result.installmentCount}
          finalPaymentDeadline={result.finalPaymentDeadline}
          fullPaymentRequired={result.fullPaymentRequired}
        />}
      </div>
    </main>
  );
}

function StatusCard({ icon, title, children }: { icon: "alert" | "check"; title: string; children: React.ReactNode }) {
  const Icon = icon === "check" ? CheckCircle2 : ShieldAlert;
  return (
    <section className="rounded-3xl border border-[var(--line)] bg-white p-7 text-center shadow-sm sm:p-10">
      <Icon className="mx-auto h-11 w-11 text-[var(--orange)]" />
      <h1 className="mt-5 font-serif text-3xl sm:text-4xl">{title}</h1>
      <div className="mx-auto mt-4 max-w-2xl leading-7 text-[var(--muted-ink)]">{children}</div>
    </section>
  );
}
