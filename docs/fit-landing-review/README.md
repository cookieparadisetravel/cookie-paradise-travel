# Vietnam FIT landing page review

A new `/fit` page for custom, independent Vietnam travel, prepared from production main `83df892efcfa9917ebd0788d6806e0baa2575ddd`. The user confirmed Vietnam as the destination scope. This is a draft for review; no production deployment or settings changes were made.

## Research and design decisions

The primary benchmarks were [EXO Travel's tailormade service](https://www.exotravel.com/tailormade) and [Audley's Vietnam page](https://www.audleytravel.com/vietnam). These are examples of how established operators present the service, not evidence of a measured conversion uplift.

- EXO begins planning with travelers' needs, interests and budget and presents itineraries as starting points. The new page explains flexibility in dates, pace, room preferences and experiences, with clearly illustrative journey ideas.
- Audley pairs destination inspiration with personal specialist expertise and an invitation to talk. The page introduces Trung using facts and a portrait already on the existing website, and ends in the existing free 30-minute consultation flow.
- Audley explains that custom-trip prices depend on the individual itinerary. The page uses individually quoted arrangements rather than assigning the group departure's prices, supplement or payment terms to FIT travel.
- Editorial hierarchy, asymmetrical local photography, readable text, clear navigation, accessible native FAQ controls and mobile layout checks support exploration and the next step. These are implementation choices, not performance claims.

The design retains Playfair Display, Valley Sans, existing brand colors, logo treatment and previously approved photo assets/credits. Copy is original. No reviews, service guarantees, accreditation badges or supplier relationships were invented.

## Conversion and referral behavior

The main hero button links to the planning section. That section reuses the existing consultation component and Google Calendar booking URL. An alternate email action prepares an editable message to `trung@cookieparadise.co` with optional dates, party, interests, trip length and budget prompts. It is explicitly labeled as an email action, does not send automatically and does not claim the message has been received.

The page reads the existing referral cookie through the existing partner resolver/provider. Referred visitors see the appropriate partner branding and existing disclosure; the prepared email includes the partner's name and code. Existing cookie persistence, referral routing, commission configuration and group booking/payment logic are untouched. Consultation bookings use the existing scheduler; this change does not add referral tracking to the external scheduler or create FIT records in the owner inquiry dashboard.

A homepage footer link and sitemap entry make the new page discoverable. The shared photo component gains an optional `priority` prop for the new hero; existing photos retain lazy loading by default.

## Business details to confirm before publication

Exact bookable services, planning fees or minimum budget, ideal traveler focus, the operating partner and in-country assistance arrangements remain for the owner to define. The draft therefore describes a planning conversation and individually agreed proposals rather than promising specific inclusions or round-the-clock support. The existing group departure remains a separate offering.

## Verification

- Production build: passed, including the new dynamic `/fit` route.
- TypeScript: passed.
- ESLint on changed source files: no errors; homepage retains its existing image warnings.
- Existing automated suite: 193 tests passed.
- Diff whitespace check: passed.
- Rendered HTML checks: one H1; all local fragment links resolve; image files and alt text exist; new hero is eager/high-priority; the scheduler URL matches current configuration.
- Direct and two referral render checks: email subject/body correct; Columbus Uppercuts and Gossip Nails attribution appears only in the appropriate prepared email.
- Browser review: desktop and 320/375/430 CSS-pixel phone widths, including the 375px referral header; no horizontal page or text/link/summary overflow. The mobile header action remains hidden.
- Native hero-to-planning navigation and FAQ expansion work in the visual proof.

The browser proof uses static markup rendered from the actual components and production CSS. Cookies are stubbed to select each referral example and client hydration is omitted. This environment's full Worker preview cannot run the production compatibility date; production configuration was preserved. No consultation was booked, no email was sent, and group booking/payment transactions were not exercised.

## Screenshots

- [Desktop opening](desktop-hero.jpg)
- [Journey ideas](journey-ideas.jpg)
- [Planning and contact](planning.jpg)
- [Phone and referral layouts](mobile.jpg)
