export interface Creative {
  name: string
  link: string
  image: string
  version: number
}

export type SlotStatus = "PENDING" | "APPROVED" | "REJECTED"

export interface SponsorSlot {
  id: string
  sponsorId: string
  creative: Creative
  status: SlotStatus
  startAt: number
  endAt: number
  createdAt: number
  approvedAt?: number
}

export interface SlotStats {
  impressions: number
  clicks: number
}

export interface PurchaseResult {
  slots: SponsorSlot[]
  etaMs: number
}
