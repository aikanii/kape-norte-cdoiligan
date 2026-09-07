# Kape Norte

Coffee Spotter is a directory for discovering, reviewing, and managing coffee shops in Iligan City and Cagayan de Oro.

## About the application

Kape Norte helps coffee lovers find their next favorite cafe across Northern Mindanao. Visitors can browse shops by city and area, compare details such as price range, opening hours, tags, photos, ratings, and reviews, then open a shop profile for directions and more information.

The application also gives the local coffee community a place to contribute. Signed-in customers can share ratings and comments, while cafe owners can submit their shop, maintain its public details, and manage their listing through the owner area. The result is a practical, community-informed guide for choosing where to meet, work, or enjoy a good cup of coffee.

## Requirements

- Node.js 20 or later
- Bun 1.4 or later
- A Supabase project

## Development

Install dependencies and start the Vite development server:

```bash
bun install
bun run dev
```

Create a `.env` file in the project root with the Supabase and Google Maps values required by your environment. Never commit secrets.

## Commands

```bash
bun run dev       # Start the development server
bun run build     # Create the production Cloudflare build
bun run preview   # Preview the production build locally
bun run lint      # Run ESLint
```

## Deployment

The application is built for Cloudflare Workers with Nitro and Wrangler.

```bash
bun run build
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
