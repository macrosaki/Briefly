import { Difficulty, TriviaResultPayload, VoteOption } from "./types"

export const VOTE_WINDOW_MS = 6_000

export const DIFFICULTY_THRESHOLDS: Record<Difficulty, number> = {
  EASY: 0.6,
  MEDIUM: 0.5,
  HARD: 0.4,
}

export const scaleDuration = (baseMs: number, speedMultiplier: number): number =>
  Math.max(250, Math.round(baseMs * speedMultiplier))

export const voteWindowForSpeed = (speedMultiplier: number): number => scaleDuration(VOTE_WINDOW_MS, speedMultiplier)

export const pickCorrectAnswer = (roundId: number): VoteOption => {
  const options: VoteOption[] = ["A", "B", "C", "D"]
  return options[roundId % options.length]
}

export const pickDifficulty = (roundId: number): Difficulty => {
  const mod = roundId % 3
  if (mod === 1) return "EASY"
  if (mod === 2) return "MEDIUM"
  return "HARD"
}

export const mergeTallies = (tallies: Array<[number, number, number, number]>): [number, number, number, number] =>
  tallies.reduce<[number, number, number, number]>(
    (acc, [a, b, c, d]) => {
      acc[0] += a
      acc[1] += b
      acc[2] += c
      acc[3] += d
      return acc
    },
    [0, 0, 0, 0],
  )

export const evaluateCrowdAward = (
  distribution: [number, number, number, number],
  correctAnswer: VoteOption,
  difficulty: Difficulty,
) => {
  const total = distribution.reduce((sum, value) => sum + value, 0)
  if (total === 0) return { crowdAwarded: false, share: 0 }
  const correctIndex = ["A", "B", "C", "D"].indexOf(correctAnswer)
  const share = distribution[correctIndex] / total
  const threshold = DIFFICULTY_THRESHOLDS[difficulty]
  return { crowdAwarded: share >= threshold, share }
}

export const buildTriviaResult = (
  roundId: number,
  distribution: [number, number, number, number],
  voteWindowEndedAt: number,
): TriviaResultPayload => {
  const correctAnswer = pickCorrectAnswer(roundId)
  const difficulty = pickDifficulty(roundId)
  const { crowdAwarded } = evaluateCrowdAward(distribution, correctAnswer, difficulty)
  const totalVotes = distribution.reduce((sum, value) => sum + value, 0)

  return {
    roundId,
    distribution,
    correctAnswer,
    difficulty,
    crowdAwarded,
    voteWindowEndedAt,
    totalVotes,
  }
}
