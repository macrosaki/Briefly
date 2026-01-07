"use client";

import { useEffect, useMemo, useState } from "react"

interface Gift {
  id: string
  name: string
  threshold: number
}

interface SponsorSlot {
  id: string
  sponsorId: string
  status: string
  startAt: number
  endAt: number
  createdAt: number
  approvedAt?: number
  creative: {
    name: string
    link: string
    image: string
  }
  stats?: {
    impressions: number
    clicks: number
  }
}

interface Metrics {
  giftsDay: number
  giftsWeek: number
}

const fetchJson = async (path: string, init?: RequestInit) => {
  const response = await fetch(path, { credentials: "include", ...init })
  if (!response.ok) {
    throw new Error("Admin API error")
  }
  return (await response.json()) as any
}

export default function AdminPage() {
  const [gifts, setGifts] = useState<Gift[]>([])
  const [queue, setQueue] = useState<SponsorSlot[]>([])
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [bans, setBans] = useState<string[]>([])
  const [flags, setFlags] = useState<Array<{ wallet: string; reason: string; createdAt: number }>>([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ id: "", name: "", threshold: 0 })
  const [moderation, setModeration] = useState<string[]>([])
  const [banWalletInput, setBanWalletInput] = useState("")
  const [flagWalletInput, setFlagWalletInput] = useState("")
  const [flagReasonInput, setFlagReasonInput] = useState("")
  const [payouts, setPayouts] = useState<{
    weekStart: number
    qualifiers: number
    totalGlimmer: number
    records: Array<{ wallet: string; amount: number; events: number }>
  } | null>(null)

  const loadAll = async () => {
    setLoading(true)
    try {
      const [giftRes, queueRes, metricsRes, bansRes, flagsRes, payoutRes] = await Promise.all([
        fetchJson("/admin/gifts"),
        fetchJson("/sponsor/queue"),
        fetchJson("/admin/metrics"),
        fetchJson("/admin/bans"),
        fetchJson("/admin/flags"),
        fetchJson("/admin/payouts").catch(() => null),
      ])
      setGifts(giftRes.gifts ?? [])
      setQueue(queueRes.slots ?? [])
      setMetrics(metricsRes ?? null)
      setBans(bansRes.bans ?? [])
      setFlags(flagsRes.flags ?? [])
      setPayouts(payoutRes)
    } catch (error) {
      console.error("Unable to load admin data", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  const pendingSlots = useMemo(() => queue.filter((slot) => slot.status === "PENDING"), [queue])
  const approvedSlots = useMemo(() => queue.filter((slot) => slot.status === "APPROVED"), [queue])

  const handleGiftSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      const payload = { id: form.id || crypto.randomUUID(), name: form.name, threshold: Number(form.threshold) }
      await fetchJson("/admin/gift", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      })
      await loadAll()
      setForm({ id: "", name: "", threshold: 0 })
    } catch (error) {
      console.error("Gift update failed", error)
    }
  }

  const handleModeration = async (action: "approve" | "reject") => {
    if (moderation.length === 0) return
    try {
      await fetchJson(`/sponsor/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slotIds: moderation }),
      })
      setModeration([])
      await loadAll()
    } catch (error) {
      console.error("Moderation failed", error)
    }
  }

  const handleBan = async (wallet: string) => {
    if (!wallet) return
    try {
      await fetchJson("/admin/ban", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wallet }),
      })
      await loadAll()
    } catch (error) {
      console.error("Ban failed", error)
    }
  }

  const handleFlag = async (wallet: string, reason: string) => {
    if (!wallet) return
    try {
      await fetchJson("/admin/flag", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wallet, reason }),
      })
      await loadAll()
    } catch (error) {
      console.error("Flag failed", error)
    }
  }

  return (
    <main className="admin-root">
      <h1>Admin console</h1>
      <p className="muted">Secure panel for gifts, sponsors, bans, and quick metrics.</p>
      <section className="panel">
        <header>
          <h2>Gifts management</h2>
          <p>Create or update gift thresholds.</p>
        </header>
        <form onSubmit={handleGiftSubmit} className="admin-form">
          <label>
            Gift ID
            <input value={form.id} onChange={(event) => setForm((prev) => ({ ...prev, id: event.target.value }))} />
          </label>
          <label>
            Name
            <input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} required />
          </label>
          <label>
            Threshold
            <input
              type="number"
              value={form.threshold}
              onChange={(event) => setForm((prev) => ({ ...prev, threshold: Number(event.target.value) }))}
              min={0}
              required
            />
          </label>
          <button type="submit">Save gift</button>
        </form>
        <div className="grid">
          {gifts.map((gift) => (
            <article key={gift.id}>
              <h3>{gift.name}</h3>
              <p>Threshold: {gift.threshold.toLocaleString()} pts</p>
              <small>ID: {gift.id}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <header>
          <h2>Metrics</h2>
          <p>Snapshot of gift velocity.</p>
        </header>
        <div className="metrics">
          <div>
            <p>Gifts / Day</p>
            <strong>{metrics?.giftsDay ?? "—"}</strong>
          </div>
          <div>
            <p>Gifts / Week</p>
            <strong>{metrics?.giftsWeek ?? "—"}</strong>
          </div>
        </div>
        {payouts && (
          <div className="payouts">
            <p>Weekly Glimmer</p>
            <div className="payout-row">
              <span>Qualifiers</span>
              <strong>{payouts.qualifiers}</strong>
            </div>
            <div className="payout-row">
              <span>Total issued</span>
              <strong>{payouts.totalGlimmer}</strong>
            </div>
            <div className="payout-records">
              {payouts.records?.map((rec) => (
                <div key={rec.wallet} className="payout-card">
                  <strong>{rec.wallet}</strong>
                  <small>
                    {rec.amount} glimmer · {rec.events} events
                  </small>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="panel">
        <header>
          <h2>Sponsor moderation</h2>
          <p>Approve/reject pending slots.</p>
        </header>
        <div className="grid moderator">
          {pendingSlots.length === 0 && <p>No pending slots.</p>}
          {pendingSlots.map((slot) => (
            <label key={slot.id} className="slot-card">
              <input
                type="checkbox"
                value={slot.id}
                checked={moderation.includes(slot.id)}
                onChange={(event) => {
                  const value = event.target.value
                  setModeration((prev) =>
                    event.target.checked ? [...prev, value] : prev.filter((id) => id !== value),
                  )
                }}
              />
              <span>
                <strong>{slot.creative.name}</strong>
                <small>{new Date(slot.startAt).toUTCString()}</small>
                <small>{slot.sponsorId}</small>
              </span>
            </label>
          ))}
        </div>
        {pendingSlots.length > 0 && (
          <div className="admin-actions">
            <button type="button" onClick={() => handleModeration("approve")}>
              Approve selected
            </button>
            <button type="button" onClick={() => handleModeration("reject")}>
              Reject selected
            </button>
          </div>
        )}
        <div className="grid">
          {approvedSlots.map((slot) => (
            <article key={slot.id}>
              <h3>{slot.creative.name}</h3>
              <p>Slot start: {new Date(slot.startAt).toLocaleString()}</p>
              <small>Status: {slot.status}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <header>
          <h2>Bans & flags</h2>
          <p>View or flag suspicious wallets.</p>
        </header>
        <div className="d-flex">
          <div>
            <h3>Bans</h3>
            <ul>
              {bans.map((wallet) => (
                <li key={wallet}>{wallet}</li>
              ))}
            </ul>
            <div className="ban-form">
              <input
                placeholder="wallet to ban"
                value={banWalletInput}
                onChange={(event) => setBanWalletInput(event.target.value)}
              />
              <button
                type="button"
                onClick={() => {
                  handleBan(banWalletInput)
                  setBanWalletInput("")
                }}
              >
                Ban wallet
              </button>
            </div>
          </div>
          <div>
            <h3>Flags</h3>
            <ul>
              {flags.map((flag, index) => (
                <li key={`${flag.wallet}-${index}`}>
                  <strong>{flag.wallet}</strong>
                  <small>{flag.reason}</small>
                </li>
              ))}
            </ul>
            <div className="ban-form">
              <input
                placeholder="wallet to flag"
                value={flagWalletInput}
                onChange={(event) => setFlagWalletInput(event.target.value)}
              />
              <input
                placeholder="reason"
                value={flagReasonInput}
                onChange={(event) => setFlagReasonInput(event.target.value)}
              />
              <button
                type="button"
                onClick={() => {
                  handleFlag(flagWalletInput, flagReasonInput || "suspicious")
                  setFlagWalletInput("")
                  setFlagReasonInput("")
                }}
              >
                Flag wallet
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
