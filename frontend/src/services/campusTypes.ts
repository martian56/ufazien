/**
 * Shapes the campus simulator API returns.
 *
 * Field names mirror game/serializers.py. Note what the user serializer there
 * sends: an id and the two name parts, and deliberately no email and no
 * username, because a lobby's member list is visible to everyone in it.
 */

export interface CampusUser {
  id: number
  first_name: string
  last_name: string
}

export interface LobbyMember {
  user: CampusUser
  joined_at: string
  is_online: boolean
  last_seen: string
}

export interface StudyRoom {
  id: number
  name: string
  x: number
  y: number
  width: number
  height: number
  max_capacity: number
  presenter: CampusUser | null
  is_presentation_active: boolean
  current_occupants_count: number
  is_full: boolean
}

/**
 * A lobby.
 *
 * The list endpoint uses LobbyListSerializer, which omits `members` and
 * `study_rooms`; the detail endpoint includes them. One type with those two
 * optional, rather than two that drift.
 */
export interface Lobby {
  id: string
  name: string
  description: string | null
  host: CampusUser
  is_private: boolean
  max_players: number
  is_active?: boolean
  created_at: string
  updated_at?: string
  current_players_count: number
  is_full: boolean
  members?: LobbyMember[]
  study_rooms?: StudyRoom[]
  /** Added by the list view, not the serializer: whether this user saved it. */
  is_saved?: boolean
}

export interface SavedLobby {
  lobby: Lobby
  saved_at: string
}

export interface PlayerPosition {
  user: CampusUser
  x: number
  y: number
  direction: string
  is_moving: boolean
  current_room: number | null
  last_updated: string
}

export interface CampusChatMessage {
  id: number
  user: CampusUser
  message: string
  room: number | null
  created_at: string
}

export interface LobbyStats {
  total_lobbies?: number
  active_lobbies?: number
  total_players?: number
  your_lobbies?: number
}

/** Filters the lobby list accepts as query parameters. */
export interface LobbyListParams {
  page?: number
  page_size?: number
  ordering?: string
  search?: string
  is_private?: boolean
  min_players?: number
  max_players?: number
}

export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

/** A member's display name, which is all the API gives us to work with. */
export function campusUserName(user: CampusUser | null | undefined): string {
  if (!user) return 'Someone'
  const full = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim()
  return full || `Student ${user.id}`
}
