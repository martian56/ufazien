/**
 * Who is sitting where.
 *
 * Kept apart from `playerPositions` on purpose. Seats are claimed on the server
 * and announced in their own message, while positions are a stream the client
 * sends ten times a second — folding one into the other made a seat as
 * short-lived as the last frame that happened to carry it, and a chair that
 * looks free is a chair the client offers and the server then refuses, which
 * reads as the key not working.
 *
 * Pure, and identity-stable: every one of these returns the map it was given
 * when nothing actually changed, so a position frame that says the same thing
 * as the last one does not re-render the campus.
 */

/** Seat id held by each player, keyed by user id. Absent means standing. */
export type SeatMap = ReadonlyMap<string | number, string>

export const NO_SEATS: SeatMap = new Map()

/**
 * Record where a player is sitting, or that they are not.
 *
 * Deliberately does not require the player to be known already. Somebody can
 * sit down before their first position frame reaches us, and dropping that
 * update leaves their chair looking free to everybody else in the room.
 */
export function withSeat(
  seats: SeatMap,
  userId: string | number,
  seat: string | null | undefined,
): SeatMap {
  const held = seats.get(userId) ?? null
  // An empty string is not a seat: the server rejects one, and treating it as
  // an id would put a nameless chair in the taken set forever.
  const next = seat || null
  if (held === next) return seats

  const copy = new Map(seats)
  if (next === null) copy.delete(userId)
  else copy.set(userId, next)
  return copy
}

/** Forget a player entirely — they left the lobby, so their chair is free. */
export function withoutPlayer(seats: SeatMap, userId: string | number): SeatMap {
  if (!seats.has(userId)) return seats
  const copy = new Map(seats)
  copy.delete(userId)
  return copy
}

/** The seat ids that are spoken for, for `nearestSeat` to skip. */
export function takenSeatIds(seats: SeatMap): Set<string> {
  return new Set(seats.values())
}

/**
 * The seat a player still holds after the server refuses one.
 *
 * Only the chair the refusal is about. Clearing unconditionally stands a player
 * up locally while the server still has them seated somewhere else — and no
 * further `seat_update` is coming to correct that, so their real chair stays
 * claimed by an avatar that appears to be standing next to it. Reachable by
 * pressing the key twice at two chairs before the first answer arrives.
 */
export function seatAfterDenial(
  held: string | null,
  denied: string | null | undefined,
): string | null {
  // A refusal that does not say which seat cannot be attributed. The server
  // sends one only for a request that named no valid seat, which is never a
  // request that could have been granted, so whatever is held survives it.
  if (!denied) return held
  return held === denied ? null : held
}

/**
 * The seating in a `lobby_state` snapshot.
 *
 * Excludes the reader: their own seat is `ownSeat`, and having it in the taken
 * set as well would make the chair they are sitting in unofferable to them
 * after they stand up until the next frame arrives.
 */
export function seatsFromSnapshot(
  positions: readonly { user_id: string | number; seat?: string | null }[],
  selfId: string | number | null | undefined,
): SeatMap {
  const seats = new Map<string | number, string>()
  for (const position of positions) {
    if (selfId !== null && selfId !== undefined && position.user_id === selfId) continue
    if (position.seat) seats.set(position.user_id, position.seat)
  }
  return seats
}
