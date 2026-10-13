# Salon referral pilot — review only

This implementation follows the current GitHub main `f22091eb3786c7adf645987ccebd31ebeade0b84`. The live site's header, hero, navigation, section headings and stylesheet were retrieved from https://www.cookieparadisetravel.com/ on October 13, 2026 and matched against that layout. The older Sites deployment is not used as the design source.

## Review paths (available after a preview deployment of this branch)

- `/admin/referrals/gossip-nails`
- `/admin/referrals/nail-station-spa`

Both use the same Cloudflare Access owner verification as the inquiry dashboard. They are noindex and submission-blocked, with no Turnstile requests, customer writes, notifications, agreements or charges. Unauthenticated visitors receive 404. These paths have not been deployed to production.

## Proposed public referral paths (disabled by default)

- `/referrals/gossip-nails`
- `/referrals/nail-station-spa`

Each uses the full existing trip page and booking dialog. The selected salon's official logo is placed immediately beside the Cookie Paradise logo in the existing header. Gossip Nails' logo is the image in `#id_logo` in its website's upper-left header. Logo source URLs are in `lib/referral-partners.ts` and below.

## Attribution

The exact allowlisted partner code travels in every inquiry CTA, including the mobile booking bar. The server validates it before Turnstile or any side effects and stores it in nullable `booking_requests.referral_partner`. Direct inquiries remain null. The inquiry dashboard and owner notification expose this value. Existing traveler, agreement and Square flows retain the inquiry ID, so the original source remains on the same record through booking. No cookie, browser storage, visitor fingerprint, extra personal field, or salon access to traveler data is added. Attribution is self-reported via the link, not proof of commission eligibility. Leaving the referral experience for the generic homepage does not retain attribution.

## Before deployment or activation

1. Review the branch and confirm each salon's participation and permission to use its logo. No commission, discount or endorsement terms are supplied by this implementation.
2. Apply additive migration `drizzle/0019_great_post.sql` to the target D1 database **before** deploying the new schema. It adds a nullable column and preserves existing records. No live migration has been run.
3. Deploy for owner review while `REFERRAL_ACTIVE_PARTNERS` remains unset/empty. Ensure Cloudflare Access covers `/admin/referrals/*` with the same application audience as `/admin/inquiries`; the route also verifies the owner JWT itself.
4. Only after confirmation, set the Worker runtime variable `REFERRAL_ACTIVE_PARTNERS` to the confirmed codes (comma-separated). Each salon can be enabled independently. Public paths and referral submission reject inactive codes. Clearing the variable closes those paths while retaining existing attribution records. Do not activate the pilot merely to preview it.
5. Test future payment continuation only in Square Sandbox; never submit test ready-to-book inquiries against Production. The automated tests mock all services.

## Validation

- Unit tests cover exact partner codes, invalid inputs, independent activation and preview rejection.
- API integration tests execute the real booking endpoint with mocked infrastructure, checking both salons, direct traffic, normal ready-to-book continuation, notification attribution and rejection before side effects.
- Page integration tests execute both real routes with mocked authentication, render the shared trip component, check logo isolation and all desktop/mobile referral CTA props, and verify owner and activation gates.
- Production build and TypeScript checks are run. Interactive browser QA is unavailable in this environment; rendered component tests do not verify browser layout or dialog interactions.

## Official logo sources

- Gossip Nails: https://gossipnailscolumbus.com/wp-content/uploads/2025/06/z6696149567979_58fb34533b3003c392fef781ca4ec4a0-1.png
- Nail Station & Spa: https://nailsstationandspa.com/wp-content/uploads/2024/02/NAILS-STATION-SPA-logo-header-1.png
