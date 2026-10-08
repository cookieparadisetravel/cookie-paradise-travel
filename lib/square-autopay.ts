export type AutopayScheduleRequest = {
  uid: string;
  dueDate: string;
  amountCents: number;
};

export async function autopayScheduleFingerprint(
  cardId: string,
  requests: AutopayScheduleRequest[],
) {
  const canonicalValue = JSON.stringify({
    cardId,
    requests: requests.map((request) => ({
      uid: request.uid,
      dueDate: request.dueDate,
      amountCents: request.amountCents,
    })),
  });
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonicalValue),
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
