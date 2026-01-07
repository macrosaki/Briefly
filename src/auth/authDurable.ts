import { AuthService, buildMessageForNonce } from "./service"
import { NonceRecord, Profile } from "./types"

interface Env {
  SESSION_SECRET?: string
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  })

export class AuthDurable implements DurableObject {
  private service = new AuthService()

  constructor(private readonly state: DurableObjectState, private readonly env: Env) {}

  private cookie(name: string, value: string, ttlMs: number) {
    const expires = new Date(Date.now() + ttlMs).toUTCString()
    return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(
      ttlMs / 1000,
    )}; Expires=${expires}; Secure`
  }

  async fetch(request: Request) {
    const url = new URL(request.url)

    if (request.method === "POST" && url.pathname === "/auth/nonce") {
      const { wallet } = (await request.json()) as { wallet: string }
      if (!wallet) return json({ error: "wallet required" }, 400)
      const record: NonceRecord = this.service.issueNonce(wallet, Date.now())
      return json({ nonce: record.nonce, message: buildMessageForNonce(record.nonce), expiresAt: record.expiresAt })
    }

    if (request.method === "POST" && url.pathname === "/auth/verify") {
      const { wallet, nonce, signature } = (await request.json()) as {
        wallet: string
        nonce: string
        signature: string
      }
      const result = this.service.verifySignature(wallet, nonce, signature, Date.now())
      if (!result.ok) return json({ ok: false, reason: result.reason }, 401)
      const cookie = this.cookie("session", result.session.token, result.session.expiresAt - Date.now())
      return new Response(
        JSON.stringify({
          ok: true,
          username: result.session.username,
          avatar: result.session.avatar,
          expiresAt: result.session.expiresAt,
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
            "set-cookie": cookie,
          },
        },
      )
    }

    if (request.method === "GET" && url.pathname === "/profile") {
      const token = request.headers.get("cookie")?.match(/session=([^;]+)/)?.[1] ?? url.searchParams.get("token") ?? ""
      if (!token) return json({ error: "no session" }, 401)
      const profile = this.service.getProfile(token, Date.now())
      if (!profile) return json({ error: "invalid session" }, 401)
      const payload: Profile = profile
      return json(payload)
    }

    if (request.method === "GET" && url.pathname === "/auth/session") {
      const token = request.headers.get("cookie")?.match(/session=([^;]+)/)?.[1] ?? url.searchParams.get("token") ?? ""
      if (!token) return json({ error: "no session" }, 401)
      const session = this.service.getSession(token, Date.now())
      if (!session) return json({ error: "invalid session" }, 401)
      return json({ wallet: session.wallet, username: session.username })
    }

    return json({ error: "not found" }, 404)
  }
}
