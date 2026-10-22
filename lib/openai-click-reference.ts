// Both callers pass an internal landing path without an existing query string.
export function withOpenAIClickReference(path: string, reference: unknown) {
  if (typeof reference !== "string" || reference.length === 0 || reference.length > 2048) return path;
  return `${path}?oppref=${encodeURIComponent(reference)}`;
}
