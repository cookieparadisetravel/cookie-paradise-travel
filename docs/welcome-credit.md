# Travel welcome credit

The public popup is available on `/`, `/vietnam` (the Facebook landing page) and `/fit`. It opens after 18 seconds if no other dialog or form input is active. Dismissal is remembered for seven days and completion for one year; the footer button always permits manual opening. The popup asks only for an email address; it does not request a name or phone number. The API accepts an optional name for compatibility with earlier forms and omits an empty name from the MailerLite upsert, preserving existing subscriber names. The submit button records email marketing consent after a visible signup disclosure; no separate checkbox is required. Turnstile verification remains required.

MailerLite secret: `MAILERLITE_API_TOKEN` in the production Cloudflare Worker. Dedicated group: `203686368046483338` (Travel Website | $50 Welcome Offer). The one-run welcome automation is `203689896229995577`. No existing mailing groups are enrolled in this offer automatically. The homepage and Vietnam/Facebook landing page also retain their existing trip-guide forms. Those forms disclose guide-and-travel-updates signup at the submit button and sync to MailerLite’s Interest List, without issuing a credit. A new consented guide request retries an earlier failed or unconfigured sync.

Each normalized email has one durable credit record. Existing or used credits are never reset by signing up again. Only an active MailerLite subscription is marked synced. Provider errors or inactive subscriptions remain visible for review; a new submission can retry after a minute. An API upsert accepted by MailerLite does not prove inbox delivery. Never force-resubscribe suppressed contacts.

## Owner workflow

Open `/admin/welcome-credits` from the `$50 credits` link in Inquiries. Search the customer's booking email, verify their identity, and check for an unused $50 credit. Apply $50 USD to the **whole booking**, not each traveler, and record the stable booking/invoice reference after making the adjustment. A conditional database write prevents recording the same credit twice, and a unique booking reference prevents attaching multiple credits to the same reference.

The ledger does **not** adjust Square or agreement amounts. Coordinate the discount before the booking is finalized. Hosted ready-to-book submissions may automatically issue agreements; handle credit requests with the customer before that step. If agreements or invoices already exist, reconcile those documents and the payment adjustment first. Private/FIT quotes are adjusted manually. No expiry or minimum spend was introduced.

The owner-only ledger displays 100 latest matches; use exact email search for older credits. All times display in America/Indiana/Indianapolis. No public endpoint exposes stored credits or redemption details.

Storage bootstraps additively in D1, with a matching idempotent Drizzle migration. Consent and offer wording are stored with signup time and source. Rate-limit keys are hashed, expire, and are cleaned on signup. No key is exposed to the browser.

## November 16, 2026 review

The private-trip page now leads with the service, scope and pricing expectations, followed by the planning process, visual trip ideas, planner introduction, practical FAQs and the contact section. Repeated promises, overlapping FAQs and extra consultation copy were removed.

The restored credit popup uses a single email field, black body text and a gold button. Offer details are expandable. Existing seven-day dismissal and one-year completion preferences are respected across all three pages. Existing credits and the one-run welcome automation are retained; no phone collection or SMS enrollment was added.

Research supporting an email-first introduction:
- Intrepid markets a travel-credit email signup: https://www.intrepidtravel.com/us/subscribe
- Baymard observes phone-field hesitation in checkout and recommends explaining, making optional or removing unnecessary phone requests (checkout evidence, not a measured result for this travel site): https://baymard.com/research-articles/explain-phone-number-field
- Unbounce recommends keeping only fields necessary for the form's purpose: https://unbounce.com/conversion-rate-optimization/optimize-lead-gen-forms/

Phone details remain in the separate existing inquiry and booking flows where they serve a specific customer request. No live test signup or customer email was sent during verification.
