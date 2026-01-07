import { PayoutRecord, PayoutReport } from "./types"

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const FIVE_MIN_MS = 5 * 60 * 1000

const weekStartFor = (time: number) => {
  const date = new Date(time)
  const day = date.getUTCDay()
  const diffToSunday = day
  const sunday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  sunday.setUTCDate(sunday.getUTCDate() - diffToSunday)
  return sunday.getTime()
}

export interface EngineConfig {
  minParticipationBid?: number
  payoutAmount?: number
}

export class WeeklyPayoutEngine {
  private participations = new Map<number, Map<string, Set<string>>>() // weekStart -> wallet -> eventIds
  private payouts = new Map<number, PayoutReport>()
  private balances = new Map<string, number>()
  private minParticipationBid: number
  private payoutAmount: number

  constructor(config: EngineConfig = {}) {
    this.minParticipationBid = config.minParticipationBid ?? 50
    this.payoutAmount = config.payoutAmount ?? 10
  }

  registerParticipation(wallet: string, eventId: string, bid: number, now: number) {
    if (bid < this.minParticipationBid) return
    const weekStart = weekStartFor(now)
    const week = this.participations.get(weekStart) ?? new Map()
    const events = week.get(wallet) ?? new Set<string>()
    events.add(eventId)
    week.set(wallet, events)
    this.participations.set(weekStart, week)
  }

  runPayout(now: number): PayoutReport | null {
    const targetWeek = weekStartFor(now - FIVE_MIN_MS - WEEK_MS)
    if (this.payouts.has(targetWeek)) {
      return this.payouts.get(targetWeek) ?? null
    }

    const weekData = this.participations.get(targetWeek) ?? new Map()
    const records: PayoutRecord[] = []
    for (const [wallet, events] of weekData.entries()) {
      if (events.size >= 3) {
        records.push({
          wallet,
          amount: this.payoutAmount,
          weekStart: targetWeek,
          events: events.size,
        })
        this.balances.set(wallet, (this.balances.get(wallet) ?? 0) + this.payoutAmount)
      }
    }

    const report: PayoutReport = {
      weekStart: targetWeek,
      totalGlimmer: records.reduce((sum, rec) => sum + rec.amount, 0),
      qualifiers: records.length,
      records,
    }
    this.payouts.set(targetWeek, report)
    return report
  }

  getReport(weekStart?: number): PayoutReport | null {
    if (weekStart !== undefined) return this.payouts.get(weekStart) ?? null
    const latest = Math.max(...Array.from(this.payouts.keys(), (k) => k), 0)
    if (latest === 0) return null
    return this.payouts.get(latest) ?? null
  }
}

export const weekStart = weekStartFor
