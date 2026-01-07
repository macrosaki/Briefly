export interface NonceRecord {
  nonce: string
  wallet: string
  expiresAt: number
  used: boolean
}

export interface SessionRecord {
  token: string
  wallet: string
  username: string
  avatar: string
  expiresAt: number
}

export interface Profile {
  wallet: string
  username: string
  avatar: string
  points: number
  glimmer: number
  wonGifts: number
}
