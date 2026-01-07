import { describe, expect, it } from "vitest"
import { BASE_EARN_DURATION_MS, BASE_ROUND_DURATION_MS, BASE_SPEND_DURATION_MS, buildClockConfig } from "../src/clock/config"
import { ClockSchedule } from "../src/clock/schedule"

const makeSchedule = (anchorMs: number, speedMultiplier?: string) => {
  const config = buildClockConfig(
    {
      CLOCK_ANCHOR_MS: anchorMs.toString(),
      CLOCK_SPEED_MULTIPLIER: speedMultiplier,
    },
    anchorMs,
  )
  return new ClockSchedule(config)
}

describe("ClockSchedule", () => {
  const anchor = Date.UTC(2024, 0, 1, 0, 0, 0, 0)

  it("starts in spend and flips to earn on the first boundary", () => {
    const schedule = makeSchedule(anchor)
    const spend = schedule.getState(anchor)
    expect(spend.phase).toBe("SPEND_GIFT")
    expect(spend.phaseEndsAt).toBe(anchor + BASE_SPEND_DURATION_MS)
    expect(spend.giftWindowId).toBe(1)

    const earn = schedule.getState(anchor + BASE_SPEND_DURATION_MS + 1)
    expect(earn.phase).toBe("EARN_TRIVIA")
    expect(earn.phaseStartedAt).toBe(anchor + BASE_SPEND_DURATION_MS)
    expect(earn.round?.id).toBe(1)
    expect(earn.giftWindowId).toBe(1)
  })

  it("keeps rounds aligned inside the earn window and clamps the final boundary to the phase", () => {
    const schedule = makeSchedule(anchor)
    const earnStart = anchor + BASE_SPEND_DURATION_MS
    const roundsPerEarn = Math.floor(BASE_EARN_DURATION_MS / BASE_ROUND_DURATION_MS)
    const lastRoundStart = earnStart + (roundsPerEarn - 1) * BASE_ROUND_DURATION_MS
    const lastRound = schedule.getState(lastRoundStart)

    expect(lastRound.phase).toBe("EARN_TRIVIA")
    expect(lastRound.round?.id).toBe(roundsPerEarn)
    expect(lastRound.round?.endsAt).toBeLessThanOrEqual(lastRound.phaseEndsAt)
    expect(lastRound.nextBoundaryAt).toBeGreaterThan(lastRound.now)

    const tailGap = schedule.getState(lastRound.phaseEndsAt - 2_000)
    expect(tailGap.phase).toBe("EARN_TRIVIA")
    expect(tailGap.nextBoundaryAt).toBe(tailGap.phaseEndsAt)
  })

  it("honors the dev speed multiplier without changing the spec defaults", () => {
    const fast = makeSchedule(anchor, "0.1")
    const state = fast.getState(anchor)

    expect(state.phaseEndsAt - state.phaseStartedAt).toBeCloseTo(BASE_SPEND_DURATION_MS * 0.1, -2)
    expect(state.roundsPerEarn).toBeGreaterThan(1)
    expect(state.speedMultiplier).toBeCloseTo(0.1, 4)
  })
})
