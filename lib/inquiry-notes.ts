export const MAX_INQUIRY_NOTE_LENGTH = 5000;

export type InquiryNote = {
  id: string;
  body: string;
  createdBy: string;
  createdAt: string;
};

export function isInquiryNote(value: unknown): value is InquiryNote {
  if (!value || typeof value !== "object") return false;
  const note = value as Record<string, unknown>;
  return typeof note.id === "string" && typeof note.body === "string"
    && typeof note.createdBy === "string" && typeof note.createdAt === "string"
    && Number.isFinite(Date.parse(note.createdAt));
}
