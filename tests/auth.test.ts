import { describe, expect, it } from "vitest"
import nacl from "tweetnacl"
import bs58 from "bs58"
import { AuthService, buildMessageForNonce, nonceTtlMs } from "../src/auth/service"

const makeKeypair = () => nacl.sign.keyPair()

describe("AuthService", () => {
  it("verifies signatures and rejects replay", () => {
    const service = new AuthService()
    const now = Date.now()
    const kp = makeKeypair()
    const wallet = bs58.encode(kp.publicKey)
    const nonce = service.issueNonce(wallet, now)
    const message = new TextEncoder().encode(buildMessageForNonce(nonce.nonce))
    const signature = nacl.sign.detached(message, kp.secretKey)
    const sigBase58 = bs58.encode(signature)

    const first = service.verifySignature(wallet, nonce.nonce, sigBase58, now + 1000)
    expect(first.ok).toBe(true)
    expect(first.ok && first.session.username.length).toBeGreaterThan(0)

    const replay = service.verifySignature(wallet, nonce.nonce, sigBase58, now + 2000)
    expect(replay.ok).toBe(false)
  })

  it("rejects expired nonce", () => {
    const service = new AuthService()
    const now = Date.now()
    const kp = makeKeypair()
    const wallet = bs58.encode(kp.publicKey)
    const nonce = service.issueNonce(wallet, now)
    const message = new TextEncoder().encode(buildMessageForNonce(nonce.nonce))
    const signature = nacl.sign.detached(message, kp.secretKey)
    const sigBase58 = bs58.encode(signature)

    const tooLate = now + nonceTtlMs + 1000
    const result = service.verifySignature(wallet, nonce.nonce, sigBase58, tooLate)
    expect(result.ok).toBe(false)
  })
})
