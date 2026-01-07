import { NextResponse } from "next/server"
import { getApiBaseUrl } from "../../../urlHelpers"

export const runtime = 'edge'

// Local type definition (src/clock is excluded from Next.js build)
type ClockPhase = "SPEND_GIFT" | "EARN_TRIVIA"

interface TriviaRoundState {
  id: number
  startedAt: number
  endsAt: number
  durationMs: number
}

interface ClockState {
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

export async function GET(): Promise<NextResponse<ClockState | { error: string }>> {
  try {
    const base = getApiBaseUrl()
    const res = await fetch(`${base}/clock`, { cache: "no-store" })
    if (!res.ok) {
      return NextResponse.json({ error: `clock status ${res.status}` }, { status: 502 })
    }
    const data = (await res.json()) as ClockState
    return NextResponse.json(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

