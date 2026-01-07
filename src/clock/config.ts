export const BASE_EARN_DURATION_MS = 10 * 60 * 1000
export const BASE_SPEND_DURATION_MS = 10 * 60 * 1000
export const BASE_ROUND_DURATION_MS = 14 * 1000

const MIN_SPEED = 0.01
const MAX_SPEED = 10

export interface ClockConfig {
  anchorMs: number
  earnDurationMs: number
  spendDurationMs: number
  triviaRoundMs: number
  speedMultiplier: number
}

export interface ClockEnv {
  CLOCK_SPEED_MULTIPLIER?: string
  CLOCK_ANCHOR_MS?: string
}

const DEFAULT_ANCHOR = Date.UTC(2024, 0, 1, 0, 0, 0, 0)

export const clampMultiplier = (value: number) => Math.min(MAX_SPEED, Math.max(MIN_SPEED, value))

export const parseMultiplier = (envValue: string | undefined): number => {
  if (!envValue) return 1
  const parsed = Number(envValue)
  if (Number.isNaN(parsed) || parsed <= 0) return 1
  return clampMultiplier(parsed)
}

export const deriveAnchor = (envValue: string | undefined, now: number, cycleMs: number): number => {
  if (envValue) {
    const parsed = Number(envValue)
    if (!Number.isNaN(parsed) && parsed > 0) return parsed
  }
  // Align to the nearest past cycle boundary so everyone snaps together.
  const elapsed = now - DEFAULT_ANCHOR
  const offset = elapsed % cycleMs
  return now - offset
}

export const buildClockConfig = (env: ClockEnv, now: number = Date.now()): ClockConfig => {
  const speedMultiplier = parseMultiplier(env.CLOCK_SPEED_MULTIPLIER)
  const earnDurationMs = Math.round(BASE_EARN_DURATION_MS * speedMultiplier)
  const spendDurationMs = Math.round(BASE_SPEND_DURATION_MS * speedMultiplier)
  const triviaRoundMs = Math.max(1_000, Math.round(BASE_ROUND_DURATION_MS * speedMultiplier))
  const cycleMs = earnDurationMs + spendDurationMs

  const anchorMs = deriveAnchor(env.CLOCK_ANCHOR_MS, now, cycleMs)

  return {
    anchorMs,
    earnDurationMs,
    spendDurationMs,
    triviaRoundMs,
    speedMultiplier,
  }
}
