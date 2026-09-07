# Deploying Kape Norte to your own Cloudflare account

This app (TanStack Start) already builds to a Cloudflare Workers-compatible
bundle. Follow these steps once, then each future deploy is two commands.

## 0. One-time prerequisites

- A free Cloudflare account: https://dash.cloudflare.com
- Node.js 20+ installed locally
- This project on your machine:
  - In Lovable: **GitHub → Connect** to push the project to a GitHub repo, then
    `git clone` it, **or** download the code and unzip it.
- A copy of your `.env` file (Lovable → your local project root). It contains
  the `VITE_SUPABASE_*` and Google Maps browser keys the frontend needs at
  build time.

## 1. Log in to Cloudflare

```bash
npx wrangler login
```

This opens a browser window to authorize the Wrangler CLI.

## 2. Install and build

```bash
npm install
npm run build
```

The build produces `.output/` (`server/` = the Worker, `public/` = static
assets). `wrangler.toml` in this repo is already pointed at those folders.

## 3. Set runtime secrets

Server-side code (reviews, admin stats, photo signing) reads these at runtime:

```bash
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_PUBLISHABLE_KEY
```

Optional, only if you use them:

```bash
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY   # admin aggregations + places sync
npx wrangler secret put PLACES_SYNC_TOKEN           # protects /api/public/sync-places
```

Paste each value when prompted (values are the same ones from your Lovable
project environment; the publishable key and URL also appear in `.env`).

## 4. Deploy

```bash
npx wrangler deploy
```

Wrangler prints your live URL, e.g. `https://kape-norte.<your-subdomain>.workers.dev`.

## 5. Attach kapenorte.dpdns.org

1. In the Cloudflare dashboard, make sure the `dpdns.org` zone is added and
   active on your account (free DNS provider zones like dpdns sometimes cannot
   be added to Cloudflare — if so, use a domain you fully own, or keep the
   `workers.dev` URL).
2. Go to **Workers & Pages → kape-norte → Settings → Domains & Routes →
   Add → Custom Domain**, enter `kapenorte.dpdns.org`.
3. Cloudflare issues the certificate automatically; the site is live on your
   domain within a few minutes.

## Updating the site later

After making changes (in Lovable, then pull from GitHub — or edit locally):

```bash
git pull        # if you edit in Lovable and sync via GitHub
npm run build
npx wrangler deploy
```

## Notes

- The database, auth, reviews, and photo storage stay on Lovable Cloud — the
  Worker talks to them over HTTPS, so nothing needs to migrate.
- The Lovable-hosted URL keeps working independently; you can switch back to it
  any time by publishing from Lovable.
