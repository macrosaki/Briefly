import { ClockState } from "./schedule"
import { TriviaResultPayload } from "../trivia/types"

export type ClockMessage =
  | {
      type: "snapshot"
      state: ClockState
      latestResult?: TriviaResultPayload | null
    }
  | {
      type: "tick"
      state: ClockState
    }
  | {
      type: "trivia_result"
      result: TriviaResultPayload
    }
