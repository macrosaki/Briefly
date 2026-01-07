import { parseAdminAllowlist, isAdminWallet } from "./authz"
import { AdminStore } from "./store"

interface Env {
  ADMIN_WALLETS?: string
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } })

export class AdminPanel implements DurableObject {
  private store = new AdminStore()
  private allowlist: Set<string>

  constructor(private readonly state: DurableObjectState, private readonly env: Env) {
    this.allowlist = parseAdminAllowlist(env.ADMIN_WALLETS)
  }

  private isAuthorized(wallet: string | undefined) {
    return isAdminWallet(wallet, this.allowlist)
  }

  async fetch(request: Request) {
    const url = new URL(request.url)
    const wallet = request.headers.get("x-admin-wallet") ?? ""
    if (!this.isAuthorized(wallet)) {
      return json({ error: "forbidden" }, 403)
    }

    if (request.method === "PUT" && url.pathname === "/admin/gift") {
      const { id, name, threshold } = (await request.json()) as { id: string; name: string; threshold: number }
      const gifts = this.store.upsertGift({ id, name, threshold })
      return json({ ok: true, gifts })
    }

    if (request.method === "GET" && url.pathname === "/admin/gifts") {
      return json({ gifts: this.store.listGifts() })
    }

    if (request.method === "POST" && url.pathname === "/admin/ban") {
      const { wallet: banWallet } = (await request.json()) as { wallet: string }
      const bans = this.store.ban(banWallet)
      return json({ ok: true, bans })
    }

    if (request.method === "GET" && url.pathname === "/admin/bans") {
      return json({ bans: this.store.listBans() })
    }

    if (request.method === "POST" && url.pathname === "/admin/flag") {
      const { wallet: flagWallet, reason } = (await request.json()) as { wallet: string; reason: string }
      const record = this.store.flag(flagWallet, reason ?? "suspicious", Date.now())
      return json({ ok: true, record })
    }

    if (request.method === "GET" && url.pathname === "/admin/flags") {
      return json({ flags: this.store.listFlags() })
    }

    if (request.method === "GET" && url.pathname === "/admin/metrics") {
      return json(this.store.metrics())
    }

    return json({ error: "not_found" }, 404)
  }
}
