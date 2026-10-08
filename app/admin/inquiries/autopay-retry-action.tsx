"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw } from "lucide-react";

export function AutopayRetryAction({ inquiryId }: { inquiryId: number }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function retry() {
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/inquiries/${inquiryId}/autopay-retry`, {
        method: "POST",
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Automatic-installment recovery failed.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Automatic-installment recovery failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
      <p className="text-sm font-bold">This automatic-installment step has been in progress for more than 10 minutes.</p>
      <p className="mt-1 text-sm leading-6">Retry checks the current Square invoice first and resumes only the unfinished work.</p>
      {error && <p className="mt-3 text-sm font-semibold text-red-800" role="alert">{error}</p>}
      <button className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-full bg-[var(--brown)] px-4 py-2 text-sm font-bold text-white hover:bg-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-60" disabled={submitting} onClick={() => void retry()} type="button">
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
        {submitting ? "Retrying…" : "Retry"}
      </button>
    </div>
  );
}
