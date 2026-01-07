import { Creative, PurchaseResult, SlotStats, SponsorSlot } from "./types"

const SLOT_MS = 10 * 60 * 1000
const THROTTLE_WINDOW_MS = 6 * 60 * 60 * 1000
const THROTTLE_MAX_MINUTES = 50 // rolling
const QUEUE_CAP_SLOTS = 72 // 12 hours
const DEFAULT_FREEZE_MS = 10 * 60 * 1000
const ANCHOR = Date.UTC(2024, 0, 1, 0, 0, 0, 0)

const PROFANITY = ["badword", "curse", "slur"]

export interface QueueConfig {
  slotMs?: number
  queueCap?: number
  throttleMinutes?: number
  throttleWindowMs?: number
  freezeWindowMs?: number
}

export class SponsorQueue {
  private slots: SponsorSlot[] = []
  private stats: Map<string, { impressions: number; clicks: number; wallets: Set<string> }> = new Map()
  private freezeWindowMs: number
  private slotMs: number
  private queueCap: number
  private throttleMinutes: number
  private throttleWindowMs: number

  constructor(config: QueueConfig = {}) {
    this.slotMs = config.slotMs ?? SLOT_MS
    this.queueCap = config.queueCap ?? QUEUE_CAP_SLOTS
    this.throttleMinutes = config.throttleMinutes ?? THROTTLE_MAX_MINUTES
    this.throttleWindowMs = config.throttleWindowMs ?? THROTTLE_WINDOW_MS
    this.freezeWindowMs = config.freezeWindowMs ?? DEFAULT_FREEZE_MS
  }

  private nextBoundary(now: number): number {
    const elapsed = now - ANCHOR
    const slots = Math.ceil(elapsed / this.slotMs)
    return ANCHOR + slots * this.slotMs
  }

  private lastEnd(): number {
    if (this.slots.length === 0) return 0
    return this.slots[this.slots.length - 1].endAt
  }

  private profanityCheck(text: string): boolean {
    const lower = text.toLowerCase()
    return !PROFANITY.some((bad) => lower.includes(bad))
  }

  private linkValid(link: string): boolean {
    try {
      const url = new URL(link)
      return url.protocol === "https:"
    } catch {
      return false
    }
  }

  private throttleAllowed(sponsorId: string, startTimes: number[], now: number): boolean {
    const windowStart = now - this.throttleWindowMs
    const slotsForSponsor = this.slots.filter(
      (slot) => slot.sponsorId === sponsorId && slot.startAt >= windowStart && slot.startAt <= now + this.throttleWindowMs,
    )
    const totalMinutesExisting = (slotsForSponsor.length * this.slotMs) / 60000
    const totalMinutesIncoming = (startTimes.length * this.slotMs) / 60000
    return totalMinutesExisting + totalMinutesIncoming <= this.throttleMinutes
  }

  private makeSlots(
    sponsorId: string,
    creative: Creative,
    pack: number,
    now: number,
  ): { slots: SponsorSlot[]; etaMs: number } | null {
    if (!this.profanityCheck(creative.name)) return null
    if (!this.linkValid(creative.link)) return null
    if (this.slots.length + pack > this.queueCap) return null

    let start = Math.max(this.nextBoundary(now), this.lastEnd() || now)
    const newSlots: SponsorSlot[] = []
    const startTimes: number[] = []

    for (let i = 0; i < pack; i += 1) {
      const endAt = start + this.slotMs
      const slot: SponsorSlot = {
        id: `slot-${start}-${i}-${Math.random().toString(16).slice(2, 6)}`,
        sponsorId,
        creative,
        status: "PENDING",
        startAt: start,
        endAt,
        createdAt: now,
      }
      newSlots.push(slot)
      startTimes.push(start)
      start = endAt
    }

    if (!this.throttleAllowed(sponsorId, startTimes, now)) return null

    return { slots: newSlots, etaMs: newSlots[0].startAt - now }
  }

  purchase(sponsorId: string, creative: Creative, pack: 1 | 3 | 5, now: number): PurchaseResult | null {
    const built = this.makeSlots(sponsorId, creative, pack, now)
    if (!built) return null
    this.slots.push(...built.slots)
    return built
  }

  approve(slotIds: string[], now: number): SponsorSlot[] {
    const updated: SponsorSlot[] = []
    for (const slot of this.slots) {
      if (slotIds.includes(slot.id)) {
        const freezeLimit = slot.startAt - this.freezeWindowMs
        if (now > freezeLimit) continue
        slot.status = "APPROVED"
        slot.approvedAt = now
        updated.push(slot)
      }
    }
    return updated
  }

  reject(slotIds: string[]): SponsorSlot[] {
    const updated: SponsorSlot[] = []
    for (const slot of this.slots) {
      if (slotIds.includes(slot.id)) {
        slot.status = "REJECTED"
        updated.push(slot)
      }
    }
    return updated
  }

  recordImpression(slotId: string, wallet: string) {
    const stat = this.stats.get(slotId) ?? { impressions: 0, clicks: 0, wallets: new Set<string>() }
    if (!stat.wallets.has(wallet)) {
      stat.wallets.add(wallet)
      stat.impressions += 1
    }
    this.stats.set(slotId, stat)
  }

  recordClick(slotId: string) {
    const stat = this.stats.get(slotId) ?? { impressions: 0, clicks: 0, wallets: new Set<string>() }
    stat.clicks += 1
    this.stats.set(slotId, stat)
  }

  dashboard(sponsorId: string): Array<SponsorSlot & { stats: SlotStats }> {
    return this.slots
      .filter((slot) => slot.sponsorId === sponsorId)
      .map((slot) => {
        const stat = this.stats.get(slot.id)
        return {
          ...slot,
          stats: {
            impressions: stat?.impressions ?? 0,
            clicks: stat?.clicks ?? 0,
          },
        }
      })
  }

  findSlot(slotId: string): SponsorSlot | undefined {
    return this.slots.find((slot) => slot.id === slotId)
  }

  allSlots() {
    return this.slots
  }
}
