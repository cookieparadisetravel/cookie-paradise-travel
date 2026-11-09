# Web prospects

The owner-only `/admin/prospects` dashboard collects public source posts for
review and tracks personal outreach. It is linked from the Inquiries header.
Records live in separate D1 tables and never enter booking, MailerLite, MailerSend,
or customer follow-up workflows automatically.

## Tavily discovery (independent option)

Open `/admin/prospects/tavily` or choose **Tavily discovery** in Web prospects.
It has its own settings, run history, lease, and limits; it never falls back to
Brave. Both tools share the source-post review list and URL deduplication so
owner notes and suppression apply across tools. New Tavily records carry the
`tavily` origin; existing Brave and manual origins are preserved on duplicates.

1. Create a free Researcher account/key at https://app.tavily.com.
2. Add `TAVILY_API_KEY` as a secret to the existing Cloudflare Worker and deploy.
3. Refresh the Tavily page, choose **Search now**, and review the actual run and
   original sources. Presence of a key is not a successful connection test.
4. Enable **Search daily** only after a successful trial. It defaults to off.

Basic search is explicitly selected with auto-parameters disabled: one credit
per query, four default queries, approximately 120 credits per 30 daily runs.
Tavily documents 1,000 monthly free credits, without a credit card:
https://docs.tavily.com/documentation/api-credits.
The manual/automatic limit is three runs per UTC day per tool, with up to six
queries per run. There is no automatic account upgrade or paid-plan activation.

Tavily explicitly allows retaining URLs, titles and snippets in internal systems:
https://help.tavily.com/articles/1612400809-storing-caching-retaining-output
Publisher rights and source-site terms still apply. We request excerpts only,
not full pages, AI-generated answers, or images. Original posts must be reviewed;
this is discovery of public discussions, not verified or consented sales leads.

Tavily uses a past-month date filter and returns available publication dates.
Undated results can still appear, and publication metadata may be inaccurate.
Searches use English and focus on 2027 travel questions and private/group trips.
No private Facebook groups, email enrichment, or outbound messages are included.

`0031_tavily_discovery.sql` and runtime bootstrap add only the two Tavily config
and run tables; the shared prospect schema is unchanged. Bootstrap and migration
are idempotent in either order. The existing hourly cron checks each tool's
independent once-per-24-hours eligibility. No ChatGPT automation is needed.

## Connect Brave discovery

1. Create a Brave Search API key on a plan that includes **storage rights**.
   Provider documentation: https://brave.com/search/api/ and
   https://api-dashboard.search.brave.com/api-reference/web/search/get.
2. Add `BRAVE_SEARCH_API_KEY` as a secret in the existing
   `cookie-paradise-travel` Cloudflare Worker. Do not put the key in Git, the
   dashboard's notes, or a client environment variable.
3. Open Web prospects, refresh, and choose **Search now**. Inspect the run result
   and original posts. A configured key is not proof of successful API access.
4. Save **Search daily** in Discovery settings to enable the scheduled scan.

The existing hourly cron calls the discovery service. With daily discovery on,
it attempts a scan when at least 24 hours have passed since the previous attempt.
Manual searches work while daily discovery is paused. All searches share a
one-hour manual cooldown, a database lease, and a maximum of three attempts per
UTC day. There are four default queries and at most six configurable queries,
with up to 20 results per query. No extra cron or subscription is created.
No API calls are made when the key is absent; daily discovery defaults to off.

The target year defaults to 2027 and remains explicit rather than silently
changing on January 1. `{year}` in a search expands to the configured year.
Search uses English, global coverage, and Brave's past-month freshness filter.
That filter can reflect a page update, not the original post's publication.
Private groups and unindexed content cannot be discovered through this API.

## Review and outreach

The matcher requires Vietnam, travel wording, a question/planning signal, and
the target year or “next year” in the result title/excerpt. This heuristic can
miss suitable posts and include unsuitable ones. All matches start as **Needs
review**. Service tags are suggestions, not verified qualification. Relative
years, post dates, author identity, travel dates, and contact permission must be
checked on the original post. The system does not infer or enrich email addresses.

Save an author's public name/handle, actual travel timing, party size, supplied
contact channel, notes, next action, and follow-up date after reviewing the post.
Follow-up dates are displayed in the prospect list; they do not send reminders.
Manual additions require a source URL and title. There is no automatic outbound
messaging or automatic conversion to a consented customer record.

Source URLs are normalized for tracking parameters and Reddit thread aliases.
Deduplication is per source post, not per person across multiple websites.
Repeated results only update `last_seen_at`: they cannot overwrite notes,
change outreach status, or reactivate archived / not-a-fit / do-not-contact posts.
Edits use a version check so an older browser tab cannot overwrite newer edits.
All API reads require the verified owner; writes additionally require the same
origin and bounded, validated request bodies. API keys are never returned.

## Storage and verification

`lib/web-prospect-storage.ts` safely creates only the three prospect tables and
indexes on first use. Migration `0028_sparkling_gamma_corps.sql` is additive and
idempotent before or after the runtime bootstrap. No existing customer records
are migrated or updated. Database failure prevents a successful write response.

Run `npm test`, `npx tsc --noEmit --incremental false`, and `npm run build` for
validation. The prospect tests use in-memory SQLite and a mocked provider to
exercise matching, authorization, SQL, pagination, concurrency, suppression,
cooldowns, validation, and failure reporting without contacting real prospects.
After adding the real secret, verify a live scan in Recent discovery runs.
