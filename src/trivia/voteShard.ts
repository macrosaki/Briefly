import { BloomSeenTracker } from "./bloom"
import { ShardTallyRequest, ShardTallyResponse, ShardVoteRequest, ShardVoteResponse, VoteOption } from "./types"

type Counts = [number, number, number, number]

const optionIndex = (option: VoteOption): number => {
  switch (option) {
    case "A":
      return 0
    case "B":
      return 1
    case "C":
      return 2
    case "D":
      return 3
    default:
      return 0
  }
}

const emptyCounts = (): Counts => [0, 0, 0, 0]

interface RoundBucket {
  roundId: number
  counts: Counts
  bloom: BloomSeenTracker
}

export class TriviaVoteShard implements DurableObject {
  private bucket: RoundBucket | null = null

  constructor(private readonly state: DurableObjectState) {}

  private ensureRound(roundId: number) {
    if (!this.bucket || this.bucket.roundId !== roundId) {
      this.bucket = {
        roundId,
        counts: emptyCounts(),
        bloom: new BloomSeenTracker(),
      }
    }
  }

  private recordVote(body: ShardVoteRequest): ShardVoteResponse {
    this.ensureRound(body.roundId)
    if (!this.bucket) {
      return {
        accepted: false,
        duplicate: false,
        roundId: body.roundId,
        counts: emptyCounts(),
      }
    }
    const duplicate = this.bucket.bloom.seenOrAdd(body.voterHash)
    if (!duplicate) {
      const idx = optionIndex(body.option)
      this.bucket.counts[idx] += 1
    }

    return {
      accepted: !duplicate,
      duplicate,
      roundId: this.bucket.roundId,
      counts: this.bucket.counts,
    }
  }

  private tally(body: ShardTallyRequest): ShardTallyResponse {
    this.ensureRound(body.roundId)
    if (!this.bucket) {
      return { roundId: body.roundId, counts: emptyCounts() }
    }
    const response: ShardTallyResponse = {
      roundId: this.bucket.roundId,
      counts: this.bucket.counts,
    }
    if (body.reset) {
      this.bucket = null
    }
    return response
  }

  async fetch(request: Request) {
    const url = new URL(request.url)
    if (request.method === "POST" && url.pathname === "/vote") {
      const body = (await request.json()) as ShardVoteRequest
      const result = this.recordVote(body)
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    }

    if (request.method === "POST" && url.pathname === "/tally") {
      const body = (await request.json()) as ShardTallyRequest
      const result = this.tally(body)
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    }

    return new Response("Not found", { status: 404 })
  }
}
