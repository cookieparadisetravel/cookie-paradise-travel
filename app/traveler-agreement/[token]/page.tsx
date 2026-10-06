import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, LockKeyhole, ShieldAlert } from "lucide-react";
import { AgreementAcceptanceForm } from "./agreement-acceptance-form";
import { getAgreementInvitation } from "@/lib/agreement-invitation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Secure Traveler Agreement | Cookie Paradise Travel Company",
  robots: { index: false, follow: false },
};

export default async function TravelerAgreementPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await getAgreementInvitation(token);

  return (
    <main className="min-h-screen bg-[var(--sand)] px-5 py-8 text-[var(--ink)] sm:py-12">
      <div className="mx-auto max-w-4xl">
        <header className="mb-7 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
          {/* This local wordmark is intentionally rendered at its intrinsic aspect ratio. */}
          <Link className="flex min-w-0 items-center gap-2 sm:gap-3" href="/" aria-label="Cookie Paradise Travel Company home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="h-auto w-40 rounded-sm sm:w-52" src="/cookie-paradise-logo.png" alt="Cookie Paradise" />
            <span className="shrink-0 border-l border-[var(--line)] pl-2 text-[0.65rem] font-bold uppercase leading-3 tracking-[0.14em] text-[var(--orange)] sm:pl-3 sm:text-xs sm:leading-4 sm:tracking-[0.18em]">Travel<br />Company</span>
          </Link>
          <p className="flex items-center gap-2 whitespace-nowrap text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-ink)]"><LockKeyhole className="h-4 w-4" /> Secure agreement</p>
        </header>

        {result.status === "disabled" && <StatusCard icon="lock" title="Agreement acceptance is not active yet">The secure acceptance system is installed, but Cookie Paradise Travel Company has not activated a legally approved agreement. No traveler information or acceptance can be submitted from this page.</StatusCard>}
        {(result.status === "invalid" || result.status === "revoked") && <StatusCard icon="alert" title="This agreement link is unavailable">The link is invalid, has been replaced or was revoked. Please contact Cookie Paradise Travel Company for a new secure link.</StatusCard>}
        {result.status === "expired" && <StatusCard icon="alert" title="This agreement link has expired">Please contact Cookie Paradise Travel Company to request a new secure link.</StatusCard>}
        {result.status === "accepted" && <StatusCard icon="check" title="Agreement already accepted">This secure link has already been used{result.acceptedAt ? ` on ${new Date(result.acceptedAt).toLocaleDateString("en-US", { dateStyle: "long" })}` : ""}. Contact Cookie Paradise Travel Company if you need assistance.</StatusCard>}
        {result.status === "ready" && <AgreementAcceptanceForm token={token} agreement={result.agreement} traveler={result.invitation} />}
      </div>
    </main>
  );
}

function StatusCard({ icon, title, children }: { icon: "lock" | "alert" | "check"; title: string; children: React.ReactNode }) {
  const Icon = icon === "check" ? CheckCircle2 : icon === "alert" ? ShieldAlert : LockKeyhole;
  return (
    <section className="rounded-3xl border border-[var(--line)] bg-white p-7 text-center shadow-sm sm:p-10">
      <Icon className="mx-auto h-11 w-11 text-[var(--orange)]" />
      <h1 className="mt-5 font-serif text-3xl sm:text-4xl">{title}</h1>
      <p className="mx-auto mt-4 max-w-2xl leading-7 text-[var(--muted-ink)]">{children}</p>
    </section>
  );
}
