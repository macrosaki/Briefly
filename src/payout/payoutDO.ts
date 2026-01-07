import { WeeklyPayoutEngine } from "./engine"
import { PayoutReport } from "./types"

interface Env {
  MIN_PARTICIPATION_BID?: string
  GLIMMER_PAYOUT_AMOUNT?: string
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } })

export class WeeklyPayoutDO implements DurableObject {
  private engine: WeeklyPayoutEngine

  constructor(private readonly state: DurableObjectState, private readonly env: Env) {
    const minBid = Number(env.MIN_PARTICIPATION_BID ?? "50")
    const amount = Number(env.GLIMMER_PAYOUT_AMOUNT ?? "10")
    this.engine = new WeeklyPayoutEngine({
      minParticipationBid: Number.isFinite(minBid) ? minBid : 50,
      payoutAmount: Number.isFinite(amount) ? amount : 10,
    })
  }

  async fetch(request: Request) {
    const url = new URL(request.url)
    if (request.method === "POST" && url.pathname === "/payout/register") {
      const { wallet, eventId, bid, now } = (await request.json()) as {
        wallet: string
        eventId: string
        bid: number
        now: number
      }
      this.engine.registerParticipation(wallet, eventId, bid, now)
      return json({ ok: true })
    }

    if (request.method === "POST" && url.pathname === "/jobs/payout") {
      const { now } = (await request.json().catch(() => ({ now: Date.now() }))) as { now?: number }
      const report = this.engine.runPayout(now ?? Date.now())
      return json(report)
    }

    if (request.method === "GET" && url.pathname === "/admin/payouts") {
      const report = this.engine.getReport()
      return json(report)
    }

    return json({ error: "not_found" }, 404)
  }
}
