# Deployment checklist

## Required Cloudflare bindings
- `GLOBAL_CLOCK` (GlobalClock Durable Object)
- `TRIVIA_SHARD` (TriviaVoteShard Durable Object)
- `TRIVIA_COORDINATOR` (TriviaCoordinator Durable Object)
- `AUTH` (AuthDurable Durable Object)
- `GIFT_EVENT` (GiftEvent Durable Object)
- `SPONSOR_QUEUE` (SponsorQueueDO Durable Object)
- `ADMIN_PANEL` (AdminPanel Durable Object)
- `WEEKLY_PAYOUT` (WeeklyPayoutDO Durable Object)

## Required secrets
- `CLOUDFLARE_API_TOKEN` (Worker & Pages deployments)

## Environment variables
| Variable | Purpose | Recommended default |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | Base origin for API + clock | same origin (derived) |
| `NEXT_PUBLIC_CLOCK_WS_URL` | Override websocket URL | inherits from API base |
| `NEXT_PUBLIC_CLOCK_HTTP_URL` | Override snapshot URL | inherits from API base + `/clock` |
| `SESSION_SECRET` | Cookie/session encryption | keep custom secret |

Additional backend defaults live in `wrangler.toml` (see clocks, migrations, etc.).

## Deployments
- **Workers**: `npx wrangler@4 deploy` (ensures Durable Objects, env vars & routes).
- **Pages**: `npx @cloudflare/next-on-pages build` then `npx wrangler@4 pages deploy .vercel/output/static --project-name=briefly`.
- The workflow (`.github/workflows/deploy.yml`) runs both steps sequentially after installing dependencies.

## Custom domains
- For `brieflymade.com`: go to the Pages project → Custom domains → set up `brieflymade.com`, `www.brieflymade.com`, and activate. Cloudflare automatically provisions certificates.
- For the API route (`api.brieflymade.com`): create a Cloudflare Worker route (in `wrangler.toml`) that points to `Worker` script; make sure DNS has a CNAME/A record under Cloudflare pointing to Workers (e.g., `api.brieflymade.com` → `workers.dev` via `route` config). Use the same DNS zone where the Pages domain lives to avoid CORS.

