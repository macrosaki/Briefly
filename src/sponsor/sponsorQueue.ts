import { SponsorQueue } from "./queue"
import { Creative } from "./types"

interface Env {
  SPONSOR_APPROVAL_REQUIRED?: string
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } })

export class SponsorQueueDO implements DurableObject {
  private queue = new SponsorQueue()

  constructor(private readonly state: DurableObjectState, private readonly env: Env) {}

  private rateLimit(key: string, limitMs = 1000) {
    const last = this.state.get(key)
    const now = Date.now()
    if (typeof last === "number" && now - last < limitMs) return false
    this.state.put(key, now)
    return true
  }

  async fetch(request: Request) {
    const url = new URL(request.url)
    if (!this.rateLimit(url.pathname)) return json({ error: "rate_limited" }, 429)

    if (request.method === "POST" && url.pathname === "/sponsor/purchase") {
      const { sponsorId, name, link, image, pack } = (await request.json()) as {
        sponsorId: string
        name: string
        link: string
        image: string
        pack: 1 | 3 | 5
      }
      if (!sponsorId || !name || !link || !image) return json({ error: "missing_fields" }, 400)
      const creative: Creative = { name, link, image, version: Date.now() }
      const result = this.queue.purchase(sponsorId, creative, pack ?? 1, Date.now())
      if (!result) return json({ error: "rejected" }, 400)
      await this.state.storage.put("slots", this.queue.allSlots())
      return json(result)
    }

    if (request.method === "POST" && url.pathname === "/sponsor/approve") {
      const { slotIds } = (await request.json()) as { slotIds: string[] }
      const updated = this.queue.approve(slotIds ?? [], Date.now())
      await this.state.storage.put("slots", this.queue.allSlots())
      return json({ ok: true, updated })
    }

    if (request.method === "POST" && url.pathname === "/sponsor/reject") {
      const { slotIds } = (await request.json()) as { slotIds: string[] }
      const updated = this.queue.reject(slotIds ?? [])
      await this.state.storage.put("slots", this.queue.allSlots())
      return json({ ok: true, updated })
    }

    if (request.method === "POST" && url.pathname === "/sponsor/impression") {
      const { slotId, wallet } = (await request.json()) as { slotId: string; wallet: string }
      if (slotId && wallet) {
        this.queue.recordImpression(slotId, wallet)
      }
      return json({ ok: true })
    }

    if (request.method === "GET" && url.pathname.startsWith("/r/s/")) {
      const slotId = url.pathname.split("/").pop() ?? ""
      if (slotId) {
        this.queue.recordClick(slotId)
        const slot = this.queue.findSlot(slotId)
        if (slot?.creative?.link) {
          return new Response(null, { status: 302, headers: { Location: slot.creative.link } })
        }
      }
      return new Response("Not found", { status: 404 })
    }

    if (request.method === "GET" && url.pathname === "/sponsor/dashboard") {
      const sponsorId = url.searchParams.get("sponsorId") ?? ""
      const slots = this.queue.dashboard(sponsorId)
      return json({ slots })
    }

    if (request.method === "GET" && url.pathname === "/sponsor/queue") {
      return json({ slots: this.queue.allSlots() })
    }

    return json({ error: "not_found" }, 404)
  }
}
