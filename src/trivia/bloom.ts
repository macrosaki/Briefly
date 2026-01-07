const BITS_PER_BYTE = 8
const DEFAULT_BITS = 65_536 // 8 KB
const HASH_SEEDS = [0x27d4eb2d, 0x165667b1, 0x85ebca6b]

export class BloomSeenTracker {
  private readonly bits: Uint8Array
  private readonly sizeBits: number

  constructor(sizeBits: number = DEFAULT_BITS) {
    this.sizeBits = sizeBits
    this.bits = new Uint8Array(Math.ceil(sizeBits / BITS_PER_BYTE))
  }

  private mix(value: number, seed: number): number {
    let v = value + seed
    v ^= v >>> 15
    v = Math.imul(v, seed | 1)
    v ^= v + (v << 7)
    return v >>> 0
  }

  private bitIndex(value: number, seed: number): number {
    return this.mix(value, seed) % this.sizeBits
  }

  private testBit(index: number): boolean {
    const byteIndex = index >> 3
    const bitMask = 1 << (index & 7)
    return (this.bits[byteIndex] & bitMask) !== 0
  }

  private setBit(index: number) {
    const byteIndex = index >> 3
    const bitMask = 1 << (index & 7)
    this.bits[byteIndex] |= bitMask
  }

  /**
   * Returns true if the value was likely seen (Bloom false-positives possible).
   * Always sets the relevant bits so subsequent calls remain consistent.
   */
  seenOrAdd(value: number): boolean {
    const indexes = HASH_SEEDS.map((seed) => this.bitIndex(value, seed))
    const alreadySeen = indexes.every((idx) => this.testBit(idx))
    indexes.forEach((idx) => this.setBit(idx))
    return alreadySeen
  }
}
