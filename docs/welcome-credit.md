# Travel welcome credit

The public popup is available only on `/fit`. It opens after 18 seconds if no other dialog or form input is active. Dismissal is remembered for seven days and completion for one year; the footer button always permits manual opening. The submit button records marketing consent after a visible signup disclosure; no separate checkbox is required. Turnstile verification remains required.

MailerLite secret: `MAILERLITE_API_TOKEN` in the production Cloudflare Worker. Dedicated group: `203686368046483338` (Travel Website | $50 Welcome Offer). The one-run welcome automation is `203689896229995577`. No existing mailing groups are enrolled in this offer automatically. The homepage and Vietnam/Facebook landing page use their existing trip-guide forms instead. Those forms disclose guide-and-travel-updates signup at the submit button and sync to MailerLite’s Interest List, without issuing a credit. A new consented guide request retries an earlier failed or unconfigured sync.

Each normalized email has one durable credit record. Existing or used credits are never reset by signing up again. Only an active MailerLite subscription is marked synced. Provider errors or inactive subscriptions remain visible for review; a new submission can retry after a minute. An API upsert accepted by MailerLite does not prove inbox delivery. Never force-resubscribe suppressed contacts.

## Owner workflow

Open `/admin/welcome-credits` from the `$50 credits` link in Inquiries. Search the customer's booking email, verify their identity, and check for an unused $50 credit. Apply $50 USD to the **whole booking**, not each traveler, and record the stable booking/invoice reference after making the adjustment. A conditional database write prevents recording the same credit twice, and a unique booking reference prevents attaching multiple credits to the same reference.

The ledger does **not** adjust Square or agreement amounts. Coordinate the discount before the booking is finalized. Hosted ready-to-book submissions may automatically issue agreements; handle credit requests with the customer before that step. If agreements or invoices already exist, reconcile those documents and the payment adjustment first. Private/FIT quotes are adjusted manually. No expiry or minimum spend was introduced.

The owner-only ledger displays 100 latest matches; use exact email search for older credits. All times display in America/Indiana/Indianapolis. No public endpoint exposes stored credits or redemption details.

Storage bootstraps additively in D1, with a matching idempotent Drizzle migration. Consent and offer wording are stored with signup time and source. Rate-limit keys are hashed, expire, and are cleaned on signup. No key is exposed to the browser.
