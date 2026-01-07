import { GiftLedger } from "./ledger"
import { GiftMessage, GiftState } from "./types"

interface Env {
  GIFT_DEFAULT_BALANCE?: string
  WEEKLY_PAYOUT?: DurableObjectNamespace
  MIN_PARTICIPATION_BID?: string
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } })

export class GiftEvent implements DurableObject {
  private sockets = new Set<WebSocket>()
  private ledger: GiftLedger
  private state: GiftState | null = null

  constructor(private readonly stateDO: DurableObjectState, private readonly env: Env) {
    const defaultBalance = Number(env.GIFT_DEFAULT_BALANCE ?? "10000")
    this.ledger = new GiftLedger(Number.isFinite(defaultBalance) ? defaultBalance : 10000)
  }

  private broadcast(message: GiftMessage) {
    const payload = JSON.stringify(message)
    const dead: WebSocket[] = []
    for (const socket of this.sockets) {
      try {
        socket.send(payload)
      } catch {
        dead.push(socket)
      }
    }
    dead.forEach((s) => this.sockets.delete(s))
  }

  private attachSocket(ws: WebSocket, state: GiftState | null) {
    this.sockets.add(ws)
    ws.addEventListener("close", () => this.sockets.delete(ws))
    ws.addEventListener("error", () => this.sockets.delete(ws))
    if (state) {
      ws.send(
        JSON.stringify({
          type: "gift_snapshot",
          state,
        } satisfies GiftMessage),
      )
    }
  }

  private ensureAlarm() {
    if (this.state && this.state.status === "ACTIVE" && typeof this.stateDO.setAlarm === "function") {
      this.stateDO.setAlarm(new Date(this.state.endsAt))
    }
  }

  private startEvent(body: { giftId: number; threshold: number; durationMs: number; now: number }) {
    const startsAt = body.now
    const endsAt = body.now + body.durationMs
    this.ledger.start({
      giftId: body.giftId,
      threshold: body.threshold,
      startedAt: startsAt,
      endsAt,
    })
    this.state = this.ledger.currentState()
    this.ensureAlarm()
    if (this.state) this.broadcast({ type: "gift_update", state: this.state })
    return this.state
  }

  async fetch(request: Request) {
    const url = new URL(request.url)
    const upgrade = request.headers.get("upgrade")

    if (upgrade && upgrade.toLowerCase() === "websocket") {
      const { 0: client, 1: server } = new WebSocketPair()
      server.accept()
      this.attachSocket(server, this.state)
      return new Response(null, { status: 101, webSocket: client })
    }

    if (request.method === "POST" && url.pathname === "/gift/start") {
      const body = (await request.json()) as { giftId: number; threshold: number; durationMs: number; now: number }
      const state = this.startEvent(body)
      return json(state)
    }

    if (request.method === "POST" && url.pathname === "/gift/bid") {
      const { wallet, amount, now } = (await request.json()) as { wallet: string; amount: number; now: number }
      const result = this.ledger.bid(wallet, amount, now)
      this.state = this.ledger.currentState()
      if (result.ok && this.state) {
        this.broadcast({ type: "gift_update", state: this.state })
        // record participation for weekly payout
        if (this.env.WEEKLY_PAYOUT) {
          const minBid = Number(this.env.MIN_PARTICIPATION_BID ?? "50")
          if (amount >= (Number.isFinite(minBid) ? minBid : 50)) {
            const id = this.env.WEEKLY_PAYOUT.idFromName("weekly-payout")
            const stub = this.env.WEEKLY_PAYOUT.get(id)
            stub.fetch("http://payout/payout/register", {
              method: "POST",
              body: JSON.stringify({
                wallet,
                eventId: `${this.state.giftId}-${this.state.startedAt}`,
                bid: amount,
                now,
              }),
            })
          }
        }
      }
      return json(result, result.ok ? 200 : 400)
    }

    if (request.method === "POST" && url.pathname === "/gift/finalize") {
      const state = this.ledger.finalize(Date.now())
      this.state = state
      if (state) {
        this.broadcast({ type: "gift_result", state })
      }
      return json(state)
    }

    if (request.method === "GET" && url.pathname === "/gift/state") {
      return json(this.state)
    }

    return json({ error: "not found" }, 404)
  }

  async alarm() {
    const state = this.ledger.finalize(Date.now())
    this.state = state
    if (state) {
      this.broadcast({ type: "gift_result", state })
    }
  }
}
