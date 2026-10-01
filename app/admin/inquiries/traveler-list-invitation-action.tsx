"use client";

import { useState } from "react";
import { Check, Copy, Link2, Loader2, Mail, UsersRound } from "lucide-react";

type Props = {
  inquiryId: number;
  expectedPartySize: number;
  currentTravelerCount: number;
  primaryContactName: string;
  primaryContactEmail: string;
};

export function TravelerListInvitationAction({ inquiryId, expectedPartySize, currentTravelerCount, primaryContactName, primaryContactEmail }: Props) {
  const [creating, setCreating] = useState(false);
  const [invitationUrl, setInvitationUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const remaining = Math.max(0, expectedPartySize - currentTravelerCount);
  const emailSubject = "Secure traveler-list link for your Vietnam trip";
  const emailBody = `Hi ${primaryContactName},

To continue your group's reservation, please use the secure link below to provide the legal names and email addresses of the other travelers in your party:

${invitationUrl}

The link expires in seven days and can be submitted once. Please do not enter passport, medical or payment information.

Thank you,
Trung
Cookie Paradise Travel Company`;
  const emailHref = `mailto:${encodeURIComponent(primaryContactEmail)}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

  async function createInvitation() {
    setCreating(true);
    setError("");
    setCopied(false);
    try {
      const response = await fetch(`/api/admin/inquiries/${inquiryId}/traveler-list-invitation`, { method: "POST" });
      const payload = await response.json() as { error?: string; invitationUrl?: string };
      if (!response.ok || !payload.invitationUrl) throw new Error(payload.error || "The traveler-list link could not be created.");
      setInvitationUrl(payload.invitationUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The traveler-list link could not be created.");
    } finally {
      setCreating(false);
    }
  }

  async function copyInvitation() {
    if (!invitationUrl) return;
    try {
      await navigator.clipboard.writeText(invitationUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Copy failed. Select and copy the link manually.");
    }
  }

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-bold text-[var(--ink)]"><UsersRound className="h-4 w-4 text-[var(--orange)]" /> Traveler list</p>
          <p className="mt-1 text-sm leading-6 text-[var(--muted-ink)]">Send the primary contact a secure, one-time link to provide the remaining traveler names and emails. The link expires after seven days.</p>
        </div>
        <span className="w-fit rounded-full bg-[var(--cream)] px-3 py-1 text-xs font-bold text-[var(--ink)]">{currentTravelerCount} of {expectedPartySize} entered</span>
      </div>

      {remaining === 0 ? (
        <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">The traveler list is complete.</p>
      ) : !invitationUrl ? (
        <button disabled={creating} className="mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--orange)] px-4 py-2 text-sm font-bold text-white disabled:opacity-50" type="button" onClick={createInvitation}>
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
          {creating ? "Creating…" : `Create traveler-list link for ${remaining}`}
        </button>
      ) : (
        <div className="mt-4 space-y-2">
          <label className="block text-xs font-semibold text-[var(--ink)]">Copy this link now. Creating a new link will revoke this one.
            <input readOnly className="mt-1 w-full rounded-lg border border-[var(--input)] bg-[var(--cream)] px-3 py-2 font-mono text-xs" value={invitationUrl} />
          </label>
          <div className="flex flex-wrap gap-2">
            <a className="inline-flex items-center gap-2 rounded-full bg-[var(--ink)] px-3 py-2 text-xs font-bold text-white" href={emailHref}>
              <Mail className="h-3.5 w-3.5" /> Email secure link
            </a>
            <button className="inline-flex items-center gap-2 rounded-full bg-[var(--orange)] px-3 py-2 text-xs font-bold text-white" type="button" onClick={copyInvitation}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? "Copied" : "Copy link"}
            </button>
            <button className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] px-3 py-2 text-xs font-bold text-[var(--ink)]" type="button" onClick={createInvitation}>Replace link</button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
    </section>
  );
}
