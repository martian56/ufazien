/**
 * What to say about a player above their head.
 *
 * Three things the campus knew but never showed. Chat was a DOM panel with no
 * connection to the world, so a room full of people talking looked silent.
 * Proximity voice had no visible sign at all — you could hear somebody and have
 * no idea which of the twenty students it was. And a nameplate said only a name,
 * when the interesting part is usually what the person is doing.
 *
 * Pure, so the timing rules can be tested without a canvas or a clock.
 */

import type { Activity } from './avatarPose'
import { CAMPUS_BUILDINGS } from './campusLayout'

/** How long a chat message hangs over its author's head, in milliseconds. */
export const BUBBLE_MS = 7000

/** Longest bubble text. Past this it is truncated rather than wrapped forever. */
export const BUBBLE_MAX = 90

export interface ChatLike {
  user_id: string | number
  message: string
  timestamp?: string
}

/**
 * The message to show over a player, if any.
 *
 * Only their most recent, and only while it is fresh. A bubble that never
 * expires turns a busy quad into a wall of text, and showing every message
 * would stack them into the sky.
 */
export function bubbleFor(
  userId: string | number,
  messages: readonly ChatLike[],
  now: number,
  windowMs = BUBBLE_MS,
): string | null {
  // Backwards: the last matching message wins, and stopping at the first hit
  // avoids walking a fifty-message backlog for every player every frame.
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]
    // Loose equality on purpose: ids arrive as numbers from the socket and as
    // strings from the REST snapshot, and a bubble that never matches is a
    // feature that silently does nothing.
    if (String(message.user_id) !== String(userId)) continue

    const at = message.timestamp ? Date.parse(message.timestamp) : Number.NaN
    // A message with no usable timestamp is treated as current rather than
    // dropped: better a bubble that lingers than one that never appears.
    if (Number.isFinite(at) && now - at > windowMs) return null
    if (Number.isFinite(at) && at > now + windowMs) return null

    const text = message.message?.trim()
    if (!text) return null
    return text.length > BUBBLE_MAX ? `${text.slice(0, BUBBLE_MAX - 1)}…` : text
  }

  return null
}

/**
 * The line under a player's name.
 *
 * Null when there is nothing worth saying, so a student walking across the quad
 * gets a name and no clutter.
 */
export function statusFor({
  activity,
  currentRoom,
  isPresenting = false,
}: {
  activity?: string
  currentRoom?: string | null
  isPresenting?: boolean
}): string | null {
  if (isPresenting) return 'presenting'

  switch (activity as Activity) {
    case 'hand_raised':
      return 'hand up'
    case 'waving':
      return 'waving'
    case 'clapping':
      return 'clapping'
    case 'sitting': {
      const room = buildingName(currentRoom)
      return room ? `sitting in the ${room}` : 'sitting'
    }
    default: {
      const room = buildingName(currentRoom)
      return room ? `in the ${room}` : null
    }
  }
}

/**
 * The building a `current_room` id refers to.
 *
 * `current_room` is the building's numeric id as a string — deliberately not
 * its name, because two buildings could be given the same name and would then
 * share a projector.
 */
export function buildingName(currentRoom?: string | null): string | null {
  if (!currentRoom) return null
  const building = CAMPUS_BUILDINGS.find((b) => String(b.id) === String(currentRoom))
  if (!building) return null
  // "in the UFAZ Main Building" reads better without the article doubled up.
  return building.name.replace(/^The\s+/i, '')
}

/**
 * Whether a participant identity refers to a given player.
 *
 * LiveKit identities are the user id as a string; the campus keys players by
 * number. Comparing them without normalising means the speaking ring never
 * appears on anybody.
 */
export function isSameParticipant(
  identity: string | null | undefined,
  userId: string | number,
): boolean {
  if (identity === undefined || identity === null) return false
  // LiveKit identities are minted as `user-<id>`. Comparing them raw means the
  // speaking ring and the presenter badge never match anybody at all.
  return String(identity).replace(/^user-/, '') === String(userId)
}

export function isSpeaking(
  userId: string | number,
  participants: readonly { identity: string; speaking: boolean }[],
): boolean {
  return participants.some((p) => p.speaking && isSameParticipant(p.identity, userId))
}
