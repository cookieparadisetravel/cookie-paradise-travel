"use client";

import { useState } from "react";

type TestResult = {
  error?: string;
  calendarConnected?: boolean;
  consultationBooked?: boolean;
  email?: string;
  toEmail?: string;
  deliveries?: { reminderDay: number; status: "accepted" | "unconfirmed" }[];
};

const buttonClass = "min-h-11 rounded-full bg-[var(--gold)] px-5 py-3 text-sm font-bold text-[var(--ink)] disabled:cursor-wait disabled:opacity-60";

export function ReminderTestControls({ ownerEmail }: { ownerEmail: string }) {
  const [email, setEmail] = useState(ownerEmail);
  const [busy, setBusy] = useState<"check_calendar" | "send_previews" | null>(null);
  const [calendar, setCalendar] = useState<TestResult | null>(null);
  const [previews, setPreviews] = useState<TestResult | null>(null);

  async function run(action: "check_calendar" | "send_previews") {
    if (busy) return;
    setBusy(action);
    const setResult = action === "check_calendar" ? setCalendar : setPreviews;
    setResult(null);
    try {
      const response = await fetch("/api/admin/reminder-tests", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...(action === "check_calendar" ? { email } : {}) }),
      });
      const result = await response.json() as TestResult;
      if (!response.ok && !result.error) throw new Error("Request failed");
      setResult(result);
    } catch {
      setResult({ error: action === "send_previews"
        ? "The email request could not be confirmed. Check your inbox and MailerSend activity before trying again; a preview may already have been sent. Reload this page if you need to sign in again."
        : "The calendar check could not be completed. Reload this page and try again." });
    } finally { setBusy(null); }
  }

  return <div className="mt-6 space-y-6">
    <section className="rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6">
      <h2 className="font-serif text-2xl font-bold">1. Check Google Calendar</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--muted-ink)]">Enter the email used for a consultation booking. This checks the live calendar without sending an email.</p>
      <form className="mt-4" onSubmit={(event) => { event.preventDefault(); void run("check_calendar"); }}>
        <label htmlFor="consultation-test-email" className="text-sm font-bold">Consultation email to check</label>
        <input id="consultation-test-email" type="email" required maxLength={254} autoComplete="email" value={email}
          onChange={(event) => { setEmail(event.target.value); setCalendar(null); }}
          className="mt-2 block min-h-11 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-3 text-base" />
        <button disabled={busy !== null} className={`mt-4 ${buttonClass}`}>{busy === "check_calendar" ? "Checking calendar…" : "Check calendar & booking"}</button>
      </form>
      <div aria-live="polite" role="status" className="mt-4 text-sm leading-6">
        {calendar?.error && <p className="rounded-xl bg-red-50 p-4 text-red-900">{calendar.error}</p>}
        {calendar?.calendarConnected && <div className="rounded-xl bg-green-50 p-4 text-green-950">
          <p className="font-bold">Google Calendar connection verified.</p>
          <p className="mt-1 break-words">{calendar.consultationBooked ? `A consultation was found for ${calendar.email}. Inquiry reminders for this address will be skipped.` : `No matching consultation was found for ${calendar.email}.`}</p>
          <p className="mt-2">To test booking detection, check an address with a known consultation. The inquiry and consultation must use the same email.</p>
        </div>}
      </div>
    </section>
    <section className="rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6">
      <h2 className="font-serif text-2xl font-bold">2. Send both email previews</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--muted-ink)]">Receive the day-three and day-seven emails immediately. Both are labeled TEST and sent only to <strong className="break-all text-[var(--ink)]">{ownerEmail}</strong>.</p>
      <button type="button" disabled={busy !== null} className={`mt-4 ${buttonClass}`} onClick={() => { void run("send_previews"); }}>{busy === "send_previews" ? "Sending test emails…" : "Send both test emails to me"}</button>
      <div aria-live="polite" role="status" className="mt-4 text-sm leading-6">
        {previews?.error && <p className="rounded-xl bg-red-50 p-4 text-red-900">{previews.error}</p>}
        {previews?.deliveries && <div className="rounded-xl bg-[var(--cream)] p-4">
          <p className="font-bold break-all">Test recipient: {previews.toEmail}</p>
          <ul className="mt-2 space-y-1">{previews.deliveries.map((delivery) => <li key={delivery.reminderDay}>Day {delivery.reminderDay}: {delivery.status === "accepted" ? "Accepted by MailerSend. Check your inbox and spam folder." : "Delivery not confirmed. Check your inbox and MailerSend activity before sending another test."}</li>)}</ul>
          <p className="mt-3">These previews test the email content and delivery. The automatic three-day and seven-day timing is unchanged.</p>
        </div>}
      </div>
    </section>
  </div>;
}
