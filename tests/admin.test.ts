import { describe, expect, it } from "vitest"
import { parseAdminAllowlist, isAdminWallet } from "../src/admin/authz"
import { AdminStore } from "../src/admin/store"

describe("Admin authz + store", () => {
  it("matches allowlist by wallet", () => {
    const allow = parseAdminAllowlist("WALLET1, wallet2")
    expect(isAdminWallet("wallet1", allow)).toBe(true)
    expect(isAdminWallet("wallet3", allow)).toBe(false)
  })

  it("upserts gifts and tracks bans/flags", () => {
    const store = new AdminStore()
    store.upsertGift({ id: "giftA", name: "Gift A", threshold: 500 })
    store.upsertGift({ id: "giftA", name: "Gift A2", threshold: 600 })
    const gifts = store.listGifts()
    expect(gifts[0].threshold).toBe(600)

    store.ban("wallet-x")
    expect(store.listBans()).toContain("wallet-x")

    const flag = store.flag("wallet-y", "suspicious", 123)
    expect(flag.wallet).toBe("wallet-y")
    expect(store.listFlags().length).toBe(1)
  })
})
