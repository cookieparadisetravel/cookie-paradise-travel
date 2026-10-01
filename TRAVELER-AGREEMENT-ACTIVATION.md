# Traveler agreement activation and Sandbox test

The agreement system is intentionally locked while `currentTravelerAgreement` is `null` in `lib/traveler-agreement.ts`. Do not replace that value until the exact final agreement has been approved for use.

## Before activation

1. Confirm the final agreement text, payment terms, cancellation terms, minor-signature language and effective date.
2. Keep one immutable copy of the approved document in the company legal records.
3. Confirm the production database has migration `0006_white_magneto.sql` applied.
4. Add a long, unique production secret used only to hash acceptance IP addresses:

   ```sh
   npx wrangler secret put ACCEPTANCE_IP_HASH_KEY
   ```

5. Confirm `SQUARE_ENV` remains `sandbox` in `wrangler.jsonc` throughout testing.

## Activate installment testing in Square Sandbox

Square treats the production seller and the Sandbox test seller as separate accounts. A Square Plus trial on the live travel-company account does not activate installment requests in Sandbox.

1. Open the Square Developer Console and select the application's default Sandbox test account.
2. Choose **Square Dashboard** for that test account.
3. In the Sandbox Dashboard, open **Invoices > Learn more** and start the Invoices Plus trial.
4. If Square asks for a Sandbox payment method, use Square's published Sandbox test-card details rather than a real card.
5. Repeat this setup for any additional Sandbox test account used with the website.

## Activate the approved agreement

1. Replace `currentTravelerAgreement = null` in `lib/traveler-agreement.ts` with an `AgreementDocument` containing the approved text exactly as approved.
2. Give it a unique immutable version, such as `2026-10-01`, and the correct effective date.
3. Do not edit an activated version in place. Any later wording change requires a new version and new traveler acceptances.
4. Run:

   ```sh
   npm ci
   npm run lint
   npm run build
   npx tsc --noEmit
   ```

5. Commit and push the activation as a separately identifiable commit. Wait for the Cloudflare deployment to succeed before creating links.

## End-to-end Sandbox test

Use a test inquiry and email addresses you control. Do not use real traveler data for this test.

1. Open `/admin/inquiries` through Cloudflare Access.
2. Add every traveler shown in the test inquiry's party size. Include one adult and one minor when testing the minor workflow.
3. Confirm the Square invoice area remains locked because no agreement has been accepted.
4. Select **Create secure link** for the adult, copy the one-time link and open it in a private browser window.
5. Confirm the page shows the correct agreement version, effective date, traveler name and complete approved text.
6. Complete every required acknowledgement and submit the adult acceptance. Confirm the same link cannot be accepted twice.
7. Create and open the minor's link. Confirm the parent or guardian name and relationship are required, then submit the acceptance.
8. Return to `/admin/inquiries` and refresh. Confirm every traveler shows **Current agreement accepted** and the invoice lock is removed only after all required travelers have accepted.
9. Enter the confirmed total booking price and review the confirmation screen. Confirm it states that issuing the invoice records the Company's acceptance of the booking and shows the correct monthly payment schedule.
10. Create the Square Sandbox invoice. Confirm the single invoice contains the $500-per-traveler reservation deposit plus every scheduled installment, or one full-payment request when accepted within 90 days of departure. Confirm the customer receives only a Sandbox invoice and the dashboard stores the Square link and status.
11. In Square Sandbox, make a test payment. Confirm the signed webhook updates the dashboard without allowing an older event to replace a newer invoice version.

## Pass criteria

- Links contain a random token; the database stores only its hash.
- Creating a replacement link revokes the earlier unused link.
- Expired, revoked and already accepted links cannot record another acceptance.
- The acceptance record contains the immutable agreement version and document hash.
- A minor acceptance records the guardian as signer.
- Square invoicing remains locked until the traveler count and current-version acceptance count both equal the inquiry party size.
- The dashboard calculates equal monthly balance installments beginning one month after acceptance and completing no later than 90 days before departure.
- One Square invoice contains the reservation deposit and all scheduled installments unless the booking is accepted within 90 days of departure. Automatic card charges remain disabled.
- The Square environment remains Sandbox for the entire test.

## After testing

Delete or clearly label test inquiries in operational records. Keep Square in Sandbox until the live account is approved, the insurance and legal documents are complete, and a deliberate production-readiness review authorizes the switch.
