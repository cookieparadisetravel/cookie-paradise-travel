# Facebook leads in the website dashboard

The existing `/api/meta/leads` webhook now calls `saveMetaDashboardLead`. It saves the approved Facebook form's submissions in `/admin/inquiries` without sending a guide email, owner email/webhook, reminder, or MailerLite subscription. It does not create a reservation, agreement, traveler or invoice. The ad and form still open the PDF immediately after submission.

## Permission and duplicate handling

- Both **Yes** and **No** answers to the form's email-permission question are imported. The dashboard shows the answer; No is not treated as permission to email. Missing or unexpected answers fail for review rather than being guessed.
- Full names, email, city, travel interest, form ID and ad ID are retained. Repeat deliveries of one Meta lead ID are idempotent. A matching normalized email shares the existing inquiry; a genuinely newer request can reopen a closed one with its history retained.
- `trip_guide_submission_preferences` stores the contact answer and manual/automatic mode per immutable submission. It is created idempotently at runtime, with matching additive migration `0027_facebook_dashboard_permissions.sql`. For a newly imported No, the legacy NOT NULL `contact_consented_at` field is empty (no consent timestamp); the explicit per-submission answer is authoritative. Existing timestamps and permission records are never rewritten by a replay.
- The reminder job checks the active request's mode and the latest recorded permission again before sending. A manual Facebook request cannot start a reminder cycle. A later No also suppresses an earlier website guide reminder; older delayed responses cannot override a newer answer. Older Facebook requests with no mode record default to manual for reminders.
- The separate website form retains its existing email workflow. A previously active website request can retain its own reminder cycle when a matching Facebook submission says Yes; the Facebook submission itself sends nothing. No newsletter consent is inferred from a Facebook guide request.

## Connection and production test

The app/Page subscription and Page lead-retrieval access still need to work end to end. Existing required settings remain `META_APP_SECRET`, `META_PAGE_ACCESS_TOKEN`, `META_WEBHOOK_VERIFY_TOKEN`, `META_PAGE_ID`, `META_FORM_IDS`, `META_GRAPH_API_VERSION`, `META_CONTACT_CONSENT_FIELD`, and optionally `META_TRAVEL_TIMING_FIELD`. Keep credentials in Cloudflare Secrets, never in this repository or chat.

Use the existing **Cookie Paradise Travel Leads** app, Page, and published trip-guide form; do not create another integration or paid service. Verify the callback is `https://cookieparadisetravel.com/api/meta/leads`, that the actual Page subscribes to `leadgen`, and that the form allowlist and custom field names match the signed lead payload. A verification response or an app marked Live does not prove real leads are retrievable.

After deployment approval:

1. Use Meta's Lead Ads Testing Tool to deliver one synthetic test lead for the existing form. Do not launch an ad or spend money to run the test.
2. Confirm one Facebook request appears in `/admin/inquiries` with the expected name, city, interest, ad ID, permission answer and manual follow-up mode.
3. Replay it and confirm there is still one submission. Test No separately: it must appear with No permission and no email delivery.
4. Confirm guide delivery, automatic reminders, MailerLite and owner alerts were not triggered. Close the synthetic test inquiry after review.

Only a successful signed test-to-dashboard round trip establishes that the connection is working. Keep the campaign paused until separately approved.

## Validation

The tests exercise signed Yes/No intake, rejected signatures/unapproved forms, duplicate delivery, immutable permission, reopening, reminder suppression, unchanged website workflows, and additive migration/runtime storage. No live customer submissions or emails are needed for these tests.

## Missed-delivery recovery

The existing hourly Worker job also reads the leads edge for each approved `META_FORM_IDS` form. The owner dashboard's **Facebook lead connection** panel offers **Sync Facebook leads** for immediate recovery and reports the last check, newly added contacts, existing contacts, and sanitized connection errors. This is separate from webhook verification: a working verification URL does not prove lead retrieval works.

Recovery uses the same `saveMetaDashboardLead` path as signed delivery. Replaying records neither duplicates submissions nor sends guide emails, owner notifications, reminders, or MailerLite subscriptions. Both Yes and No remain visible; a malformed answer fails that record without blocking later valid records. Guide emails previously sent manually through Gmail are not inferred to have been sent by MailerSend.

`meta_lead_sync` is created additively at runtime (matching migration `0030_meta_lead_sync.sql`). A 15-minute lease prevents overlapping manual and scheduled syncs. Results and health contain aggregate counts and fixed messages only, never raw provider errors, access tokens, or customer answers. Manual sync requires verified owner access and a same-origin POST. Reading status does not fetch leads.

Recovery reads at most ten pages of 100 records per approved form per run. An incomplete page sequence is reported, not silently marked successful. Pagination is rebuilt against the fixed Graph API origin with cursor parameters and a Bearer header; token-bearing `paging.next` URLs are never followed. For forms beyond this bound, perform a separate bounded export/backfill before declaring recovery complete.

If the panel reports an expired token, refresh `META_PAGE_ACCESS_TOKEN`. For denied access, verify the existing app's `leads_retrieval` permission, Page Leads Access assignment, live mode, and the configured form IDs. A successful catch-up recovers missed records even if real-time push remains unavailable; a signed new submission test is still needed to verify real-time delivery.
