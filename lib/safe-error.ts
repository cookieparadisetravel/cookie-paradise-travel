export type SafeDatabaseErrorDetails = {
  errorName: string;
  d1ErrorCode: string | null;
};

const MAX_CAUSE_DEPTH = 5;
const MAX_D1_ERROR_CODE_LENGTH = 120;

export function getSafeDatabaseErrorDetails(cause: unknown): SafeDatabaseErrorDetails {
  return {
    errorName: cause instanceof Error ? cause.name : "UnknownError",
    d1ErrorCode: findD1ErrorCode(cause),
  };
}

export function formatSafeDatabaseErrorDetails(cause: unknown) {
  const details = getSafeDatabaseErrorDetails(cause);
  return details.d1ErrorCode
    ? `${details.errorName}: ${details.d1ErrorCode}`
    : details.errorName;
}

function findD1ErrorCode(cause: unknown) {
  const visited = new Set<object>();
  let current = cause;

  for (let depth = 0; depth < MAX_CAUSE_DEPTH; depth += 1) {
    if (!current || typeof current !== "object" || visited.has(current)) return null;
    visited.add(current);

    const message = "message" in current && typeof current.message === "string"
      ? current.message
      : "";
    const match = /D1_ERROR:\s*([^:\r\n]+)/u.exec(message);
    const code = match?.[1]?.trim();
    if (code) return code.slice(0, MAX_D1_ERROR_CODE_LENGTH);

    current = "cause" in current ? current.cause : null;
  }

  return null;
}
