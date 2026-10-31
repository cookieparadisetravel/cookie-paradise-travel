# Vietnam lead campaign setup

Website landing page: https://cookieparadisetravel.com/vietnam

Protected lead inbox: https://cookieparadisetravel.com/admin/leads

Both website requests and approved Facebook Instant Forms feed the guide lead inbox. They do not create booking requests, travelers, agreements or invoices. Existing booking inquiry, agreement and Square automation is unchanged.

## Website campaigns

Use the landing page with campaign labels. Example for Columbus:

`https://cookieparadisetravel.com/vietnam?utm_source=facebook&utm_medium=paid_social&utm_campaign=vietnam_june_2027&audience=columbus&utm_content={{ad.name}}&campaign_id={{campaign.id}}&adset_id={{adset.id}}&ad_id={{ad.id}}`

Use `audience=franklin` or `audience=bloomington` for the other audiences. These are targeting labels, not proof of residence. Only the listed campaign parameters are stored; no full URL or Facebook click identifier is retained. Verify Meta resolves its dynamic placeholders in the final ad URL. No Pixel or Conversions API is installed by this change: website campaign attribution in the inbox is available, but it is not a Meta website-conversion optimization signal.

The website uses the existing Turnstile site key/secret, MailerSend settings, owner Access settings and consultation calendar connection. Guide intake accepts only the production runtime. Its customer email links to the approved, unbranded PDF at `/vietnam-trip-guide.pdf`. A successful save never promises delivery unless MailerSend accepted it. The guide remains immediately available on the thank-you screen if email delivery is not confirmed.

An owner alert goes to `ADMIN_OWNER_EMAIL` through MailerSend when both are configured. Otherwise the existing owner notification webhook is used with a new `travel_guide.requested` event; its downstream integration must support that event before relying on webhook alerts. The owner inbox is the authoritative record.

## Prepare Facebook Instant Forms

1. Open Meta Business Suite for Cookie Paradise Travel Company. Select the correct Facebook Page.
2. Open **All tools → Instant forms** (some accounts show this under **Leads Center** or in Ads Manager while creating a Leads ad).
3. Click **Create form**, choose **Higher intent**, and name it for the Vietnam June 2027 campaign.
4. Request **First name** (or **Full name**), **Email**, and **City**. Phone is optional.
5. Add a required multiple-choice question: **May Trung email you this trip guide and up to two consultation reminders if you have not booked a call?** Offer **Yes** and **No**. Explain that selecting No means the automated guide request cannot be processed; they can visit the website or book a consultation directly. Do not make newsletter consent a condition of requesting the guide.
6. Add a travel-interest multiple-choice question with **June 1-8, 2027**, **Still deciding**, and **A future departure**. Do not use conditional questions to collect payment details.
7. Add the privacy-policy URL `https://cookieparadisetravel.com/privacy` and explain that the requested guide will be emailed, with reminders on day three and seven only while no consultation or booking inquiry exists. A request is not a reservation.
8. On the completion screen, link to `https://calendar.app.google/UQ13aPW887ShwYxi9` and label it **Book a free 30-minute consultation**. Customers can also see the itinerary at the website landing page.
9. Publish the form and record its numeric form ID. Copy the numeric Page ID too. Only these explicitly approved forms will be imported.
10. Use Meta's Lead Ads Testing Tool and the lead retrieval tools to inspect the exact `field_data.name` for the required contact-permission question and travel-interest question. Meta can generate names from the question wording: do not assume the displayed label is the API field name. Set the configuration below to the exact names and check the answer is the plain string `Yes`.

## Connect the Page to the Worker

Meta menu names vary by account and app setup. Use the official Page leadgen webhook/lead retrieval workflow. A working test does not prove live access to real customer leads; complete any required Meta business verification, app review and Live mode requirements before launching ads.

1. Open **Meta for Developers → My Apps → your business app**. Add the Facebook/Page lead-generation use case or Webhooks product offered for that app.
2. Under the app's basic settings, find its **App secret**. Obtain a Page access token with the lead retrieval and Page subscription permissions appropriate to this app and Page (`leads_retrieval` and `pages_manage_metadata`, plus the additional Page access permissions Meta requests). Give the app access to the Page's leads in Business Settings/Leads Access. Use the supported API version shown for your app; this implementation intentionally has no guessed default version.
3. Generate a long, random verification token in a password manager. Keep all tokens and secrets out of chat, the repository and campaign URLs.
4. Open **Cloudflare Dashboard → Workers & Pages → cookie-paradise-travel → Settings → Variables and Secrets → Add**.
5. Add the following as **Secret** values:
   - `META_APP_SECRET`: the Meta app secret.
   - `META_PAGE_ACCESS_TOKEN`: the Page access token.
   - `META_WEBHOOK_VERIFY_TOKEN`: your new random verification token.
6. Add the following text variables, then click **Deploy** to apply the settings:
   - `META_PAGE_ID`: the one approved numeric Page ID.
   - `META_FORM_IDS`: approved numeric form IDs, separated by commas.
   - `META_GRAPH_API_VERSION`: the supported version for your app, including its `v` prefix.
   - `META_CONTACT_CONSENT_FIELD`: the exact `field_data.name` of the required Yes/No permission question.
   - `META_TRAVEL_TIMING_FIELD`: the exact `field_data.name` of the travel-interest question. Without this setting it defaults to `travel_interest`, and a missing answer becomes Still deciding.
7. Return to the Meta app: **Webhooks → Page → Add callback URL**. Set the callback to `https://cookieparadisetravel.com/api/meta/leads` and enter the same verification token. Click **Verify and save**.
8. Subscribe to **leadgen**. Also subscribe the app to the actual Facebook Page (the Page's `subscribed_apps` edge); configuring the app callback alone does not install it on the Page. Meta's API tools can perform that step with the Page token. Never put the token into a public URL or share it in a screenshot.
9. In the Lead Ads Testing Tool, select the approved Page and form, create a test lead using an email you control and a Yes permission answer, and check **Track status**.
10. Sign into the existing owner dashboard and open **Trip guide leads**. Confirm the lead shows Meta source, correct city/interest/ad ID, one guide email, and no booking inquiry. Confirm the guide email contains the PDF, correct consultation link and reminder-stop link. Delete a previous test lead in Meta's testing tool before generating another for the same form if Meta only permits one.
11. Submit the same email through the website form. It should remain one lead with two source submissions, without another guide email or a new reminder clock. Mark the test lead **Closed** after testing.
12. Test a No permission answer: it must be acknowledged without creating a lead or sending an email. A missing or unrecognized permission field is treated as a configuration error for review. Test an unapproved form: it is acknowledged and ignored. Unsigned or modified requests are rejected.

Official reference: https://github.com/facebookincubator/catalogue-of-api-solutions/blob/main/solutions/leads/leads-retrieval-set-up-checker.md

## Owner workflow and reminders

- Use `/admin/leads` for guide requests and `/admin/inquiries` for booking inquiries; navigation connects them. A matching booking inquiry has a direct link from its guide lead.
- Default lead stage is New. Mark Contacted after your personal outreach, Consultation booked after a booked appointment, Considering while discussing, Booking in progress when handling it manually, or Closed to stop automatic guide reminders.
- The hourly job sends at most one reminder for day three and one for day seven. It checks the existing consultation calendar freshly before sending. Missing or failed calendar access pauses delivery; it never means "not booked."
- Any production booking inquiry for the same normalized email suppresses the new guide reminders, so the existing booking-inquiry reminder system owns that person from then on. Closed or manually progressed guide stages, future-departure interest and already-observed consultations also suppress them. No June-trip guide reminders are sent once June 1, 2027 begins (UTC).
- Repeat submissions do not reopen a closed lead, change its original contact details, send another guide email or restart the reminder clock. Changed contact information should be reviewed by the owner rather than overwritten by a public form.
- A provider timeout may follow acceptance. Failed/sending delivery records are kept for review and are not retried automatically. The thank-you screen still provides the PDF and call link.
- Reminder-stop links show a confirmation page; only pressing Stop reminders closes the guide lead. They do not cancel a booking or unsubscribe a separate MailerLite newsletter.

## Additive database migration

`0024_wide_sleeper.sql` creates only three new guide tables and their indexes. Runtime initialization uses the same `IF NOT EXISTS` pattern as the existing reminder tables, so website intake works before or after the migration is applied. It never alters existing booking/agreement/payment tables.

From the project directory run:

`npx wrangler d1 migrations apply cookie-paradise-travel-db --remote`

Apply the reviewed 0024 migration only. If unexpected older migrations appear, stop and inspect before confirming. The tables already initialized by runtime are safely kept. No new npm packages or separate email/Meta paid service is required by this implementation.

## Campaign launch check

Use the real form on a phone, confirm the PDF opens, and book a test consultation using the same email. Check the calendar event includes the booking email and the exact existing consultation title/duration. Keep the test lead closed afterward. Confirm protected `/admin/leads` is covered by your existing Cloudflare Access application; if your policy lists only `/admin/inquiries` instead of `/admin/*`, add the new owner path with the same owner-only policy before using it. Server-side owner verification remains required either way.

Website conversion tracking through Meta Pixel/CAPI, SMS, ad creation, budgets and campaign publishing are separate follow-up work; they are not activated here.
