# Homepage hierarchy and duplication cleanup

Owner requested removal of the four destination cards and the extra-cost / flexibility panel shown in two screenshots, then a flow ordered by importance using the inverted pyramid.

## Resulting reading order

1. Hero: what the trip is, dates, duration, group size, base tour price and initial call / itinerary options. Dates and group facts now appear on the hero photograph.
2. Pricing: actual group tiers, deposit/monthly terms, availability, reservation entry point and rounded complete-trip budget.
3. Inclusions: three concise groups beside the approved Duy Nguyen market photograph. Exact meal counts, domestic Hue flight, transport, guides, activities and drinking water remain clear.
4. Daily itinerary: the destination slideshow and eight expandable days are one section. Days start collapsed for a scannable overview.
5. Meet Trung: one introduction, host clarification and optional biography.
6. Practical FAQs: rooms, pace, flight airports, payment, reservation confirmation, cancellation/disruption and future dates. Signed agreement terms remain sourced from the existing summary.
7. One next-step section: call, direct PDF, email and existing itinerary request form. Retain form behavior and consent.
8. A short private-trip alternative, then footer.

## Removed or consolidated

- Both owner-selected blocks removed completely.
- Four destination cards removed; slideshow and full itinerary preserve destination information without another overview.
- Six inclusion cards condensed into three lists. Duplicate region and experience descriptions removed.
- Early private/group explainer reduced to the closing private-trip alternative; private-trip access remains in navigation and footer.
- Separate four-card booking walkthrough moved into a concise FAQ, preserving written acceptance, signatures and cleared-payment requirements.
- Repeated final consultation banner, itinerary host box, host FAQ, biography badges and repeat founder paragraph removed.
- Consultation buttons reduced from seven homepage component instances to three (header, opening, final contact section), plus the existing mobile bar. Reservation request entry remains in pricing.
- Duplicate full-inclusions paragraph removed from the expanded budget.

## Navigation and constraints

- Desktop and compact navigation follow reading priorities.
- Existing TripSectionLink now targets the combined itinerary section and focuses it, without adding a URL fragment. Legacy #journey cleanup remains untouched.
- #top, #pricing, #included, #itinerary, #daily-schedule, #about, #faq and #guide still resolve.
- No tour prices, rounded budget amounts, payment policy, agreement version, referral attribution, booking form or email subscription behavior changed.
- Existing image assets and credits retained wherever the image remains. No new external dependencies or image licenses.

Validation scope: TypeScript, production build, diff review, anchor/section-order audit, and live layout / navigation check. No customer forms submitted during QA.
