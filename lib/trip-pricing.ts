export const publishedPerTravelerPricesCents = [287_500] as const;
export const privateRoomSupplementCents = 39_900;
export const allMealsUpgradeCents = 12_500;


export function isPublishedPerTravelerPriceCents(value: number): value is typeof publishedPerTravelerPricesCents[number] {
  return publishedPerTravelerPricesCents.some((price) => price === value);
}

export function automaticTravelerPriceCents(roomPreference: string, allMealsIncluded = false) {
  return publishedPerTravelerPricesCents[0]
    + (allMealsIncluded ? allMealsUpgradeCents : 0)
    + (roomPreference === "private" ? privateRoomSupplementCents : 0);
}

export function calculateExpectedBookingTotalCents({
  partySize,
  perTravelerPriceCents,
  privateRoomCount,
  allMealsIncluded = false,
}: {
  partySize: number;
  perTravelerPriceCents: number;
  privateRoomCount: number;
  allMealsIncluded?: boolean;
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

  return (partySize * (perTravelerPriceCents + (allMealsIncluded ? allMealsUpgradeCents : 0))) + (privateRoomCount * privateRoomSupplementCents);
}

export function inferPriceCheckSelection({
  bookingTotalCents,
  partySize,
  preferredPrivateRoomCount,
  allMealsIncluded = false,
}: {
  bookingTotalCents: number | null;
  partySize: number;
  preferredPrivateRoomCount: number;
  allMealsIncluded?: boolean;
}) {
  const privateRoomCounts = [
    preferredPrivateRoomCount,
    ...Array.from({ length: partySize + 1 }, (_, count) => count).filter((count) => count !== preferredPrivateRoomCount),
  ];

  if (bookingTotalCents && bookingTotalCents > 0) {
    for (const privateRoomCount of privateRoomCounts) {
      for (const perTravelerPriceCents of publishedPerTravelerPricesCents) {
        if (calculateExpectedBookingTotalCents({ partySize, perTravelerPriceCents, privateRoomCount, allMealsIncluded }) === bookingTotalCents) {
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
