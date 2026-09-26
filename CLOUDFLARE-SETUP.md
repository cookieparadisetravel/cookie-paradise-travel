# Publish Cookie Paradise Travel on Cloudflare

This package deploys a separate Cloudflare test version. It does not change the current website or its domain.

## Before you begin

1. Install the current **Node.js LTS** from <https://nodejs.org/en/download> if it is not already installed.
2. Extract this entire folder from the ZIP file.
3. Open the extracted folder in File Explorer.

## Run the setup

1. Double-click `START-CLOUDFLARE-SETUP.cmd`.
2. If Windows asks for permission, allow the setup to run.
3. Your browser will open. Sign in to the correct Cloudflare account and approve Wrangler.
4. When the terminal asks for `ADMIN_OWNER_EMAIL`, type the dependable email address that should be allowed into the private owner dashboard, then press Enter.
5. Wait until the terminal displays a `workers.dev` address.

Do not enter a Square access token during this setup. Square will be added only after the Cloudflare test site and inquiry flow are verified.

## What the setup creates

- A separate Cloudflare Worker test site
- A D1 database for trip inquiries
- The existing inquiry form and owner dashboard code
- Square sandbox settings, with payment collection disabled until its access token is added later

Keep the terminal window open and copy the final `workers.dev` address for review.
