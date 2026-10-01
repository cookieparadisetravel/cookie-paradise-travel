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
npx wrangler secret put SQUARE_ACCESS_TOKEN
npx wrangler secret put SQUARE_WEBHOOK_SIGNATURE_KEY
```

Square's sandbox environment, application ID, location ID and webhook notification URL are non-secret values configured in `wrangler.jsonc`.

## 4. Configure the Square webhook

In the Square Developer Console, open the application used by this site and add a webhook subscription with:

- Notification URL: `https://cookieparadisetravel.com/api/square/webhook`
- Events: `invoice.payment_made` and `invoice.updated`

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
5. Use Square sandbox only until the live Square account and business review are complete.

## 9. Activate and test traveler agreements

Do not activate the agreement until the final version has been approved for use. Follow [TRAVELER-AGREEMENT-ACTIVATION.md](./TRAVELER-AGREEMENT-ACTIVATION.md) to version the approved text, test one adult and one minor acceptance, confirm the invoice lock, and create a Square Sandbox invoice.
