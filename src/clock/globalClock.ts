import { buildClockConfig, ClockConfig, ClockEnv } from "./config"
import { ClockMessage } from "./messages"
import { ClockSchedule, ClockState } from "./schedule"
import { TriviaResultPayload } from "../trivia/types"

interface Env extends ClockEnv {
  GLOBAL_CLOCK: DurableObjectNamespace
}

export class GlobalClock implements DurableObject {
  private sockets = new Set<WebSocket>()
  private schedule: ClockSchedule
  private config: ClockConfig
  private nextAlarmAt: number | null = null
  private latestResult: TriviaResultPayload | null = null

  constructor(private readonly state: DurableObjectState, private readonly env: Env) {
    this.config = buildClockConfig(env)
    this.schedule = new ClockSchedule(this.config)

    this.state.blockConcurrencyWhile(async () => {
      const storedAnchor = await this.state.storage.get<number>("anchorMs")
      const anchorMs = storedAnchor ?? this.config.anchorMs
      if (storedAnchor === undefined) {
        await this.state.storage.put("anchorMs", anchorMs)
      }
      this.config = { ...this.config, anchorMs }
      this.schedule = new ClockSchedule(this.config)
      const persistedResult = await this.state.storage.get<TriviaResultPayload>("latestTriviaResult")
      if (persistedResult) {
        this.latestResult = persistedResult
      }
    })
  }

  private buildState(now: number = Date.now()): ClockState {
    return this.schedule.getState(now)
  }

  private ensureAlarm(state: ClockState) {
    if (this.nextAlarmAt === state.nextBoundaryAt) return
    this.nextAlarmAt = state.nextBoundaryAt
    if (typeof this.state.setAlarm === "function") {
      this.state.setAlarm(new Date(state.nextBoundaryAt))
    }
  }

  private async broadcast(message: ClockMessage) {
    const payload = JSON.stringify(message)
    const toRemove: WebSocket[] = []
    for (const socket of this.sockets) {
      try {
        socket.send(payload)
      } catch (error) {
        console.error("Failed to broadcast, dropping socket", error)
        toRemove.push(socket)
      }
    }

    toRemove.forEach((socket) => this.sockets.delete(socket))
  }

  private attachSocket(socket: WebSocket) {
    this.sockets.add(socket)

    socket.addEventListener("close", () => this.sockets.delete(socket))
    socket.addEventListener("error", () => this.sockets.delete(socket))
    socket.addEventListener("message", (event) => {
      if (event.data === "ping") {
        socket.send("pong")
      }
    })
  }

  private async publishResult(payload: TriviaResultPayload) {
    this.latestResult = payload
    await this.state.storage.put("latestTriviaResult", payload)
    await this.broadcast({ type: "trivia_result", result: payload })
  }

  async fetch(request: Request) {
    const upgradeHeader = request.headers.get("upgrade")
    const url = new URL(request.url)
    const state = this.buildState(Date.now())
    this.ensureAlarm(state)

    if (request.method === "POST" && url.pathname === "/publish/trivia") {
      const payload = (await request.json()) as TriviaResultPayload
      await this.publishResult(payload)
      return new Response(null, { status: 202 })
    }

    if (upgradeHeader && upgradeHeader.toLowerCase() === "websocket") {
      const { 0: client, 1: server } = new WebSocketPair()
      server.accept()
      this.attachSocket(server)
      server.send(
        JSON.stringify({
          type: "snapshot",
          state,
          latestResult: this.latestResult,
        } satisfies ClockMessage),
      )
      return new Response(null, { status: 101, webSocket: client })
    }

    return new Response(JSON.stringify(state), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
    })
  }

  async alarm() {
    const state = this.buildState(Date.now())
    this.ensureAlarm(state)
    await this.broadcast({ type: "tick", state })
  }
}
