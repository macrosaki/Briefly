const adjectives = ["orbit", "solar", "neon", "prism", "lunar", "stellar", "cosmic", "vivid", "pulse", "ember"]
const nouns = ["echo", "waltz", "glow", "halo", "nova", "drift", "flux", "spark", "flare", "pulse"]

export const randomUsername = (seed: number): string => {
  const adj = adjectives[seed % adjectives.length]
  const noun = nouns[(seed * 7 + 3) % nouns.length]
  return `${adj}-${noun}`
}
