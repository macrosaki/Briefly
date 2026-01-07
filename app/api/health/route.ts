import { NextResponse } from "next/server"
import { getApiBaseUrl } from "../../../urlHelpers"

type HealthResult = {
  ok: boolean
  environment: {
    runtime: string
    node?: string
    commit?: string
    branch?: string
  }
  canReachGlobalClock: boolean
  canQueryD1: boolean
  version?: string
  error?: string
}

const withTimeout = async <T>(promise: Promise<T>, ms = 2000): Promise<T> => {
  return await Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ])
}

export async function GET(): Promise<NextResponse<HealthResult>> {
  const envInfo = {
    runtime: "edge",
    node: typeof process !== "undefined" ? process.version : undefined,
    commit: process.env.CF_PAGES_COMMIT_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA,
    branch: process.env.CF_PAGES_BRANCH ?? process.env.VERCEL_GIT_COMMIT_REF,
  }

  let canReachGlobalClock = false
  let clockError: string | undefined
  try {
    const base = getApiBaseUrl()
    const res = await withTimeout(fetch(`${base}/clock`, { cache: "no-store" }), 1500)
    canReachGlobalClock = res.ok
    if (!res.ok) clockError = `clock status ${res.status}`
  } catch (err) {
    clockError = err instanceof Error ? err.message : "unknown clock error"
  }

  // No D1 binding present today; keep this explicit.
  const canQueryD1 = false

  const ok = canReachGlobalClock && canQueryD1
  return NextResponse.json({
    ok,
    environment: envInfo,
    canReachGlobalClock,
    canQueryD1,
    version: envInfo.commit,
    error: ok ? undefined : clockError,
  })
}

