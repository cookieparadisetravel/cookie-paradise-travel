import Link from "next/link";
import { notFound } from "next/navigation";
import { env } from "cloudflare:workers";
import { requireOwner } from "@/lib/owner-auth";
import { ReminderTestControls } from "./reminder-test-controls";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reminder tests | Owner dashboard", robots: { index: false, follow: false } };

export default async function ReminderTestsPage() {
  const owner = await requireOwner("/admin/reminder-tests");
  if (!owner) notFound();
  const remindersEnabled = env.INQUIRY_REMINDERS_ENABLED === "true" && env.SQUARE_ENV === "production";
  return <main className="min-h-screen bg-[var(--sand)] px-5 py-8 text-[var(--ink)] sm:px-8">
    <div className="mx-auto max-w-3xl">
      <Link href="/admin/inquiries" className="text-sm font-bold underline">← Inquiries</Link>
      <p className="mt-8 text-xs font-extrabold uppercase tracking-[0.2em] text-[var(--ink)]">Owner dashboard</p>
      <h1 className="mt-2 font-serif text-4xl font-bold">Test inquiry reminders</h1>
      <p className="mt-3 text-sm leading-7 text-[var(--muted-ink)]">Check the consultation calendar and preview the three-day and seven-day emails. Tests do not change customer inquiries or their reminder schedules.</p>
      <p className="mt-4 rounded-xl border border-[var(--line)] bg-white p-4 text-sm"><strong>Automatic inquiry reminders:</strong> {remindersEnabled ? "Enabled · checked hourly" : "Paused"}. Each reminder requires a successful calendar check.</p>
      <ReminderTestControls ownerEmail={owner.email} />
    </div>
  </main>;
}
