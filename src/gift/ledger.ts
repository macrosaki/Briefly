import { BidResult, GiftResolution, GiftState } from "./types"

interface WalletLedger {
  balance: number
  reserved: number
  spent: number
}

interface GiftParams {
  giftId: number
  threshold: number
  startedAt: number
  endsAt: number
}

export class GiftLedger {
  private ledger = new Map<string, WalletLedger>()
  private state: GiftState | null = null

  constructor(private readonly defaultBalance = 10_000) {}

  start(params: GiftParams) {
    this.state = {
      giftId: params.giftId,
      threshold: params.threshold,
      startedAt: params.startedAt,
      endsAt: params.endsAt,
      highestBid: 0,
      highestBidder: null,
      status: "ACTIVE",
    }
  }

  currentState(): GiftState | null {
    return this.state
  }

  private walletEntry(wallet: string): WalletLedger {
    const existing = this.ledger.get(wallet)
    if (existing) return existing
    const created: WalletLedger = { balance: this.defaultBalance, reserved: 0, spent: 0 }
    this.ledger.set(wallet, created)
    return created
  }

  bid(wallet: string, amount: number, now: number): BidResult {
    if (!this.state || this.state.status !== "ACTIVE") {
      return { ok: false, reason: "no_active_event", highestBid: 0, highestBidder: null }
    }
    if (now >= this.state.endsAt) {
      return { ok: false, reason: "ended", highestBid: this.state.highestBid, highestBidder: this.state.highestBidder }
    }
    if (amount <= this.state.highestBid) {
      return { ok: false, reason: "too_low", highestBid: this.state.highestBid, highestBidder: this.state.highestBidder }
    }

    const entry = this.walletEntry(wallet)
    const available = entry.balance - entry.reserved - entry.spent
    const needed = amount - entry.reserved
    if (needed > available) {
      return {
        ok: false,
        reason: "insufficient",
        highestBid: this.state.highestBid,
        highestBidder: this.state.highestBidder,
        reserved: entry.reserved,
        available,
      }
    }

    // Release previous highest bidder
    if (this.state.highestBidder && this.state.highestBidder !== wallet) {
      const prev = this.walletEntry(this.state.highestBidder)
      prev.reserved = 0
    }

    entry.reserved = amount
    this.state.highestBid = amount
    this.state.highestBidder = wallet

    return {
      ok: true,
      highestBid: this.state.highestBid,
      highestBidder: this.state.highestBidder,
      reserved: entry.reserved,
      available: entry.balance - entry.reserved - entry.spent,
    }
  }

  finalize(now: number): GiftState | null {
    if (!this.state || this.state.status === "RESOLVED") return this.state

    const thresholdMet = this.state.highestBid >= this.state.threshold && !!this.state.highestBidder
    let resolution: GiftResolution = {
      winner: null,
      amount: 0,
      thresholdMet,
      resolvedAt: now,
    }

    if (thresholdMet && this.state.highestBidder) {
      const winner = this.walletEntry(this.state.highestBidder)
      winner.spent += this.state.highestBid
      winner.reserved = 0
      resolution = {
        winner: this.state.highestBidder,
        amount: this.state.highestBid,
        thresholdMet: true,
        resolvedAt: now,
      }
    }

    // release all other reserves
    for (const [wallet, entry] of this.ledger.entries()) {
      if (resolution.winner !== wallet) {
        entry.reserved = 0
      }
    }

    this.state = {
      ...this.state,
      status: "RESOLVED",
      resolution,
    }
    return this.state
  }
}
