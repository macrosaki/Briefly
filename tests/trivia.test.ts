import { describe, expect, it } from "vitest"
import { BloomSeenTracker } from "../src/trivia/bloom"
import { buildTriviaResult, evaluateCrowdAward, mergeTallies, pickCorrectAnswer, pickDifficulty } from "../src/trivia/logic"

describe("Trivia vote dedup + merge", () => {
  it("prevents double vote in bloom tracker", () => {
    const tracker = new BloomSeenTracker()
    const first = tracker.seenOrAdd(1234)
    const second = tracker.seenOrAdd(1234)
    expect(first).toBe(false)
    expect(second).toBe(true)
  })

  it("merges shard tallies correctly", () => {
    const merged = mergeTallies([
      [10, 5, 0, 2],
      [4, 1, 3, 0],
      [0, 0, 1, 1],
    ])
    expect(merged).toEqual([14, 6, 4, 3])
  })

  it("gates award by difficulty threshold", () => {
    const distribution: [number, number, number, number] = [60, 30, 5, 5]
    const correctAnswer = "A"
    const easy = evaluateCrowdAward(distribution, correctAnswer, "EASY")
    const hard = evaluateCrowdAward(distribution, correctAnswer, "HARD")
    expect(easy.crowdAwarded).toBe(true)
    expect(hard.crowdAwarded).toBe(true)

    const toughDistribution: [number, number, number, number] = [20, 30, 30, 20]
    const medium = evaluateCrowdAward(toughDistribution, "A", "MEDIUM")
    expect(medium.crowdAwarded).toBe(false)
  })

  it("builds deterministic trivia result metadata", () => {
    const roundId = 5
    const distribution: [number, number, number, number] = [1, 2, 3, 4]
    const result = buildTriviaResult(roundId, distribution, Date.now())
    expect(result.correctAnswer).toBe(pickCorrectAnswer(roundId))
    expect(result.difficulty).toBe(pickDifficulty(roundId))
    expect(result.totalVotes).toBe(10)
  })
})
