import { describe, expect, it } from "vitest"
import { GiftLedger } from "../src/gift/ledger"

const now = 1_700_000_000_000

const startEvent = (ledger: GiftLedger, threshold = 500, durationMs = 10_000) => {
  ledger.start({
    giftId: 1,
    threshold,
    startedAt: now,
    endsAt: now + durationMs,
  })
}

describe("GiftLedger escrow", () => {
  it("releases escrow when outbid and deducts winner on resolve", () => {
    const ledger = new GiftLedger(1_000)
    startEvent(ledger, 300)
    const bidA = ledger.bid("walletA", 200, now + 1000)
    expect(bidA.ok).toBe(true)
    expect(bidA.reserved).toBe(200)

    const bidB = ledger.bid("walletB", 350, now + 2000)
    expect(bidB.ok).toBe(true)

    const stateAfter = ledger.currentState()
    expect(stateAfter?.highestBidder).toBe("walletB")
    const resolved = ledger.finalize(now + 20_000)
    expect(resolved?.resolution?.winner).toBe("walletB")
    const resolvedState = ledger.currentState()
    expect(resolvedState?.status).toBe("RESOLVED")
  })

  it("rejects tie bids and keeps earliest winner", () => {
    const ledger = new GiftLedger(1_000)
    startEvent(ledger, 100)
    const first = ledger.bid("walletA", 300, now + 100)
    expect(first.ok).toBe(true)
    const tie = ledger.bid("walletB", 300, now + 200)
    expect(tie.ok).toBe(false)
    expect(ledger.currentState()?.highestBidder).toBe("walletA")
  })

  it("does not deduct when threshold not met", () => {
    const ledger = new GiftLedger(1_000)
    startEvent(ledger, 800)
    const bid = ledger.bid("walletA", 400, now + 100)
    expect(bid.ok).toBe(true)
    const resolved = ledger.finalize(now + 20_000)
    expect(resolved?.resolution?.thresholdMet).toBe(false)
    expect(resolved?.resolution?.winner).toBeNull()
  })
})
