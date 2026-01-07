# Briefly — North Star

Briefly must feel **alive**.

If we succeed, it becomes TikTok bait because it behaves like a global, synchronized, psychedelic game show:
- One big thing on screen at a time
- Fat typography, bright psychedelic colours
- Fun, punchy animations that land like “beats”
- Everyone sees the same moments at the same time (global clock)
- The product alternates between **Earn** (trivia) and **Spend** (gift auction), like a TV show

## Non-negotiables (product)
1) **Global synchronization**  
   No client device is the authority for timing. The server clock drives state + countdowns.

2) **One thing at a time**  
   The UI is full-screen and oversized. Minimal chrome. No clutter.

3) **Earn → Spend rotation**  
   The experience continuously rotates between:
   - Earn: global trivia rounds, 6-second vote window, reveal distribution, reveal correct, decide whether points award
   - Spend: 10-minute gift takeover, animated ring + countdown + threshold + live highest bid

4) **Escrow bidding (friendly giving)**  
   Bids reserve points. If outbid, points return immediately. Only the winner is deducted at the end (if threshold met).

5) **Crowd drama**  
   Points are only awarded if the crowd is “mostly right”, with difficulty-based thresholds.

6) **Sponsor tile is global**  
   Sponsorship runs independently of gifts, in 10-minute slots, shared worldwide. It must be brand-safe and measurable.

## Non-negotiables (engineering)
- Correctness > speed for state machines, concurrency, and ledgers.
- Small PRs / small commits. One milestone at a time.
- Durable Object logic must have tests.
- Everything important is documented in SHOW_SPEC.md.

If any choice conflicts with this document, choose the North Star.
