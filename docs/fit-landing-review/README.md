# Vietnam FIT landing page review

A new `/fit` page for custom, independent Vietnam travel, prepared from production main `83df892efcfa9917ebd0788d6806e0baa2575ddd`. The user confirmed Vietnam as the destination scope. The owner approved publication, with service fees left for a later decision. Deployment is tracked in pull request #13; no production settings changes are required.

## Research and design decisions

The primary benchmarks were [EXO Travel's tailormade service](https://www.exotravel.com/tailormade) and [Audley's Vietnam page](https://www.audleytravel.com/vietnam). These are examples of how established operators present the service, not evidence of a measured conversion uplift.

- EXO begins planning with travelers' needs, interests and budget and presents itineraries as starting points. The new page explains flexibility in dates, pace, room preferences and experiences, with clearly illustrative journey ideas.
- Audley pairs destination inspiration with personal specialist expertise and an invitation to talk. The page introduces Trung using facts and a portrait already on the existing website, and ends in the existing free 30-minute consultation flow.
- Audley explains that custom-trip prices depend on the individual itinerary. The page uses individually quoted arrangements rather than assigning the group departure's prices, supplement or payment terms to FIT travel.
- Editorial hierarchy, asymmetrical local photography, readable text, clear navigation, accessible native FAQ controls and mobile layout checks support exploration and the next step. These are implementation choices, not performance claims.

The design retains Playfair Display, Valley Sans, existing brand colors and previously approved photo assets/credits. The final landing-page headers share the newly supplied complete company logo; see ../company-logo-review. Copy is original. No reviews, service guarantees, accreditation badges or supplier relationships were invented.

## Conversion and referral behavior

The main hero button links to the planning section. That section reuses the existing consultation component and Google Calendar booking URL. An alternate email action prepares an editable message to `trung@cookieparadise.co` with optional dates, party, interests, trip length and budget prompts. It is explicitly labeled as an email action, does not send automatically and does not claim the message has been received.

The page reads the existing referral cookie through the existing partner resolver/provider. Referred visitors see the appropriate partner branding and existing disclosure; the prepared email includes the partner's name and code. Existing cookie persistence, referral routing, commission configuration and group booking/payment logic are untouched. Consultation bookings use the existing scheduler; this change does not add referral tracking to the external scheduler or create FIT records in the owner inquiry dashboard.

A homepage footer link and sitemap entry make the new page discoverable. The shared photo component gains an optional `priority` prop for the new hero; existing photos retain lazy loading by default.

## Service positioning and business policies

The owner confirmed broad flexibility: help with one arrangement, selected portions of an existing plan, a full journey, family visits, celebrations or other special requests. The hero, approach section, email prompts and FAQs now make this explicit. Arrangements, feasibility, availability and prices are confirmed in each proposal.

The initial call remains free under the existing offering. No new planning fee, advertised minimum budget, supplier relationship or round-the-clock support promise was adopted. The existing group departure remains a separate offering. The new pricing and service research below is for the owner's decision, not a set of terms automatically applied to this website.

### Comparable-service research, November 2, 2026

| Operator | Published practice |
| --- | --- |
| [Local Vietnam](https://localvietnam.com/tailor-made-vietnam-tour/) | Free custom proposals, budget-based trip quotes and direct local-team contact through WhatsApp during travel. |
| [What About Vietnam](https://www.whataboutvietnam.com/trip-plan-request-form) | US$150 upfront, nonrefundable full-trip planning fee, credited toward the trip when the client books the tour with them. |
| [Wellness Vietnam](https://wellnessvietnam.com/planning-fees/) | Planning fees of $300 for up to seven days, $500 for 8–14 and $700 for 15–21. Separate from the trip price and nonrefundable; includes up to two revision rounds. Its [custom trips page](https://wellnessvietnam.com/custom-trips/) addresses individuals, couples, families and private groups. |
| [Scott Dunn](https://www.scottdunn.com/us/about/why-scott-dunn/how-we-work) | Phone or online inquiry, a designated specialist, a refined quote, then booking. Advertises 24/7 support backed by global offices. |

These examples show several pricing approaches, not a single industry standard. Recommended options for discussion: keep the first call free, quote individual requests on scope, and consider a credited planning fee for extensive itinerary design. Keep the audience broad, identify the relevant operating/support contacts in each proposal, and consider a dedicated short FIT inquiry form alongside the call option. No fee or backend-form policy has been implemented by this research update.

## Verification

- Production build: passed, including the new dynamic `/fit` route.
- TypeScript: passed.
- ESLint on changed source files: no errors; homepage retains its existing image warnings.
- Existing automated suite: 193 tests passed on the initial feature. This follow-up changes copy only; the build, TypeScript, focused lint and phone layout checks were repeated successfully.
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
