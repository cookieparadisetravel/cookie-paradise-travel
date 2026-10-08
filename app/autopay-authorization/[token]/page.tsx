import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, LockKeyhole, ShieldAlert } from "lucide-react";
import { getAutopayAuthorizationInvitation } from "@/lib/autopay-authorization-invitation";
import { AutopayAuthorizationForm } from "./autopay-authorization-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Automatic Installment Authorization | Cookie Paradise Travel Company",
  robots: { index: false, follow: false },
};

export default async function AutopayAuthorizationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let result;
  try {
    result = await getAutopayAuthorizationInvitation(token);
  } catch (error) {
    console.error("Automatic-installment authorization page could not load the Square schedule", error);
    return <PageShell><StatusCard icon="alert" title="The Square schedule is temporarily unavailable">Please try this secure link again in a few minutes. No automatic-payment authorization has been recorded.</StatusCard></PageShell>;
  }

  return (
    <PageShell>
      {(result.status === "invalid" || result.status === "revoked") && <StatusCard icon="alert" title="This authorization link is unavailable">The link is invalid, has been replaced or is no longer available. Your remaining installments are still manual.</StatusCard>}
      {result.status === "expired" && <StatusCard icon="alert" title="This authorization link has expired">Please contact Cookie Paradise Travel Company if you still want automatic installments. Your remaining installments are still manual.</StatusCard>}
      {result.status === "completed" && <StatusCard icon="check" title="Automatic installments authorized">This secure link has already been used{result.completedAt ? ` on ${new Date(result.completedAt).toLocaleDateString("en-US", { dateStyle: "long" })}` : ""}.</StatusCard>}
      {result.status === "ready" && <AutopayAuthorizationForm
        token={token}
        primaryContactName={result.primaryContactName}
        recipientEmail={result.recipientEmail}
        departure={formatDate(result.departure)}
        installments={result.installments}
      />}
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[var(--sand)] px-5 py-8 text-[var(--ink)] sm:py-12">
      <div className="mx-auto max-w-3xl">
        <header className="mb-7 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
          <Link className="flex min-w-0 items-center gap-2 sm:gap-3" href="/" aria-label="Cookie Paradise Travel Company home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="h-auto w-40 rounded-sm sm:w-52" src="/cookie-paradise-logo.png" alt="Cookie Paradise" />
            <span className="shrink-0 border-l border-[var(--line)] pl-2 text-[0.65rem] font-bold uppercase leading-3 tracking-[0.14em] text-[var(--orange)] sm:pl-3 sm:text-xs sm:leading-4 sm:tracking-[0.18em]">Travel<br />Company</span>
          </Link>
          <p className="flex items-center gap-2 whitespace-nowrap text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-ink)]"><LockKeyhole className="h-4 w-4" /> Secure authorization</p>
        </header>
        {children}
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
      <p className="mx-auto mt-4 max-w-2xl leading-7 text-[var(--muted-ink)]">{children}</p>
    </section>
  );
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month - 1, day)));
}
