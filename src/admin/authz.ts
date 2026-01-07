export const parseAdminAllowlist = (envValue: string | undefined): Set<string> => {
  if (!envValue) return new Set()
  return new Set(envValue.split(",").map((w) => w.trim().toLowerCase()).filter(Boolean))
}

export const isAdminWallet = (wallet: string | undefined, allowlist: Set<string>): boolean => {
  if (!wallet) return false
  return allowlist.has(wallet.toLowerCase())
}
