import { describe, expect, it } from "vitest"
import { WeeklyPayoutEngine, weekStart } from "../src/payout/engine"

describe("WeeklyPayoutEngine", () => {
  it("qualifies wallets with 3+ events in a week and is idempotent", () => {
    const engine = new WeeklyPayoutEngine({ minParticipationBid: 50, payoutAmount: 10 })
    const monday = Date.UTC(2024, 0, 1, 12) // Monday noon UTC
    const week = weekStart(monday)
    engine.registerParticipation("w1", "event1", 60, monday)
    engine.registerParticipation("w1", "event2", 70, monday + 1000)
    engine.registerParticipation("w1", "event3", 55, monday + 2000)
    const report = engine.runPayout(week + 8 * 24 * 60 * 60 * 1000)
    expect(report?.qualifiers).toBe(1)
    expect(report?.records[0].wallet).toBe("w1")
    const again = engine.runPayout(week + 8 * 24 * 60 * 60 * 1000)
    expect(again?.records.length).toBe(1)
  })

  it("respects week boundaries", () => {
    const engine = new WeeklyPayoutEngine({ minParticipationBid: 50, payoutAmount: 5 })
    const sunday = Date.UTC(2024, 0, 7, 0, 0, 0) // Sunday
    const nextWeek = sunday + 2 * 24 * 60 * 60 * 1000
    engine.registerParticipation("w2", "eventA", 80, sunday + 1)
    engine.registerParticipation("w2", "eventB", 80, nextWeek + 1)
    const report = engine.runPayout(nextWeek + 7 * 24 * 60 * 60 * 1000)
    expect(report?.records.length ?? 0).toBe(0)
  })
})
