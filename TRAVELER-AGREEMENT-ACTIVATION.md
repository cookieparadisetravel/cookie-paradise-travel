# Traveler Agreement 1.0 workflow and Sandbox test

Traveler Agreement 1.0 is active. The approved base text is stored in `lib/traveler-agreement-v1.json`; `lib/traveler-agreement.ts` adds each traveler’s confirmed name, occupancy, Trip Price, payment choice and completed Schedule 1. Every invitation stores the exact personalized document and SHA-256 hash that the traveler receives.

Do not edit Agreement 1.0 after it has been used. Later legal revisions must be activated as a new version and require new acceptances before any further invoice is issued.

## Required production configuration

1. Keep `SQUARE_ENV` set to `sandbox` until production payments are deliberately approved.
2. Store a long, unique signing key and IP-hash key as Cloudflare secrets:

   ```sh
   npx wrangler secret put ACCEPTANCE_RECORD_SIGNING_KEY
   npx wrangler secret put ACCEPTANCE_IP_HASH_KEY
   ```

3. Apply every pending additive D1 migration before testing the deployed workflow:

   ```sh
   npx wrangler d1 migrations apply cookie-paradise-travel-db --remote
   ```

4. Confirm the Worker has its Browser Run binding and MailerSend runtime secrets.

## Booking order

1. Collect exactly one traveler record for every person in the inquiry.
2. In **Travelers**, enter each traveler’s confirmed Trip Price and shared/private occupancy, then save the allocation.
3. In **Payments**, verify that the group total equals the sum of the traveler prices and create the secure payment-choice link.
4. The primary contact chooses full payment or the $500-per-traveler deposit plus monthly installments. The site stores that choice and prepares an unpublished Square Sandbox draft with the exact schedule.
5. Send each traveler’s personalized Agreement 1.0 link. Adults sign separately; a parent or guardian signs for each minor.
6. Each signer verifies the recipient email, reviews the complete personalized agreement and Schedule 1, makes the required separate acknowledgments, signs electronically, and receives a signed PDF by email.
7. Only after the traveler count and current Agreement 1.0 acceptance count exactly match the party size may the owner publish the existing Square invoice draft.

## End-to-end Sandbox test

Use a test inquiry and email addresses you control. Do not use real traveler data.

1. Complete the booking order above, including one adult and one minor when testing guardian signing.
2. Confirm each agreement displays the correct traveler, departure, occupancy, Trip Price, payment choice and exact Schedule 1.
3. Confirm a used, replaced, revoked or expired agreement link cannot record another acceptance.
4. Confirm the dashboard records the signed count but keeps the Square draft locked until every traveler has signed.
5. Publish the draft from the owner dashboard and confirm Square emails only one Sandbox invoice to the primary contact.
6. Confirm the Square invoice payment requests exactly equal the combined individual schedules.
7. Make a Sandbox payment and confirm the signed webhook updates the persisted invoice status.

## Before production

- Confirm no Cloudflare variable named `ALLOW_SANDBOX_INVOICE_WITHOUT_AGREEMENT` exists.
- Keep HSTS off unless it is separately reviewed and approved.
- Complete a deliberate Square production-readiness review, confirm the production webhook signature key and URL, and change `SQUARE_ENV` only as part of that controlled release.
- Preserve each signed agreement and acceptance record for the retention period stated in Agreement 1.0.
