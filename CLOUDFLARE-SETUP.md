# Cloudflare setup

This project deploys from GitHub as a Cloudflare Worker at `cookieparadisetravel.com`. It does not use a `workers.dev` address.

## 1. Install and sign in

Install Node.js 22, clone the repository, and run:

```sh
npm ci
npx wrangler login
```

## 2. Create or confirm the D1 database

The production database is named `cookie-paradise-travel-db`. List the account's databases:

```sh
npx wrangler d1 list
```

If it does not exist, create it:

```sh
npx wrangler d1 create cookie-paradise-travel-db
```

Copy the returned database ID into the `DB` entry in `wrangler.jsonc`. Keep `migrations_dir` set to `drizzle`, then apply every pending migration:

```sh
npx wrangler d1 migrations apply cookie-paradise-travel-db --remote
```

## 3. Add runtime secrets

Run each command and enter the value only when Wrangler prompts. Never commit these values:

```sh
npx wrangler secret put ADMIN_OWNER_EMAIL
npx wrangler secret put CF_ACCESS_TEAM_DOMAIN
npx wrangler secret put CF_ACCESS_AUD
npx wrangler secret put MAILERLITE_API_TOKEN
npx wrangler secret put MAILERLITE_GROUP_ID
npx wrangler secret put OWNER_NOTIFICATION_WEBHOOK_URL
npx wrangler secret put TURNSTILE_SECRET_KEY
npx wrangler secret put ACCEPTANCE_IP_HASH_KEY
npx wrangler secret put ACCEPTANCE_RECORD_SIGNING_KEY
npx wrangler secret put AGREEMENT_OTP_HASH_KEY
npx wrangler secret put MAILERSEND_API_TOKEN
npx wrangler secret put SQUARE_ACCESS_TOKEN
npx wrangler secret put SQUARE_WEBHOOK_SIGNATURE_KEY
```

Keep `SQUARE_ENV` set to `sandbox` while preparing production. Production uses separate values, which can be loaded without changing the live Sandbox flow:

```powershell
npx wrangler secret put SQUARE_PRODUCTION_ACCESS_TOKEN
npx wrangler secret put SQUARE_PRODUCTION_LOCATION_ID
npx wrangler secret put SQUARE_PRODUCTION_WEBHOOK_SIGNATURE_KEY
```

Do not change `SQUARE_ENV` to `production` until the production webhook is configured and the complete production-readiness checklist has been approved. The application deliberately does not fall back to Sandbox credentials in Production mode.

Use separate, randomly generated values for `ACCEPTANCE_IP_HASH_KEY`, `ACCEPTANCE_RECORD_SIGNING_KEY` and `AGREEMENT_OTP_HASH_KEY`. Square's sandbox settings and the verified MailerSend sender identity are non-secret values configured in `wrangler.jsonc`.

Before agreement invitations are activated, verify `cookieparadisetravel.com` as a sending domain in MailerSend and create an API token. The site uses MailerSend only for secure agreement links, verification codes and signed PDF copies; MailerLite remains the marketing-email provider.

## 4. Configure the Square webhook

In the Square Developer Console, open the application used by this site and add a webhook subscription with:

- Notification URL: `https://cookieparadisetravel.com/api/square/webhook`
- Events: `invoice.payment_made`, `invoice.updated` and `invoice.scheduled_charge_failed`

Copy the subscription's signature key into the `SQUARE_WEBHOOK_SIGNATURE_KEY` Wrangler secret above. The notification URL must exactly match `SQUARE_WEBHOOK_NOTIFICATION_URL` in `wrangler.jsonc` for signature verification to succeed.

## 5. Add build variables

In the Worker dashboard, open **Settings → Build → Build Variables and Secrets** and add:

- `NODE_VERSION` = `22`
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` = the public Turnstile site key

The repository also contains `.node-version` as a second Node 22 pin.

## 6. Protect the owner dashboard

In Cloudflare Zero Trust, create one or more self-hosted Access applications that protect both:

- `cookieparadisetravel.com/admin/*`
- `cookieparadisetravel.com/api/admin/*`

Create an Allow policy for the owner email. Copy the Access team domain and application audience tag into the `CF_ACCESS_TEAM_DOMAIN` and `CF_ACCESS_AUD` secrets above.

## 7. Connect GitHub and deploy

Connect the GitHub repository `cookieparadisetravel/cookie-paradise-travel` to the Worker and use:

- Install command: `npm ci`
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy --config dist/server/wrangler.json`
- Root directory: `/`

The custom domains and D1 binding are declared in `wrangler.jsonc`, so every Git deployment preserves them. Push to the connected `main` branch to deploy.

## 8. Verify

After deployment:

1. Open `https://cookieparadisetravel.com` and submit a sandbox inquiry.
2. Confirm the inquiry appears in the Access-protected `/admin/inquiries` dashboard.
3. Confirm Turnstile, owner notification and optional MailerLite signup work.
4. Send a Square sandbox webhook test and confirm it receives a successful response.
5. Confirm the Worker has a Browser Rendering binding named `BROWSER`; `wrangler.jsonc` declares it for agreement PDF generation.
6. Use Square sandbox only until the live Square account and business review are complete.

## 9. Activate and test traveler agreements

Do not activate the agreement until the final version has been approved for use. Follow [TRAVELER-AGREEMENT-ACTIVATION.md](./TRAVELER-AGREEMENT-ACTIVATION.md) to version the approved text, test one adult and one minor acceptance, confirm the invoice lock, and create a Square Sandbox invoice.

## 10. Unsigned agreement reminders

The custom `worker.ts` entry delegates web requests to vinext and handles an hourly Cron Trigger (`0 * * * *`). With `AGREEMENT_REMINDERS_ENABLED=true` and `SQUARE_ENV=production`, it sends one reminder per traveler on the first hourly run at least seven full days after the earliest successfully sent agreement email. Sending a replacement invitation does not restart this clock. Existing eligible unsigned agreements are included; expired/revoked links, signed travelers, inactive or waitlisted bookings, past departures, screened bookings and Sandbox records are excluded.

The first agreement lookup or enabled reminder run initializes the new reminder table and unique index through the existing D1 binding. Initialization uses idempotent statements in a D1 batch, is cached per isolate, and is retried if setup fails. It does not alter existing tables or bookings. No separate Cloudflare login or new credential is needed for deployment.

The same additive migration can also be applied through the normal migration workflow:

```bash
npx wrangler d1 migrations apply cookie-paradise-travel-db --remote --config wrangler.jsonc
```

`0020_agreement_reminders.sql` is idempotent, so applying it after automatic initialization is also safe. The normal build/deploy flow preserves the Cron Trigger in `dist/server/wrangler.json`. No additional email credentials are required beyond the existing MailerSend configuration. Set `AGREEMENT_REMINDERS_ENABLED=false` to pause reminders.

Reminder links point to the same stored invitation as the first email. Original links remain valid, and both links share expiration, verification, revocation and acceptance. Signing either link prevents further signing through the other.

The `agreement_reminders` table records the original email date, invitation, claim, delivery status and provider message ID. A unique traveler key prevents overlapping scheduled runs from sending a second reminder. If a provider response is lost or sending fails, the record is retained as `failed` (or `sending` if execution stopped); it is not automatically retried because the provider might already have accepted the email. Check MailerSend delivery logs before manually recovering such a record. Missing email configuration fails the job before claiming any traveler. No full signing tokens or email contents are written to logs.

## 11. Inquiry consultation reminders

The same hourly worker handles information inquiries separately from agreement reminders. With `INQUIRY_REMINDERS_ENABLED=true`, production inquiries with `booking_intent=needs_information` receive a consultation invitation after three full days and another after seven full days from their first inquiry. Each email includes the existing Google Calendar appointment link. The delivery may occur up to an hour after the threshold. Repeated submissions with the same normalized email do not restart the clock or create extra reminders. If activation or an outage happens after day seven, only the seven-day email is sent; both emails are never sent together to catch up.

Every send requires a fresh, successful read of the consultation calendar. If an existing 30-minute consultation is found by matching the inquiry email to the event attendee or Google appointment's Booked by section, the email is skipped and the address is permanently suppressed from subsequent inquiry reminders. Both past and future appointments count; canceled events are ignored unless a prior run already recorded the booking. Customers should use the same email on the inquiry and appointment. Different addresses cannot be reliably matched automatically.

### One-time calendar connection (required before reminders can run)

1. In Google Cloud, enable the Google Calendar API and create a service account with a JSON key. No domain-wide delegation is needed. Never commit the key.
2. Share the calendar `trung@cookieparadise.co` with that service account's `client_email` using **See all event details**. Ensure consultation appointment events inherit calendar visibility instead of being marked Private. The service account must be able to read the appointment title and booking email, including past and future appointments.
3. Save the JSON key as the Worker secret `GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON`, using the Cloudflare dashboard or `npx wrangler secret put GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON`. The code requests only the `calendar.events.readonly` scope. `CONSULTATION_CALENDAR_ID` is declared in `wrangler.jsonc`.
4. Verify read access with a known consultation booking before enabling delivery in production. Without the secret, reminders remain paused. API errors, incomplete pagination, invalid credentials and unavailable calendar details defer sending for the next hourly run.

The ChatGPT calendar connection cannot be used as the website's server credential. Set `INQUIRY_REMINDERS_ENABLED=false` to pause this feature independently. Agreement reminders keep running if calendar access fails.

Only consented, active information inquiries for future/flexible departures qualify. Customers who move into booking, receive an invoice, withdraw contact consent, or have a closed/waitlisted inquiry are excluded. Sandbox records and screened states are excluded. Existing eligible inquiries are included when activated. Stored claims are unique by normalized email and day; ambiguous provider failures require manual delivery-log review before retrying. No automatic retries follow an attempted send. A crash before sending may leave a `sending` claim for manual review.

The additive `0021_inquiry_reminders.sql` migration creates delivery records and minimal booking-suppression records (email and observation time only). The enabled job safely initializes these new tables through D1; the idempotent migration may also be applied with the normal D1 migration command. It does not modify existing inquiry records. Appointment booking can occur in the short interval between the calendar check and email submission; the next reminder always checks again.

### Owner-only live tests

Open `/admin/reminder-tests` or select **Test reminders** in the inquiry dashboard. The page and POST endpoint require the existing verified owner authentication. POST requests must include a same-origin Origin header. No customer data is written by these tests.

**Check calendar & booking** uses the exact calendar lookup used by automatic reminders. A successful check confirms the website's server credentials can read event details. Enter the email of a known booked consultation to verify booking detection, and then an unbooked test email to verify the negative result. The result checks only calendar booking status, not all other inquiry eligibility conditions. Calendar error responses never expose the service-account key or provider response.

**Send both test emails to me** sends the actual production day-three and day-seven templates through MailerSend, with TEST subjects and a visible preview notice. The recipient is always the owner identity verified by Cloudflare Access; the browser cannot choose a recipient. Each delivery reports provider acceptance separately, rather than claiming inbox delivery. Partial failures are not automatically retried. Check MailerSend activity and the owner's inbox before repeating an unconfirmed test. Previews intentionally bypass timing and booking suppression and do not write reminder claims or alter inquiry dates; they do not replace the automated timing and duplicate-protection tests.
