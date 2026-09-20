# Kape Norte

Coffee Spotter is a directory for discovering, reviewing, and managing coffee shops in Iligan City and Cagayan de Oro.

## About the application

Kape Norte helps coffee lovers find their next favorite cafe across Northern Mindanao. Visitors can browse shops by city and area, compare details such as price range, opening hours, tags, photos, ratings, and reviews, then open a shop profile for directions and more information.

The application also gives the local coffee community a place to contribute. Signed-in customers can share ratings and comments, while cafe owners can submit their shop, maintain its public details, and manage their listing through the owner area. The result is a practical, community-informed guide for choosing where to meet, work, or enjoy a good cup of coffee.

## Requirements

- Node.js 22.12 or later
- npm (included with Node.js)
- A Supabase project

## Development

Install dependencies and start the Vite development server:

```bash
npm ci
cp .env.example .env  # then fill in your Supabase project values
npm run dev
```

Create a `.env` file in the project root with the Supabase and Google Maps values required by your environment. Never commit secrets.

## Commands

```bash
npm run dev       # Start the development server
npm run build     # Create the production Cloudflare build
npm run preview   # Preview the production build locally
npm run lint      # Run ESLint
npm run typecheck # Check TypeScript
npm test          # Unit, component, and database-policy tests
npm run test:e2e  # Browser tests (install Playwright Chromium first)
```

## Deployment

The application is built for Cloudflare Workers with Nitro and Wrangler.

```bash
npm run build
npx wrangler deploy
```

Configure the required runtime secrets with Wrangler before deploying. See [DEPLOY-CLOUDFLARE.md](DEPLOY-CLOUDFLARE.md) for the complete Cloudflare and Supabase setup.

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS
- Supabase
- Cloudflare Workers

## Database setup and regression tests

See [FIXES.md](FIXES.md) for the required database migration, auth configuration, automated test commands, and verification limitations. Use `npm ci` and `package-lock.json` for reproducible installs.

## Map tiles

Maps use OpenFreeMap (OpenStreetMap data) rendered with MapLibre GL. No map API key is needed. The map worker is bundled locally; the browser must be able to reach `tiles.openfreemap.org`. Network or WebGL failures show a retry action and an external-map link while the café list remains usable.
