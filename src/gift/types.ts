export type GiftStatus = "ACTIVE" | "RESOLVED"

export interface GiftState {
  giftId: number
  threshold: number
  highestBid: number
  highestBidder: string | null
  startedAt: number
  endsAt: number
  status: GiftStatus
  resolution?: GiftResolution
}

export interface GiftResolution {
  winner: string | null
  amount: number
  thresholdMet: boolean
  resolvedAt: number
}

export interface BidResult {
  ok: boolean
  reason?: string
  highestBid: number
  highestBidder: string | null
  reserved?: number
  available?: number
}

export type GiftMessage =
  | { type: "gift_snapshot"; state: GiftState }
  | { type: "gift_update"; state: GiftState }
  | { type: "gift_result"; state: GiftState }
