import { ClockConfig } from "./config"

export type ClockPhase = "SPEND_GIFT" | "EARN_TRIVIA"

export interface TriviaRoundState {
  id: number
  startedAt: number
  endsAt: number
  durationMs: number
}

export interface ClockState {
  now: number
  phase: ClockPhase
  phaseStartedAt: number
  phaseEndsAt: number
  giftWindowId: number
  round: TriviaRoundState | null
  roundsPerEarn: number
  nextBoundaryAt: number
  speedMultiplier: number
}

export const computeRoundsPerEarn = (earnDurationMs: number, triviaRoundMs: number): number =>
  Math.max(1, Math.floor(earnDurationMs / triviaRoundMs))

export class ClockSchedule {
  private readonly earnDurationMs: number
  private readonly spendDurationMs: number
  private readonly roundDurationMs: number
  private readonly cycleDurationMs: number
  private readonly roundsPerEarn: number
  private readonly speedMultiplier: number

  constructor(private readonly config: ClockConfig) {
    this.earnDurationMs = config.earnDurationMs
    this.spendDurationMs = config.spendDurationMs
    this.roundDurationMs = config.triviaRoundMs
    this.cycleDurationMs = this.earnDurationMs + this.spendDurationMs
    this.roundsPerEarn = computeRoundsPerEarn(this.earnDurationMs, this.roundDurationMs)
    this.speedMultiplier = config.speedMultiplier
  }

  getState(now: number): ClockState {
    const elapsedSinceAnchor = now - this.config.anchorMs
    const cycleIndex = Math.floor(elapsedSinceAnchor / this.cycleDurationMs)
    const offsetWithinCycle = elapsedSinceAnchor % this.cycleDurationMs

    if (offsetWithinCycle < this.spendDurationMs) {
      const phaseStartedAt = now - offsetWithinCycle
      const phaseEndsAt = phaseStartedAt + this.spendDurationMs
      return {
        now,
        phase: "SPEND_GIFT",
        phaseStartedAt,
        phaseEndsAt,
        giftWindowId: cycleIndex + 1,
        round: null,
        roundsPerEarn: this.roundsPerEarn,
        nextBoundaryAt: phaseEndsAt,
        speedMultiplier: this.speedMultiplier,
      }
    }

    const earnElapsed = offsetWithinCycle - this.spendDurationMs
    const phaseStartedAt = now - earnElapsed
    const phaseEndsAt = phaseStartedAt + this.earnDurationMs
    const roundIndex = Math.min(this.roundsPerEarn - 1, Math.floor(earnElapsed / this.roundDurationMs))

    const roundStartedAt = phaseStartedAt + roundIndex * this.roundDurationMs
    const roundEndsAt = Math.min(roundStartedAt + this.roundDurationMs, phaseEndsAt)
    const globalRoundId = cycleIndex * this.roundsPerEarn + roundIndex + 1
    const candidateBoundaries = [phaseEndsAt, roundEndsAt].filter((time) => time > now)
    const nextBoundaryAt = candidateBoundaries.length > 0 ? Math.min(...candidateBoundaries) : phaseEndsAt

    return {
      now,
      phase: "EARN_TRIVIA",
      phaseStartedAt,
      phaseEndsAt,
      giftWindowId: cycleIndex + 1,
      round: {
        id: globalRoundId,
        startedAt: roundStartedAt,
        endsAt: roundEndsAt,
        durationMs: this.roundDurationMs,
      },
      roundsPerEarn: this.roundsPerEarn,
      nextBoundaryAt,
      speedMultiplier: this.speedMultiplier,
    }
  }
}
