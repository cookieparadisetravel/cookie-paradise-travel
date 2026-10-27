# Customer notes deployment

The inquiry Overview uses two information columns and a third, right-hand Notes column on desktop. On smaller screens the Notes section stacks below the details. Saved updates are private to the verified owner, are separate from the customer's original message, and display server-recorded timestamps in Indiana time, newest first. Notes are append-only; retrying the same submission does not create a duplicate.

## Required additive migration

The generated migration `drizzle/0023_steady_masque.sql` and its Drizzle metadata are included. Its SQL matches the owner's reviewed migration: it only creates `inquiry_owner_notes` and the `inquiry_owner_notes_booking_created_idx` index. It does not change existing customer data. There is no need to generate another migration for this change.

Run the requested checks:

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```

Before deploying, apply the migration to the production D1 database:

```bash
npx wrangler d1 migrations apply cookie-paradise-travel-db --remote
npm run deploy
```

Confirm that the pending migration is `0023_steady_masque.sql`; inspect any other pending migrations before proceeding. Endpoint tests use this actual migration in an isolated SQLite database.

Open one inquiry's Overview, save a note, reload, and verify it persists with a date/time stamp. Open another inquiry and verify the note does not appear there. Check the original customer-submitted notes are unchanged. Notes do not alter inquiry status, booking automation, agreements, reminders, or payments.

The Notes panel calls a separate owner-only endpoint. If storage is unavailable (including before the migration is applied), the rest of the Overview still loads, and the Notes panel shows an error with a retry button. A failed save retains the draft for retry.
