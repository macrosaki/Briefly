import { NextResponse } from "next/server"
import { getApiBaseUrl } from "../../../urlHelpers"
import type { ClockState } from "../../../src/clock/schedule"

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

