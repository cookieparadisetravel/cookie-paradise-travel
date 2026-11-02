# Inquiry sales process

Guide requests and full inquiries share the same sales stages and a durable sales-process record in the existing `/admin/inquiries` dashboard. A guide request starts as New without creating a booking, guessing room preferences or creating traveler records.

## Daily workflow

1. Open **Inquiries**. **Next sales actions** prioritizes dated follow-ups due today or earlier, new customers, consultations and other open actions. Dates use Indiana time.
2. Open an inquiry. Use **Mark contacted** after personal outreach to move New to Considering. Save a next action and follow-up date; record questions and conversations in the dated Notes section.
3. Calendar synchronization checks up to 25 eligible inquiries each hour, rotating checks across active inquiries. A matching confirmed 30-minute consultation moves New to Considering, records the appointment time and suppresses consultation reminders. Calendar failures never count as a booking or advance the stage. Existing reminder jobs retain their own fresh calendar check before sending.
4. Use **Mark consultation booked** if you need to record a booking manually. Use **Record call completed** after the actual conversation. A past appointment alone does not prove the customer attended.
5. When appropriate, choose **Start booking · Email secure link**. This sends a seven-day, single-use link for June 1–8, 2027. It contains saved contact information and collects the remaining trip details. Sending this invitation does not start agreements or payment steps. The customer explicitly starts booking by submitting the form.
6. The completed handoff connects that same sales process to its booking record and enters the existing traveler-list/agreement/payment flow. The original guide, source, referral, consultation, notes and follow-up history stay connected. An information inquiry with an existing booking record is upgraded in place.
7. Manage agreements, payment and Reserved status through the existing booking controls. Waitlist and Closed remain available. Closed and Reserved inquiries are excluded from open sales actions.

The invitation button changes to **Email replacement booking link** after a previous attempt. A replacement revokes the earlier unused link. Provider timeouts or uncertain responses are recorded and are never automatically resent; review delivery before requesting a replacement.

## Data and safeguards

- Migration `0026_mean_natasha_romanoff.sql` creates only three new tables and indexes: `inquiry_sales`, `inquiry_sales_notes`, and `inquiry_booking_invitations`. Runtime initialization is idempotent and works before or after applying the migration.
- Existing guide/booking records, agreement documents, payment records and historical notes are retained. Existing notes remain readable together with new sales notes.
- Existing records are linked automatically only when the relationship is unambiguous. Multiple independent bookings sharing an email remain separate bookings.
- An ordinary new website booking can continue an active, unconverted guide inquiry. A missing referral cookie does not erase the saved guide referral.
- A genuinely fresh guide request after closure starts a new sales cycle while retaining the earlier booking and notes. An additional guide request never moves an active booking backward.
- The sales stage remains backed by the existing inquiry status. Guide-only inquiries cannot be marked Reserved.
- Booking tokens have 256 bits of randomness; only hashes are stored. Expired, revoked and closed-inquiry links cannot start a booking. Completion and linkage occur in one D1 batch, with a completion nonce to prevent duplicate bookings and repeat automation.
- Existing agreement invitations, company acceptance or invoices prevent the handoff from changing a booking. Saved seller-of-travel residency holds and explicit newsletter consent are preserved. Manually entered traveler details are retained.
- Production/Sandbox separation and all existing agreement, residency and automatic-booking checks remain in force. Protected agreement files, deployment flags and HSTS are unchanged.
- The new private owner APIs require owner authorization and same-origin checks for writes. The customer booking page is not indexed or cached and sends no referrer information.
- Consultation tracking does not send new marketing emails. News opt-in remains separate, and no MailerLite setup is required for this workflow.

## Conversion counts

The dashboard counts guide inquiry cycles, consultations booked, bookings explicitly started and Reserved bookings, with a breakdown by referral, website/Facebook source and stored campaign name. Repeated requests in an active cycle do not inflate the count. Returning customers can start a new cycle after closure. Historical conversion counts depend on available calendar/source records; no missing history is invented.

## Verification

Run `npm test`, `npx tsc --noEmit`, `npm run lint` and `npm run build`. The tests exercise actual SQLite queries, note retention, stage changes, secure handoff completion, concurrent retries, expiry/revocation, document locks, saved residency holds, calendar failure and authorization. Email/calendar calls in tests are isolated stubs and do not contact customers.

For a signed-in owner review, open a test guide inquiry, save a next action and note, and verify they persist on refresh. Send a booking invitation only to your own test email, complete the required booking form, and confirm that the same sales process and notes appear on its booking inquiry. Existing agreements and payment controls should continue to behave as before.
