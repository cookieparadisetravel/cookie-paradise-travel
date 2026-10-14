# Salon referral pilot

Prepared against `main` commit `f22091e`. This branch prepares the feature; it has not been deployed to the public website.

## Visitor experience

- Gossip Nails: https://cookieparadisetravel.com/r/gossip-nails
- Nails Station & Spa: https://cookieparadisetravel.com/r/nails-station
- Query links `/?ref=gossip-nails` and `/?ref=nails-station` also work.
- A referral link sets a first-party HttpOnly cookie for 90 days and redirects to the existing trip page. Following a different salon link replaces the previous attribution. Clearing cookies or using a different browser loses unsaved attribution.
- The official salon logo appears beside Cookie Paradise's logo and in the inquiry form. The inquiry form discloses that the salon may receive a commission.
- The validated cookie code is saved with the inquiry and included in the owner-notification payload. It remains attached to the inquiry after the visitor's cookie expires. Existing inquiries retain a null referral code.
- Logo files are copied unchanged from the official websites. Their different backgrounds preserve readability. Logos are served locally.
- SVG and PNG QR files are in `public/referrals/`. The owner dashboard also has QR downloads. Links become usable after deployment.

## Owner workflow

1. Open the owner dashboard and select **Referrals**, or visit `/admin/referrals`.
2. For each salon, record the actual date its promotional materials were received. This starts its separate 90-calendar-day pilot, including that first day. Example: October 13, 2026 through January 10, 2027.
3. Review attributed inquiries and traveler records. An inquiry does not itself earn a commission.
4. After full payment and the completed trip, review each actual traveler. Enter the date by which both the signed agreement and cleared deposit requirements were met, and confirm that the traveler completed the trip without cancellation or refund. The inquiry and qualifying date must be within that salon's pilot.
5. The server requires an existing signed agreement for the traveler, a fully paid Production invoice, and that the eight-day departure has ended. Deposit/signature timing and actual trip operation are manually verified by the owner because the existing payment records do not provide all of that evidence automatically.
6. Each confirmed successful traveler earns the salon $100; every group of five adds another $100. Totals are calculated separately for each salon, with no cap. Repeat confirmations update the same traveler record and cannot count that traveler twice.
7. Use **Remove from successful count** when a cancellation, refund, or correction disqualifies a previously reviewed traveler. This keeps the review record but recalculates earnings. Review changes record the owner's email and time. The pilot start date becomes locked after any traveler review exists.
8. Pay the salon owner and record the payment in your accounting. The dashboard displays calculated earnings and does not initiate transfers or track payouts.

The payout workflow implements the proposed successful-traveler definition: signed agreement and initial deposit during the pilot, followed by full payment and an operated trip. These are operational program rules, not changes to the Traveler Agreement.

## Install and publish

Review and merge the `salon-referral-pilot` branch. The download package contains complete changed and new files with their repository paths; do not replace unrelated project files.

Before deploying this branch to the live Worker, apply the additive database migration from the branch:

```bash
npx wrangler d1 migrations apply cookie-paradise-travel-db --remote
```

Migration `0019_nosy_pyro.sql` only creates two new referral tables and adds the nullable `booking_requests.referral_code` column. It does not alter or delete prior data or migration files. Apply it before deploying code that selects or writes the new column. Do not re-run migration generation when using the supplied generated migration and metadata.

The existing GitHub-to-Cloudflare main-branch deployment can then publish the reviewed change. No new npm packages, secrets, Worker bindings, or configuration variables are required. Existing payment environment, automation settings, agreement files, and security configuration are untouched.

After deployment:

- Open each `/r/` link in an incognito browser, check its logo beside Cookie Paradise, and open every available booking-form trigger at desktop and phone widths.
- Submit your own test information with **I would like more information**. Confirm that the right salon appears on the resulting inquiry and in the referrals dashboard. Use a separate incognito session for a direct inquiry and confirm it has no salon attribution.
- Test switching from one salon link to the other in the same browser and confirm the latest link wins.
- Record materials-delivery dates when the salons actually receive the materials.
- Try each printed QR code on a phone before distributing promotional materials.

## Validation performed

- `npm test`: 81 passing tests, including nine referral tests covering dates, payouts, redirects, allowlisted attribution through the real booking API, duplicate reviews, reversals, authentication and disqualifying payment/traveler states.
- `npx tsc --noEmit`: passed.
- `npm run lint`: zero errors; seven image optimization warnings.
- `npm run build`: passed; new referral routes appear in the build inventory.
- Both generated PNG QR codes were decoded and checked against the exact referral URLs. SVG and PNG versions use the same encoded matrices with standard quiet zones.
- Browser layout and a live submission were not tested in this environment. No public deployment, live database migration, customer email, or commission payout was performed.

## Logo sources

- Gossip Nails header logo: https://gossipnailscolumbus.com/wp-content/uploads/2025/06/z6696149567979_58fb34533b3003c392fef781ca4ec4a0-1.png
- Nails Station & Spa header logo: https://nailsstationandspa.com/wp-content/uploads/2024/02/NAILS-STATION-SPA-logo-header-1.png
