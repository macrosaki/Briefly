interface GiftType {
  id: string
  name: string
  threshold: number
}

interface FlagRecord {
  wallet: string
  reason: string
  createdAt: number
}

export class AdminStore {
  private gifts: GiftType[] = []
  private bans: Set<string> = new Set()
  private flags: FlagRecord[] = []

  upsertGift(gift: GiftType) {
    const existing = this.gifts.find((g) => g.id === gift.id)
    if (existing) {
      existing.name = gift.name
      existing.threshold = gift.threshold
    } else {
      this.gifts.push(gift)
    }
    return this.gifts
  }

  listGifts() {
    return this.gifts
  }

  ban(wallet: string) {
    this.bans.add(wallet)
    return Array.from(this.bans)
  }

  listBans() {
    return Array.from(this.bans)
  }

  flag(wallet: string, reason: string, now: number) {
    const record: FlagRecord = { wallet, reason, createdAt: now }
    this.flags.push(record)
    return record
  }

  listFlags() {
    return this.flags
  }

  metrics() {
    return {
      giftsDay: this.gifts.length,
      giftsWeek: this.gifts.length * 3,
    }
  }
}
