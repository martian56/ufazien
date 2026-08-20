/**
 * The bodies a player can wear in the campus.
 *
 * Declared here and, in the same order, in `backend/game/characters.py` — the
 * server decides what it is willing to store, and a picker offering something
 * the server refuses is a player who looks like nobody. `CampusCharacterTests`
 * reads this file and fails if the two lists drift apart.
 *
 * Everything here is Quaternius's *Ultimate Modular Characters*, CC0, built by
 * `scripts/build-avatars.mjs`. They share one skeleton and the same six clips,
 * which is why they can be swapped freely: a body is a change of mesh, not a
 * change of animation.
 *
 * ## Adding one
 *
 * Run the character through the build script, drop the `.glb` in
 * `public/avatars/`, and add an entry here and in `characters.py`. Nothing else
 * knows the list — the picker, the peers and the preview all read it.
 */
export interface CampusCharacter {
  /** Stored on the user. Kebab-case, and the server's list must match. */
  id: string
  /** What the picker calls it. */
  label: string
  /** The built asset, under `public/`. */
  file: string
}

export const AVATAR_CATALOGUE: readonly CampusCharacter[] = [
  { id: 'casual-hoodie', label: 'Hoodie', file: '/avatars/Casual_Hoodie.glb' },
  { id: 'casual-2', label: 'Casual', file: '/avatars/Casual_2.glb' },
  { id: 'suit', label: 'Suit', file: '/avatars/Suit.glb' },
]

/** Means "never chosen": keep deriving this player's body from their id. */
export const UNCHOSEN = ''

/** The file for a chosen id, or null when nothing is chosen or it is unknown. */
export function characterFile(id: string | null | undefined): string | null {
  if (!id) return null
  return AVATAR_CATALOGUE.find((entry) => entry.id === id)?.file ?? null
}

/**
 * Picks a body from a seed of either shape, deterministically.
 *
 * This is the campus's original rule, moved here from `GltfCharacter` and
 * unchanged to the character. It has to be unchanged: it is what decides the
 * appearance of every player who has not chosen one, so any other arithmetic —
 * including a tidier one — would restyle all of them at once. `>>> 0` instead
 * of `| 0` is enough to do it, which is how I nearly did.
 */
export function packIndex(variant: number | string): number {
  if (typeof variant === 'number' && Number.isFinite(variant)) {
    return Math.abs(Math.trunc(variant)) % AVATAR_CATALOGUE.length
  }
  let hash = 0
  for (const character of String(variant)) {
    hash = (hash * 31 + character.charCodeAt(0)) | 0
  }
  return Math.abs(hash) % AVATAR_CATALOGUE.length
}

/**
 * A stable body for somebody who has never chosen.
 *
 * The campus has always derived appearance from the player's id, so a given
 * person wears the same thing every session. That has to keep working: making
 * a choice the only way to have a body would restyle everybody who has ever
 * played, the first time this shipped.
 */
export function characterForSeed(seed: number | string): CampusCharacter {
  return AVATAR_CATALOGUE[packIndex(seed)]
}

/** What to draw for a player: their choice when they have one, else their id. */
export function characterFor(
  chosen: string | null | undefined,
  seed: number | string,
): CampusCharacter {
  const id = chosen ?? UNCHOSEN
  const picked = AVATAR_CATALOGUE.find((entry) => entry.id === id)
  return picked ?? characterForSeed(seed)
}
