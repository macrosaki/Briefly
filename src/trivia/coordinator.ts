import { ClockEnv } from "../clock/config"
import { buildTriviaResult, mergeTallies, voteWindowForSpeed } from "./logic"
import { ShardTallyRequest, ShardTallyResponse, TriviaResultPayload } from "./types"

interface Env extends ClockEnv {
  GLOBAL_CLOCK: DurableObjectNamespace
  TRIVIA_SHARD: DurableObjectNamespace
  VOTE_SHARD_COUNT?: string
}

export class TriviaCoordinator implements DurableObject {
  private voteWindowEndsAt: number | null = null
  private pendingRoundId: number | null = null

  constructor(private readonly state: DurableObjectState, private readonly env: Env) {}

  private shardCount(): number {
    const count = Number(this.env.VOTE_SHARD_COUNT ?? "4")
    if (Number.isNaN(count) || count < 1) return 4
    return Math.max(1, Math.floor(count))
  }

  private shardId(index: number): DurableObjectId {
    return this.env.TRIVIA_SHARD.idFromName(`shard-${index}`)
  }

  private async collectTallies(roundId: number): Promise<[number, number, number, number]> {
    const promises: Promise<ShardTallyResponse>[] = []
    for (let i = 0; i < this.shardCount(); i += 1) {
      const stub = this.env.TRIVIA_SHARD.get(this.shardId(i))
      const body: ShardTallyRequest = { roundId, reset: true }
      promises.push(
        stub
          .fetch("http://shard/tally", {
            method: "POST",
            body: JSON.stringify(body),
          })
          .then((response) => response.json() as Promise<ShardTallyResponse>),
      )
    }
    const tallies = await Promise.all(promises)
    const distributions = tallies.map((item) => item.counts)
    return mergeTallies(distributions)
  }

  private async publishResult(result: TriviaResultPayload) {
    const id = this.env.GLOBAL_CLOCK.idFromName("global")
    const stub = this.env.GLOBAL_CLOCK.get(id)
    await stub.fetch("http://clock/publish/trivia", {
      method: "POST",
      body: JSON.stringify(result),
    })
  }

  private async runMerge() {
    if (this.pendingRoundId === null || this.voteWindowEndsAt === null) {
      return
    }
    const distribution = await this.collectTallies(this.pendingRoundId)
    const result = buildTriviaResult(this.pendingRoundId, distribution, this.voteWindowEndsAt)
    await this.publishResult(result)
    this.pendingRoundId = null
    this.voteWindowEndsAt = null
  }

  private schedule(roundId: number, voteWindowEndsAt: number) {
    if (this.pendingRoundId !== null && this.pendingRoundId > roundId) {
      return
    }
    this.pendingRoundId = roundId
    this.voteWindowEndsAt = voteWindowEndsAt
    if (typeof this.state.setAlarm === "function") {
      this.state.setAlarm(new Date(voteWindowEndsAt))
    }
  }

  async fetch(request: Request) {
    const url = new URL(request.url)
    if (request.method === "POST" && url.pathname === "/schedule") {
      const body = (await request.json()) as { roundId: number; voteWindowEndsAt: number; speedMultiplier?: number }
      const voteWindowDuration = voteWindowForSpeed(body.speedMultiplier ?? 1)
      // defensive: only schedule if within plausible timeframe
      if (body.voteWindowEndsAt < Date.now() + voteWindowDuration * 2) {
        this.schedule(body.roundId, body.voteWindowEndsAt)
      }
      return new Response(JSON.stringify({ scheduled: true, roundId: body.roundId }), {
        headers: { "content-type": "application/json" },
      })
    }

    if (request.method === "POST" && url.pathname === "/merge-now") {
      await this.runMerge()
      return new Response(JSON.stringify({ merged: true }), { headers: { "content-type": "application/json" } })
    }

    return new Response("Not found", { status: 404 })
  }

  async alarm() {
    await this.runMerge()
  }
}
