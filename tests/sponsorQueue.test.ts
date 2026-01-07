import { describe, expect, it } from "vitest"
import { SponsorQueue } from "../src/sponsor/queue"

describe("SponsorQueue rules", () => {
  const now = 1_700_000_000_000

  it("enforces queue cap", () => {
    const queue = new SponsorQueue({ queueCap: 2 })
    const creative = { name: "Orbit", link: "https://example.com", image: "img", version: 1 }
    const first = queue.purchase("s1", creative, 1, now)
    const second = queue.purchase("s2", creative, 1, now + 1000)
    expect(first).not.toBeNull()
    expect(second).not.toBeNull()
    const third = queue.purchase("s3", creative, 1, now + 2000)
    expect(third).toBeNull()
  })

  it("enforces rolling throttle of 50 minutes per 6 hours", () => {
    const queue = new SponsorQueue()
    const creative = { name: "Glow", link: "https://example.com", image: "img", version: 1 }
    const pack = queue.purchase("sponsorA", creative, 5 as 1 | 3 | 5, now)
    expect(pack).not.toBeNull()
    const overflow = queue.purchase("sponsorA", creative, 1, now + 1000)
    expect(overflow).toBeNull()
  })

  it("computes ETA and aligns slots to 10-minute cadence", () => {
    const queue = new SponsorQueue()
    const creative = { name: "Nova", link: "https://example.com", image: "img", version: 1 }
    const result = queue.purchase("sponsorB", creative, 1, now + 12345)
    expect(result).not.toBeNull()
    if (!result) return
    expect(result.etaMs).toBeGreaterThanOrEqual(0)
    expect(result.slots[0].startAt % (10 * 60 * 1000)).toBe(0)
  })
})
