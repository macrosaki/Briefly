import { buildClockConfig, ClockEnv } from "./clock/config"
import { GlobalClock } from "./clock/globalClock"
import { ClockSchedule, ClockState } from "./clock/schedule"
import { TriviaCoordinator } from "./trivia/coordinator"
import { hashWallet } from "./trivia/hashing"
import { voteWindowForSpeed } from "./trivia/logic"
import { TriviaVoteShard } from "./trivia/voteShard"
import { VoteOption } from "./trivia/types"
import { AuthDurable } from "./auth/authDurable"
import { GiftEvent } from "./gift/giftEvent"
import { SponsorQueueDO } from "./sponsor/sponsorQueue"
import { AdminPanel } from "./admin/adminPanel"
import { parseAdminAllowlist, isAdminWallet } from "./admin/authz"
import { WeeklyPayoutDO } from "./payout/payoutDO"

export interface Env extends ClockEnv {
  GLOBAL_CLOCK: DurableObjectNamespace
  TRIVIA_SHARD: DurableObjectNamespace
  TRIVIA_COORDINATOR: DurableObjectNamespace
  AUTH: DurableObjectNamespace
  GIFT_EVENT: DurableObjectNamespace
  SPONSOR_QUEUE: DurableObjectNamespace
  ADMIN_PANEL: DurableObjectNamespace
  WEEKLY_PAYOUT: DurableObjectNamespace
  VOTE_SHARD_COUNT?: string
  SESSION_SECRET?: string
  GIFT_DEFAULT_BALANCE?: string
  ADMIN_WALLETS?: string
  MIN_PARTICIPATION_BID?: string
  GLIMMER_PAYOUT_AMOUNT?: string
}

const handleClockRequest = async (request: Request, env: Env) => {
  const origin = request.headers.get("Origin")
  
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    const preflight = handleCorsPreflight(origin)
    if (preflight) return preflight
  }
  
  const id = env.GLOBAL_CLOCK.idFromName("global")
  const stub = env.GLOBAL_CLOCK.get(id)
  const response = await stub.fetch(request)
  return addCorsHeaders(response, origin)
}

const health = (request: Request, env: Env) => {
  const origin = request.headers.get("Origin")
  
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    const preflight = handleCorsPreflight(origin)
    if (preflight) return preflight
  }
  
  const config = buildClockConfig(env)
  const schedule = new ClockSchedule(config)
  const response = new Response(
    JSON.stringify({
      ok: true,
      speedMultiplier: config.speedMultiplier,
      nextBoundary: schedule.getState(Date.now()).nextBoundaryAt,
    }),
    {
      headers: { "content-type": "application/json" },
    },
  )
  return addCorsHeaders(response, origin)
}

const parseOption = (input: string | undefined): VoteOption | null => {
  if (!input) return null
  const normalized = input.trim().toUpperCase()
  if (normalized === "A" || normalized === "B" || normalized === "C" || normalized === "D") {
    return normalized
  }
  return null
}

const shardCountFromEnv = (env: Env): number => {
  const parsed = Number(env.VOTE_SHARD_COUNT ?? "4")
  if (Number.isNaN(parsed) || parsed < 1) return 4
  return Math.max(1, Math.floor(parsed))
}

const fetchClockState = async (env: Env): Promise<ClockState> => {
  const id = env.GLOBAL_CLOCK.idFromName("global")
  const stub = env.GLOBAL_CLOCK.get(id)
  const response = await stub.fetch("http://clock")
  return (await response.json()) as ClockState
}

const handleVoteIngress = async (request: Request, env: Env) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 })

  const body = (await request.json()) as { wallet: string; option: string }
  const option = parseOption(body.option)
  if (!body.wallet || !option) {
    return new Response("Invalid vote payload", { status: 400 })
  }

  const clock = await fetchClockState(env)
  if (clock.phase !== "EARN_TRIVIA" || !clock.round) {
    return new Response("Voting is closed", { status: 409 })
  }

  const speedMultiplier = clock.speedMultiplier ?? 1
  const voteWindowEndsAt = clock.round.startedAt + voteWindowForSpeed(speedMultiplier)
  if (clock.now > voteWindowEndsAt) {
    return new Response("Vote window ended", { status: 409 })
  }

  const hash = hashWallet(body.wallet)
  const shardIndex = hash % shardCountFromEnv(env)
  const shardId = env.TRIVIA_SHARD.idFromName(`shard-${shardIndex}`)
  const shard = env.TRIVIA_SHARD.get(shardId)

  const shardResponse = await shard.fetch("http://shard/vote", {
    method: "POST",
    body: JSON.stringify({
      roundId: clock.round.id,
      option,
      voterHash: hash,
    }),
  })

  const payload = await shardResponse.json()

  const coordinatorId = env.TRIVIA_COORDINATOR.idFromName("coordinator")
  const coordinator = env.TRIVIA_COORDINATOR.get(coordinatorId)
  await coordinator.fetch("http://coordinator/schedule", {
    method: "POST",
    body: JSON.stringify({
      roundId: clock.round.id,
      voteWindowEndsAt,
      speedMultiplier,
    }),
  })

  return new Response(JSON.stringify({ ok: payload.accepted, duplicate: payload.duplicate, roundId: clock.round.id }), {
    status: shardResponse.status,
    headers: { "content-type": "application/json" },
  })
}

const fetchAdminWallet = async (request: Request, env: Env): Promise<string | null> => {
  const id = env.AUTH.idFromName("auth")
  const stub = env.AUTH.get(id)
  const response = await stub.fetch("http://auth/auth/session", {
    headers: { cookie: request.headers.get("cookie") ?? "" },
  })
  if (!response.ok) return null
  const data = (await response.json()) as { wallet?: string }
  return data.wallet ?? null
}

const addCorsHeaders = (response: Response, origin: string | null): Response => {
  const headers = new Headers(response.headers)
  
  // Allow requests from brieflymade.com and www.brieflymade.com
  if (origin && (origin === "https://brieflymade.com" || origin === "https://www.brieflymade.com")) {
    headers.set("Access-Control-Allow-Origin", origin)
    headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization")
    headers.set("Access-Control-Allow-Credentials", "true")
    headers.set("Access-Control-Max-Age", "86400")
  }
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

const handleCorsPreflight = (origin: string | null): Response | null => {
  if (origin && (origin === "https://brieflymade.com" || origin === "https://www.brieflymade.com")) {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Max-Age": "86400",
      },
    })
  }
  return null
}

const worker: ExportedHandler<Env> = {
  fetch(request, env) {
    const url = new URL(request.url)
    const origin = request.headers.get("Origin")
    
    if (url.pathname === "/clock") {
      return handleClockRequest(request, env)
    }

    if (url.pathname === "/health") {
      return health(request, env)
    }

    if (url.pathname === "/vote") {
      // Handle CORS preflight
      if (request.method === "OPTIONS") {
        const preflight = handleCorsPreflight(origin)
        if (preflight) return preflight
      }
      return handleVoteIngress(request, env).then((response) => addCorsHeaders(response, origin))
    }

    if (url.pathname.startsWith("/auth") || url.pathname === "/profile") {
      const id = env.AUTH.idFromName("auth")
      const stub = env.AUTH.get(id)
      return stub.fetch(request)
    }

    if (url.pathname.startsWith("/gift")) {
      const id = env.GIFT_EVENT.idFromName("gift-global")
      const stub = env.GIFT_EVENT.get(id)
      return stub.fetch(request)
    }

    if (url.pathname.startsWith("/sponsor") || url.pathname.startsWith("/r/s/")) {
      // protect moderation endpoints
      if (url.pathname === "/sponsor/approve" || url.pathname === "/sponsor/reject") {
        return (async () => {
          const wallet = await fetchAdminWallet(request, env)
          const allowed = isAdminWallet(wallet ?? undefined, parseAdminAllowlist(env.ADMIN_WALLETS))
          if (!allowed) return new Response("forbidden", { status: 403 })
          const id = env.SPONSOR_QUEUE.idFromName("sponsor-queue")
          const stub = env.SPONSOR_QUEUE.get(id)
          return stub.fetch(request)
        })()
      }
      const id = env.SPONSOR_QUEUE.idFromName("sponsor-queue")
      const stub = env.SPONSOR_QUEUE.get(id)
      return stub.fetch(request)
    }

    if (url.pathname.startsWith("/admin")) {
      return (async () => {
        const wallet = await fetchAdminWallet(request, env)
        const allowed = isAdminWallet(wallet ?? undefined, parseAdminAllowlist(env.ADMIN_WALLETS))
        if (!allowed) return new Response("forbidden", { status: 403 })
        const id = env.ADMIN_PANEL.idFromName("admin-panel")
        const stub = env.ADMIN_PANEL.get(id)
        const headers = new Headers(request.headers)
        if (wallet) headers.set("x-admin-wallet", wallet)
        return stub.fetch(new Request(request, { headers }))
      })()
    }

    if (url.pathname.startsWith("/jobs/payout") || url.pathname.startsWith("/admin/payouts")) {
      const id = env.WEEKLY_PAYOUT.idFromName("weekly-payout")
      const stub = env.WEEKLY_PAYOUT.get(id)
      return stub.fetch(request)
    }

    return new Response("Not found", { status: 404 })
  },
}

export default worker
export {
  GlobalClock,
  TriviaVoteShard,
  TriviaCoordinator,
  AuthDurable,
  GiftEvent,
  SponsorQueueDO,
  AdminPanel,
  WeeklyPayoutDO,
}
