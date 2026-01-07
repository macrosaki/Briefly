export type VoteOption = "A" | "B" | "C" | "D"

export type Difficulty = "EASY" | "MEDIUM" | "HARD"

export interface TriviaResultPayload {
  roundId: number
  distribution: [number, number, number, number]
  correctAnswer: VoteOption
  difficulty: Difficulty
  crowdAwarded: boolean
  voteWindowEndedAt: number
  totalVotes: number
}

export interface ShardVoteRequest {
  roundId: number
  option: VoteOption
  voterHash: number
}

export interface ShardVoteResponse {
  accepted: boolean
  duplicate: boolean
  roundId: number
  counts: [number, number, number, number]
}

export interface ShardTallyRequest {
  roundId: number
  reset?: boolean
}

export interface ShardTallyResponse {
  roundId: number
  counts: [number, number, number, number]
}
