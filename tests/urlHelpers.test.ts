import { describe, expect, it } from "vitest"
import { getApiBaseUrl, getClockWsUrl } from "../app/urlHelpers"

const makeLocation = (origin: string) => {
  const url = new URL(origin)
  return {
    origin: url.origin,
    protocol: url.protocol,
    host: url.host,
  }
}

describe("urlHelpers", () => {
  it("defaults to same-origin http", () => {
    const location = makeLocation("http://localhost:3000")
    const api = getApiBaseUrl({ location })
    const ws = getClockWsUrl({ location })
    expect(api).toBe("http://localhost:3000")
    expect(ws).toBe("ws://localhost:3000/clock")
  })

  it("uses wss for https origins", () => {
    const location = makeLocation("https://brieflymade.com")
    const api = getApiBaseUrl({ location })
    const ws = getClockWsUrl({ location })
    expect(api).toBe("https://brieflymade.com")
    expect(ws).toBe("wss://brieflymade.com/clock")
  })

  it("honors NEXT_PUBLIC_API_BASE_URL when set", () => {
    const env = { NEXT_PUBLIC_API_BASE_URL: "https://api.brieflymade.com" } as NodeJS.ProcessEnv
    const api = getApiBaseUrl({ env })
    const ws = getClockWsUrl({ env })
    expect(api).toBe("https://api.brieflymade.com")
    expect(ws).toBe("wss://api.brieflymade.com/clock")
  })

  it("trims trailing slashes in overrides", () => {
    const env = { NEXT_PUBLIC_API_BASE_URL: "https://api.brieflymade.com/" } as NodeJS.ProcessEnv
    const api = getApiBaseUrl({ env })
    expect(api).toBe("https://api.brieflymade.com")
  })
})

