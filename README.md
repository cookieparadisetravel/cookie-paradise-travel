# Cookie Paradise Travel Company

The public website and owner inquiry dashboard for `cookieparadisetravel.com`. The application uses Next.js App Router through vinext and deploys from GitHub as a Cloudflare Worker.

## Main services

- Cloudflare Workers for hosting
- Cloudflare D1 with Drizzle ORM for inquiry records
- Cloudflare Access for owner-dashboard authentication
- Cloudflare Turnstile for public-form spam protection
- Square for customer records, orders and invoices
- MailerLite for consented marketing subscribers

## Local development

Requirements:

- Node.js 22
- npm

Install dependencies and start the development server:

```sh
npm ci
npm run dev
```

Useful commands:

```sh
npm run lint
npm run build
npm run db:generate
```

Never commit API tokens, webhook signature keys or other secrets. Use local ignored environment files for development and Wrangler secrets for the deployed Worker.

## Cloudflare deployment

GitHub pushes to `main` trigger the Cloudflare build and deployment. The production D1 binding, custom domains and non-secret Square settings are declared in `wrangler.jsonc`.

See [CLOUDFLARE-SETUP.md](./CLOUDFLARE-SETUP.md) for database migrations, secrets, Cloudflare Access, Square webhook and build configuration.

## Email readability

All travel lead and traveler email text must be black (`#000000`) on a light background, including headings, links, disclosures, verification codes, and footers. Use underlines to identify text links. Brand gold (`#f7b658`) with black labels is the default for buttons; do not use white or pale text on gold. Prefer 16px body text, generous line spacing, and a mobile-friendly reading width. User experience and readability take precedence over branding.

Website email fragments use inline styles and the shared light-background document in `lib/mailersend-transactional.ts`. Keep the same color policy in MailerLite welcome emails and future campaign designs. Mail clients may apply their own accessibility or dark-mode settings.
