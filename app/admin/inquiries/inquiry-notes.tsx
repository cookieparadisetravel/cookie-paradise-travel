"use client";

import { useEffect, useId, useRef, useState } from "react";
import { isInquiryNote, MAX_INQUIRY_NOTE_LENGTH, type InquiryNote } from "@/lib/inquiry-notes";

async function readReply(response: Response): Promise<Record<string, unknown>> {
  const value: unknown = await response.json().catch(() => null);
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

const dateFormat = new Intl.DateTimeFormat("en-US", {
  year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  timeZone: "America/Indiana/Indianapolis", timeZoneName: "short",
});

export function InquiryNotes({ inquiryId }: { inquiryId: number }) {
  const inputId = useId();
  const [notes, setNotes] = useState<InquiryNote[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");
  const inFlight = useRef(false);
  const submission = useRef<{ id: string; body: string } | null>(null);
  const endpoint = `/api/admin/inquiries/${inquiryId}/notes`;

  useEffect(() => {
    const controller = new AbortController();
    void fetch(endpoint, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const result = await readReply(response);
        if (!response.ok || result.ok !== true || !Array.isArray(result.notes) || !result.notes.every(isInquiryNote)) throw new Error(typeof result.error === "string" ? result.error : "Could not load notes.");
        if (!controller.signal.aborted) { setNotes(result.notes); setLoadError(""); }
      })
      .catch((error) => {
        if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : "Could not load notes.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [endpoint, loadAttempt]);

  async function saveNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || inFlight.current) return;
    inFlight.current = true;
    setSaving(true); setSaveError(""); setSavedMessage("");
    try {
      if (submission.current?.body !== body) submission.current = { id: crypto.randomUUID(), body };
      const response = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(submission.current),
      });
      const result = await readReply(response);
      if (!response.ok || result.ok !== true || !isInquiryNote(result.note)) throw new Error(typeof result.error === "string" ? result.error : "Could not save the note.");
      const note = result.note;
      setNotes((current) => [note, ...current.filter((entry) => entry.id !== note.id)]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)));
      setDraft(""); submission.current = null; setSavedMessage("Note saved.");
    } catch (error) {
      setSaveError(`${error instanceof Error ? error.message : "Could not save the note."} Your text has been kept; you can try again.`);
    } finally { inFlight.current = false; setSaving(false); }
  }

  return <aside className="min-w-0 border-t border-[var(--line)] pt-5 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0" aria-labelledby={`${inputId}-heading`}>
    <h3 className="font-serif text-2xl font-bold" id={`${inputId}-heading`}>Notes</h3>
    <p className="mt-1 text-sm leading-6 text-[var(--muted-ink)]">Private customer updates. Dates and times are recorded automatically in Indiana time.</p>
    <form className="mt-4" onSubmit={saveNote}>
      <label className="text-sm font-bold" htmlFor={inputId}>Add an update</label>
      <textarea className="field-input mt-2 min-h-28 resize-y py-3 text-sm" id={inputId} value={draft} disabled={saving} maxLength={MAX_INQUIRY_NOTE_LENGTH} rows={4}
        onChange={(event) => { setDraft(event.target.value); setSavedMessage(""); }} placeholder="Conversation, questions, or next steps…" />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-[var(--muted-ink)]">{draft.length.toLocaleString("en-US")} / {MAX_INQUIRY_NOTE_LENGTH.toLocaleString("en-US")}</span>
        <button className="min-h-11 rounded-full bg-[var(--gold)] px-5 text-sm font-extrabold text-[var(--orange)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--gold)]/40 disabled:cursor-not-allowed disabled:opacity-50" disabled={saving || loading || Boolean(loadError) || !draft.trim()} type="submit">{saving ? "Saving…" : "Save note"}</button>
      </div>
      {saveError && <p className="mt-3 text-sm leading-6 text-red-800" role="alert">{saveError}</p>}
      <p className="mt-2 text-sm text-[var(--muted-ink)]" role="status">{savedMessage}</p>
    </form>
    {loading ? <p className="mt-4 text-sm" role="status">Loading notes…</p> : loadError ? <div className="mt-4 rounded-xl bg-red-50 p-3">
      <p className="text-sm text-red-800" role="alert">{loadError}</p>
      <button className="mt-2 min-h-11 text-sm font-bold underline" type="button" onClick={() => { setLoading(true); setLoadError(""); setLoadAttempt((attempt) => attempt + 1); }}>Retry loading notes</button>
    </div> : notes.length ? <ol className="mt-4 max-h-[34rem] space-y-3 overflow-y-auto pr-1" aria-label="Saved notes, newest first">
      {notes.map((note) => <li className="rounded-xl border border-[var(--line)] bg-[var(--sand)] p-3" key={note.id}>
        <time className="text-xs font-bold text-[var(--muted-ink)]" dateTime={note.createdAt}>{dateFormat.format(new Date(note.createdAt))}</time>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{note.body}</p>
      </li>)}
    </ol> : <p className="mt-4 text-sm text-[var(--muted-ink)]">No updates yet.</p>}
  </aside>;
}
