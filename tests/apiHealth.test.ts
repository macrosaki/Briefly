import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { GET as healthHandler } from "../app/api/health/route"

const makeResponse = (ok: boolean) =>
  ({
    ok,
    status: ok ? 200 : 500,
    json: async () => ({}),
  }) as Response

describe("/api/health", () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.resetAllMocks()
    global.fetch = vi.fn().mockResolvedValue(makeResponse(true))
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it("returns expected shape", async () => {
    const res = await healthHandler()
    const data = await res.json()
    expect(data).toHaveProperty("ok")
    expect(data).toHaveProperty("environment")
    expect(data).toHaveProperty("canReachGlobalClock")
    expect(data).toHaveProperty("canQueryD1")
    expect(data.environment).toHaveProperty("runtime")
  })

  it("reports failure when clock unreachable", async () => {
    global.fetch = vi.fn().mockResolvedValue(makeResponse(false))
    const res = await healthHandler()
    const data = await res.json()
    expect(data.ok).toBe(false)
    expect(data.canReachGlobalClock).toBe(false)
  })
})

