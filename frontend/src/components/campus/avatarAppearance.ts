import { mulberry32 } from './campusLayout'

/**
 * What a given student looks like.
 *
 * Derived entirely from their user id, so the same person looks the same to
 * everybody in the lobby and the same again tomorrow. That matters more than it
 * sounds: an avatar whose hair colour is re-rolled on every render is not a
 * person you can recognise across a quad, and recognising each other is most of
 * what the campus is for.
 *
 * Shirt colour is deliberately *not* chosen here. It comes from the hue the
 * page already derives from the user id and shows next to their name, and
 * keeping the two in step is what lets you pick someone out at distance.
 */

export interface AvatarLook {
  skin: string
  hair: string
  /** 0 short, 1 cropped, 2 tied back. */
  hairStyle: 0 | 1 | 2
  trousers: string
  shoes: string
  /** 0 neutral, 1 smiling, 2 focused. */
  face: 0 | 1 | 2
  /** Overall scale. People are not all one height. */
  height: number
  /** Whether they are carrying a bag. */
  backpack: boolean
}

const SKIN = ['#f7d7be', '#f2c4a8', '#e0a887', '#c68a63', '#a06840', '#7a4a2b', '#5c3620']
const HAIR = ['#1e1712', '#33241c', '#4d3524', '#6b4a2c', '#8d6a3f', '#2f2f33', '#6d4550']
const TROUSERS = ['#2f3a4a', '#3a3f4a', '#4a4238', '#28323f', '#3c3546', '#4f4a42']
const SHOES = ['#22262c', '#3a2f28', '#4a4a4a', '#1d2b3a', '#5c5248']

/** Turns any user id — number or string — into a stable numeric seed. */
export function avatarSeed(id: string | number): number {
  const text = String(id)
  let hash = 2166136261
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function avatarLook(id: string | number): AvatarLook {
  const random = mulberry32(avatarSeed(id))

  // Drawn in a fixed order: adding a field at the end must not reshuffle
  // everyone's hair.
  const skin = SKIN[Math.floor(random() * SKIN.length)]
  const hair = HAIR[Math.floor(random() * HAIR.length)]
  const hairStyle = Math.floor(random() * 3) as 0 | 1 | 2
  const trousers = TROUSERS[Math.floor(random() * TROUSERS.length)]
  const shoes = SHOES[Math.floor(random() * SHOES.length)]
  const face = Math.floor(random() * 3) as 0 | 1 | 2
  // ±7%. Enough to read as a crowd of individuals, not enough to make anyone
  // a giant or lose them behind a desk.
  const height = Math.round((0.93 + random() * 0.14) * 1000) / 1000
  const backpack = random() > 0.35

  return { skin, hair, hairStyle, trousers, shoes, face, height, backpack }
}
