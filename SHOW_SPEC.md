# Briefly — Show Spec (Source of Truth)

All timing is driven by a global server clock (Durable Object).
Clients render from server state; clients do not decide phase transitions.

## Core loop (default preset)
- Spend (Gift): 10:00
- Earn (Trivia): 10:00
- Repeat forever

All boundaries align to UTC-based “show boundaries” (configurable) so the whole world flips together.

---

# Earn Phase — Trivia

## Round length (default)
Each trivia round = 14.0 seconds.

### Round timeline (14.0s)
1) 0.0–0.8s  — Question reveal + answers animate in
2) 0.8–6.8s  — Voting open (6.0s) **(non-negotiable)**
3) 6.8–7.5s  — Lock + pulse transition
4) 7.5–9.5s  — Distribution reveal (A/B/C/D bars)
5) 9.5–11.1s — Correct answer reveal
6) 11.1–12.5s — Outcome moment (award or “NO POINTS”)
7) 12.5–14.0s — Breath/wipe to next round

## Crowd correctness gating (“mostly right”)
Points are awarded to users who selected the correct answer ONLY if:
- Easy: correct_share >= 60%
- Medium: correct_share >= 50%
- Hard: correct_share >= 40%

If the threshold is not met: nobody receives points.

## Points (defaults; admin-configurable)
- Easy: +8
- Medium: +13
- Hard: +21

## Difficulty mixer (high-level)
A controller aims to keep crowd accuracy in a fun band (default target: 45–65% correct).
Rules:
- Track rolling crowd accuracy over recent rounds.
- If crowd is too accurate, increase hard frequency.
- If crowd is failing too often, increase easy/medium frequency.
- Enforce diversity: categories rotate; avoid repeats; cap consecutive Hard (default max 2).

---

# Spend Phase — Gift Auction (10 minutes)

A gift takeover happens every 10 minutes and occupies the full screen.

## Gift window timeline (10:00)
- 00:00–00:08  Gift drop animation (slam-in, ring spins up)
- 00:08–00:15  Show threshold/current/highest bid; sponsor tile fades in
- 00:15–09:20  Main bidding
- 09:20–10:00  Final Frenzy (pulse ring, “LAST 40s”)

## Resolution + transition (post 10:00)
- 10:00–10:06  Lock bids + resolve winner
- 10:06–10:14  Winner crown / or “threshold not met”
- 10:14–10:20  Warp transition back to Earn

## Gift mechanics
- Each gift event has a threshold (reserve) set by admin.
- Winner = highest bid at end, provided highest_bid >= threshold.
- Tie-break: earliest timestamp wins.
- If threshold not met: no winner, no deduction.

## Escrow auction (non-negotiable)
- Placing a bid reserves that many points (escrow).
- If outbid: escrow is released immediately.
- Only at end: if threshold met, deduct winner points and award gift on profile.

---

# Sponsorship (global, independent of gifts)

## Inventory unit
- 10-minute slots
- Global: same sponsor tile for everyone worldwide
- Slots snap to show boundaries (recommended): clean ETAs + clean analytics

## Products (defaults)
- $5 for 1 slot (10m)
- $15 for 3 slots (30m consecutive)
- $20 for 5 slots (50m consecutive)

## Queue rules (defaults; admin-configurable)
- Queue cap: 12 hours (72 slots). If full, do not accept purchases.
- Per sponsor throttle: max 50 minutes per rolling 6 hours.

## Moderation & edits
- Any edit to name/image/link creates a new creative version and requires re-approval.
- Freeze edits within 10 minutes of go-live (default).

## Stats (for sponsors)
- Impressions
- Clicks
- CTR
Clicks must use a redirect endpoint for accurate measurement.

---

# UI Anchors (global)
- Bottom right: user points + profile avatar
- Bottom left: gifts bought today (tap reveals tray: most recent gifts, large bold type)
- Profile overlay: oversized, shows username, points, avatar, Glimmer claimable, won gifts

---

# Identity
- Wallet = identity (Phantom / Solana auth).
- Username assigned as word-word from randomiser; can be changed later only if we add a paid rename feature (not in MVP).

---

# Admin essentials
- Create/edit gifts and thresholds
- Sponsor moderation queue (approve/reject)
- Sponsor schedule view + queue cap management
- Ban/flag wallets for abuse
- View metrics: gifts/day, gifts/week, sponsor revenue, DAU/MAU, weekly Glimmer payouts
