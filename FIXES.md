# Functional fixes and deployment checklist

## Fixed

- Preserved protected-page destinations through login; prevented external redirect URLs.
- Restored loading/error states after failed authentication and review/photo writes.
- Added owner-only edit queries and checked affected rows instead of reporting unauthorized no-op saves as successful.
- Added an admin pending-listings queue on `/claims` and atomic claim decisions.
- Restricted owner database updates so owners cannot self-publish or transfer listings.
- Created the photo bucket on fresh databases and tightened photo-path ownership checks.
- Validated image types/sizes; cleaned orphaned uploads; prevented duplicate shop submissions after partial photo failures.
- Corrected overnight and 24-hour opening hours, editable extended closing times, missing-day editing, empty coordinates, and imported price level 4.
- Unified legacy CDO city names so directory and guide filters include imported and owner-submitted listings.
- Added SSR query-cache hydration, trimmed search input, minute-by-minute opening status updates, mobile navigation, recoverable directory errors, and preview host support.
- Preserved owner-maintained listing details and existing slugs during Google Places refreshes.
- Fixed lint errors and added automated unit, component, PostgreSQL policy, and browser tests.

## Required before deploying

1. **Supabase connectivity:** An independent request confirmed that the configured project is available and returns live café records. TLS connections from the development sandbox itself remain restricted. Public directory, guide, and shop reads now run directly in the browser after an SSR connection failure; working deployments still use SSR. No demo data or empty-success fallback is substituted. Production authentication and writes have not been exercised. Keep the runtime and browser public credentials pointed at the same project.
2. **Apply `supabase/migrations/20260920030000_functional_fixes.sql`** to the existing project using the Supabase SQL editor or your authenticated migration workflow. Apply the whole migration atomically. Do not rerun old migrations manually: an existing historical migration deletes seed listings and reviews.
3. Ensure the intended administrator has an `admin` entry in `public.user_roles` (set this only from a trusted database/admin session). The admin UI is under **Review listings**. Analytics and claims now use verified-user RLS/RPC access, not a service-role key.
4. In Supabase Auth URL Configuration, allow your deployed origin and callback paths (including `/owner`, `/submit`, and shop pages). Enable and configure the Google provider if offering Google login. Email sign-in/signup remain available independently.
5. Build and deploy with matching public credentials. Never put service-role, Google connection, or sync-token secrets in `VITE_*` variables. Set Google import secrets only if using that optional endpoint.

## Validation

```sh
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
```

- Unit/component tests cover hours, redirects, form validation, reviews and photo failures.
- PGlite tests run all repository migrations against an isolated PostgreSQL database with minimal Supabase auth/storage schemas, then verify real grants, RLS and admin RPC behavior.
- Browser tests start isolated fixture services on ports 3100/4100. They exercise directory search/filtering, map hydration, shop details/404s, CDO guide, login failure/recovery, submission, owner dashboard and mobile navigation. They do not contact or write to production Supabase.
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` can point to an existing Chromium installation.

Remaining tooling warnings are six pre-existing Fast Refresh warnings in shared UI component exports and Nitro's generated Cloudflare-config override notices.

## Directory connection follow-up

The directory previously depended on server-function RPCs even in the browser. A preview-server network restriction therefore blocked every retry. Public reads now select a request-scoped anonymous client for SSR and the normal Supabase browser client for client navigation. Failed SSR preloads are discarded (not hydrated as permanent errors), allowing a loading state followed by a direct browser request. Requests are bounded to eight seconds and SDK-level retries are disabled for these reads to avoid compounded delays. All published-listing filters and Supabase RLS remain in force.

Regression tests cover SSR-only network failures on the directory, guide and individual shop pages, as well as a complete outage followed by successful manual retry.


## Map access-block fix

The public map no longer requests raster tiles from `tile.openstreetmap.org`. It uses [OpenFreeMap's documented public vector-map service](https://openfreemap.org/quick_start/) with MapLibre GL and the Positron style. OpenFreeMap supports embedded maps without an account/API key and permits commercial use. Required OpenFreeMap, OpenMapTiles, and OpenStreetMap credit remains visible.

- Directory and individual café maps share the new renderer; city recentering, open/closed pin colors, hover/focus details, active pins and zoom controls are preserved.
- The MapLibre worker is bundled with the application and served from the same origin. No executable CDN scripts or service secrets are required.
- Resource failures, loading timeouts, and unsupported WebGL show **Retry map** and **Open in Google Maps** instead of breaking the directory.
- Regression browser tests exercise the real canvas/worker against a deterministic map-style fixture, plus blocked-provider and unsupported-WebGL cases. The sandbox cannot independently load external map tiles over TLS; live provider rendering must be checked from the user's browser.
- Updated MapLibre to a patched 6.x version; `npm audit` reports no vulnerabilities. Leaflet dependencies are removed because the new renderer replaces them.
