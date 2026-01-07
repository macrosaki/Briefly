import nacl from "tweetnacl"
import bs58 from "bs58"
import { randomUsername } from "./username"
import { NonceRecord, Profile, SessionRecord } from "./types"

const NONCE_TTL_MS = 5 * 60 * 1000
const SESSION_TTL_MS = 24 * 60 * 60 * 1000
const MESSAGE_PREFIX = "Briefly login nonce:"
const AVATARS = ["glow", "orbit", "pulse", "halo"]

const randomToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return Buffer.from(bytes).toString("base64url")
}

export class AuthService {
  private nonces: Map<string, NonceRecord> = new Map()
  private sessions: Map<string, SessionRecord> = new Map()
  private profiles: Map<string, Profile> = new Map()

  issueNonce(wallet: string, now: number): NonceRecord {
    const bytes = crypto.getRandomValues(new Uint8Array(16))
    const nonce = Buffer.from(bytes).toString("base64url")
    const record: NonceRecord = {
      nonce,
      wallet,
      expiresAt: now + NONCE_TTL_MS,
      used: false,
    }
    this.nonces.set(nonce, record)
    return record
  }

  private cleanExpired(now: number) {
    for (const [key, value] of this.nonces.entries()) {
      if (value.expiresAt < now || value.used) {
        this.nonces.delete(key)
      }
    }
    for (const [token, session] of this.sessions.entries()) {
      if (session.expiresAt < now) {
        this.sessions.delete(token)
      }
    }
  }

  verifySignature(wallet: string, nonce: string, signatureBase58: string, now: number) {
    this.cleanExpired(now)
    const record = this.nonces.get(nonce)
    if (!record || record.wallet !== wallet || record.used || record.expiresAt < now) {
      return { ok: false as const, reason: "invalid_nonce" }
    }

    const message = new TextEncoder().encode(`${MESSAGE_PREFIX} ${nonce}`)
    const signature = bs58.decode(signatureBase58)
    let publicKey: Uint8Array
    try {
      publicKey = bs58.decode(wallet)
    } catch {
      return { ok: false as const, reason: "bad_wallet" }
    }

    const valid = nacl.sign.detached.verify(message, signature, publicKey)
    if (!valid) {
      return { ok: false as const, reason: "bad_signature" }
    }

    record.used = true
    this.nonces.set(nonce, record)
    const profile = this.ensureProfile(wallet)
    const token = randomToken()
    const session: SessionRecord = {
      token,
      wallet,
      username: profile.username,
      avatar: profile.avatar,
      expiresAt: now + SESSION_TTL_MS,
    }
    this.sessions.set(token, session)
    return { ok: true as const, session }
  }

  private ensureProfile(wallet: string): Profile {
    const existing = this.profiles.get(wallet)
    if (existing) return existing
    const username = randomUsername(wallet.length * 17)
    const avatar = AVATARS[wallet.length % AVATARS.length]
    const profile: Profile = {
      wallet,
      username,
      avatar,
      points: 6200,
      glimmer: 18,
      wonGifts: 5,
    }
    this.profiles.set(wallet, profile)
    return profile
  }

  getSession(token: string, now: number): SessionRecord | null {
    this.cleanExpired(now)
    const session = this.sessions.get(token)
    if (!session) return null
    if (session.expiresAt < now) {
      this.sessions.delete(token)
      return null
    }
    return session
  }

  getProfile(token: string, now: number): Profile | null {
    const session = this.getSession(token, now)
    if (!session) return null
    const profile = this.ensureProfile(session.wallet)
    return profile
  }
}

export const buildMessageForNonce = (nonce: string) => `${MESSAGE_PREFIX} ${nonce}`
export const nonceTtlMs = NONCE_TTL_MS
export const sessionTtlMs = SESSION_TTL_MS
