export interface PayoutRecord {
  wallet: string
  amount: number
  weekStart: number
  events: number
}

export interface PayoutReport {
  weekStart: number
  totalGlimmer: number
  qualifiers: number
  records: PayoutRecord[]
}
