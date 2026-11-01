# Guide form and MailerLite Interest List

Guide requests are stored in Cloudflare D1 in `trip_guide_leads`, with one
submission record per request in `trip_guide_submissions`. The protected owner
inbox is https://cookieparadisetravel.com/admin/leads. It shows the full name,
contact details, trip interest, source, email delivery, reminder history and
MailerLite sync status. The existing `first_name` column holds the complete
name entered on the new form; no database migration is required.

The homepage collects Full Name and Email, with optional Phone and a travel
interest default of Still deciding. City is shown only on the Facebook campaign
landing page, `/vietnam`. Missing city is recorded as Not provided; ad targeting
labels are never treated as customer residence.

Submitting the guide form records the request to receive the guide and up to
two trip-specific consultation reminders, as disclosed below the submit button.
The future-trip news checkbox remains unchecked and separate. Only people who
select it are sent to MailerLite; guide delivery does not depend on selecting it.

## Connect MailerLite

1. Sign into MailerLite. Open **Subscribers → Groups**.
2. Find the group named exactly **Interest List**. If it does not exist, click
   **Create group**, enter **Interest List**, and save. Keep a single group with
   that exact name; similarly named groups are intentionally ignored.
3. Open **Integrations → MailerLite API → Use**. If the website already has a
   working MailerLite API token, keep it. Otherwise generate a token for this
   website and copy it privately; never paste it into chat or source code.
4. In Cloudflare open **Workers & Pages → cookie-paradise-travel → Settings →
   Variables and Secrets**. Add or update **MAILERLITE_API_TOKEN** as a **Secret**,
   then deploy the setting. Leave the existing `MAILERLITE_GROUP_ID` unchanged:
   it is still used by the older booking form. Guide requests look up Interest
   List by its exact name and do not need another group-ID setting.
5. Submit a new guide request using an email you control and select **Send me
   occasional future trip news.** In the owner guide inbox check **MailerLite ·
   Interest List: Synced**, then confirm the contact is in that MailerLite group.
   A MailerLite double-opt-in setting may require the subscriber to confirm
   before receiving campaigns. This implementation does not disable it or
   force existing unsubscribed contacts to subscribe again.
6. A guide request without the future-news checkbox must still save and deliver
   the guide, with MailerLite shown as **Not requested**. Mark test leads Closed
   after checking them so they do not receive consultation reminders.

Missing token or missing/ambiguous exact group is **Setup needed**. An API
failure is **Sync failed**; the lead remains saved and the guide email can still
be delivered. Existing leads are not bulk imported by this change, and a repeat
request does not restart the guide or reminder emails.

Official API references:
- https://developers.mailerlite.com/api/groups
- https://developers.mailerlite.com/api/subscribers
