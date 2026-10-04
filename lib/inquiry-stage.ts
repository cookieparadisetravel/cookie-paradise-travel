export const inquiryStageOptions = [
  ["new", "New"],
  ["considering", "Considering"],
  ["booking_in_progress", "Booking in progress"],
  ["reserved", "Reserved"],
  ["waitlist", "Waitlist"],
  ["closed", "Closed"],
] as const;

const legacyStageAliases: Record<string, string> = {
  contacted: "considering",
  qualified: "booking_in_progress",
};

const allowedStageValues = new Set<string>([
  ...inquiryStageOptions.map(([value]) => value),
  ...Object.keys(legacyStageAliases),
]);

const activeStageValues = new Set([
  "new",
  "considering",
  "booking_in_progress",
  "reserved",
]);

export function normalizeInquiryStage(stage: string) {
  return legacyStageAliases[stage] ?? stage;
}

export function isAllowedInquiryStage(stage: string) {
  return allowedStageValues.has(stage);
}

export function isActiveInquiryStage(stage: string) {
  return activeStageValues.has(normalizeInquiryStage(stage));
}

export function inquiryStageMatchesFilter(stage: string, filter: string) {
  return normalizeInquiryStage(stage) === filter;
}

export function inquiryStageLabel(stage: string) {
  const normalized = normalizeInquiryStage(stage);
  return inquiryStageOptions.find(([value]) => value === normalized)?.[1];
}
