export const publishedPerTravelerPricesCents = [287_500] as const;
export const privateRoomSupplementCents = 39_900;


export function isPublishedPerTravelerPriceCents(value: number): value is typeof publishedPerTravelerPricesCents[number] {
  return publishedPerTravelerPricesCents.some((price) => price === value);
}

export function automaticTravelerPriceCents(roomPreference: string) {
  return publishedPerTravelerPricesCents[0]
    + (roomPreference === "private" ? privateRoomSupplementCents : 0);
}

export function calculateExpectedBookingTotalCents({
  partySize,
  perTravelerPriceCents,
  privateRoomCount,
}: {
  partySize: number;
  perTravelerPriceCents: number;
  privateRoomCount: number;
}) {
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > 8) {
    throw new Error("The traveler count is invalid.");
  }
  if (!isPublishedPerTravelerPriceCents(perTravelerPriceCents)) {
    throw new Error("The shared-room price is fixed at $2,875 per traveler.");
  }
  if (!Number.isInteger(privateRoomCount) || privateRoomCount < 0 || privateRoomCount > partySize) {
    throw new Error("The private-room supplement count is invalid.");
  }

  return (partySize * perTravelerPriceCents) + (privateRoomCount * privateRoomSupplementCents);
}

export function inferPriceCheckSelection({
  bookingTotalCents,
  partySize,
  preferredPrivateRoomCount,
}: {
  bookingTotalCents: number | null;
  partySize: number;
  preferredPrivateRoomCount: number;
}) {
  const privateRoomCounts = [
    preferredPrivateRoomCount,
    ...Array.from({ length: partySize + 1 }, (_, count) => count).filter((count) => count !== preferredPrivateRoomCount),
  ];

  if (bookingTotalCents && bookingTotalCents > 0) {
    for (const privateRoomCount of privateRoomCounts) {
      for (const perTravelerPriceCents of publishedPerTravelerPricesCents) {
        if (calculateExpectedBookingTotalCents({ partySize, perTravelerPriceCents, privateRoomCount }) === bookingTotalCents) {
          return { perTravelerPriceCents, privateRoomCount };
        }
      }
    }
  }

  return {
    perTravelerPriceCents: publishedPerTravelerPricesCents[0],
    privateRoomCount: preferredPrivateRoomCount,
  };
}
