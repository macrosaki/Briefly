// Lightweight FNV-1a 32-bit hash for wallet identifiers.
export const hashWallet = (input: string): number => {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  // Force unsigned 32-bit
  return hash >>> 0
}
