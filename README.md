# Briefly — Global Clock

This repo uses a Cloudflare Durable Object as the single authority for the show clock. The DO exposes `/clock` for snapshots + WebSocket subscriptions and `/health` for quick config checks.

## Running locally
- Install deps: `npm install`
- Start the clock worker: `npm run dev:worker` (runs Wrangler dev with the `GLOBAL_CLOCK` Durable Object plus trivia coordinator + shards)
- Start the Next UI: `npm run dev` and set `NEXT_PUBLIC_CLOCK_WS_URL=ws://127.0.0.1:8787/clock` (Wrangler dev host)

## Config
- `CLOCK_SPEED_MULTIPLIER` (default `1`): dev-only speed-up that scales the Spend/Earn/round durations without touching SHOW_SPEC defaults.
- `CLOCK_ANCHOR_MS` (optional): force the anchor timestamp if you need deterministic replay.
- `VOTE_SHARD_COUNT` (default `4`): number of trivia vote shards.
- `NEXT_PUBLIC_CLOCK_HTTP_URL` (optional): HTTP endpoint for initial snapshot if it differs from WS host.

## Tests
- `npm test` runs schedule math checks + trivia merge/dedup logic.
