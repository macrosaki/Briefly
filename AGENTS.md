# Briefly — Agent Instructions (Codex / Cursor / AI)

This repo builds Briefly. All agents must obey NORTH_STAR.md and SHOW_SPEC.md.

## What matters most
1) The app must feel alive (global sync, big beats, minimal UI).
2) Correctness for state machines and ledgers (votes, escrow bids, payouts).
3) Small, reviewable changes.

## Guardrails (do not break)
- Client is never the authority for timing, phase transitions, or outcomes.
- Escrow auction: only winner is deducted at end if threshold met.
- Difficulty thresholds: Easy 60%, Medium 50%, Hard 40% (admin-configurable).
- Sponsor queue rules:
  - Global sponsor tile
  - 10-minute slots
  - Queue cap 12 hours
  - Max 50 minutes per rolling 6 hours per sponsor

## Preferred architecture (Cloudflare-first)
- Next.js frontend deployed to Cloudflare runtime
- Durable Objects for:
  - Global show clock
  - Trivia sharded vote counting + merge
  - Gift events (per 10-minute window)
  - Sponsor queue
- D1 for persistent relational data (users, ledger entries, gifts, sponsors, bans)
- R2 for images (avatars, sponsor creatives)
- Analytics event stream for DAU/MAU + impressions/clicks (rollups optional)

If the repo differs, adapt but preserve the invariants.

## Development standards
- TypeScript strict mode (do not weaken typings to “make it compile”).
- Add tests for Durable Object logic and any ledger operations.
- Validate all external input (auth, bids, votes, sponsor links).
- Keep API endpoints small and explicit; avoid “god handlers”.

## Security / abuse
- Wallet auth must prevent replay (nonce).
- Votes: prevent double-vote per round.
- Bids: prevent negative balance, prevent race conditions, enforce escrow invariants.
- Sponsor links: enforce https, block weird schemes, sanitize redirects.
- Add rate limiting / bot protection hooks (even if not enabled by default in dev).

## PR / commit discipline
- One milestone per branch/PR.
- Update SHOW_SPEC.md only if product decisions change.
- Update docs if assumptions change.

## Definition of done (for any task)
- Builds locally
- Tests pass
- No TODOs left in the critical path
- Docs updated if needed
