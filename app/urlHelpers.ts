type LocationLike = Pick<Location, "protocol" | "host" | "origin">

const getLocation = (location?: LocationLike): LocationLike | undefined => {
  if (location) return location
  if (typeof window !== "undefined") return window.location
  return undefined
}

export const getApiBaseUrl = (options?: { env?: NodeJS.ProcessEnv; location?: LocationLike }): string => {
  const env = options?.env ?? process.env
  const override = env.NEXT_PUBLIC_API_BASE_URL?.trim()
  if (override) {
    // normalize by trimming any trailing slash
    return override.replace(/\/+$/, "")
  }

  const loc = getLocation(options?.location)
  if (loc) return loc.origin.replace(/\/+$/, "")

  // Fallback for non-browser environments (tests/SSR)
  return "http://localhost:3000"
}

export const getClockWsUrl = (options?: { env?: NodeJS.ProcessEnv; location?: LocationLike }): string | undefined => {
  const base = getApiBaseUrl(options)
  let url: URL
  try {
    url = new URL(base)
  } catch {
    return undefined
  }

  url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
  url.pathname = "/clock"
  url.search = ""
  url.hash = ""
  return url.toString()
}

