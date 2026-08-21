import { useCallback, useEffect, useRef, useState } from "react"
import { CampusVoice, campusHostApi, type Participant } from "../services/campusVoice"
import { errorMessage } from "../lib/api/errors"
import { inSameRoom } from "../components/campus/playerStatus"

/**
 * Binds LiveKit voice to the campus lobby.
 *
 * Positions come from the game's own WebSocket, so voice needs no extra
 * transport: it just re-points the Web Audio listener and each remote panner
 * whenever the game says someone moved.
 */
interface VoicePosition {
  x?: number
  y?: number
  elevation?: number
  current_room?: string | null
}

export interface CampusVoiceOptions {
  lobbyId?: string | null
  userPosition?: VoicePosition | null
  playerPositions?: Map<string | number, VoicePosition> | Record<string, VoicePosition> | null
  enabled?: boolean
}

export interface ActiveScreenShare {
  identity?: string
  element: HTMLVideoElement
  isLocal: boolean
}

export function useCampusVoice({ lobbyId, userPosition, playerPositions, enabled = true }: CampusVoiceOptions) {
  const voiceRef = useRef<CampusVoice | null>(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [micEnabled, setMicEnabled] = useState(false)
  const [screenShare, setScreenShare] = useState<ActiveScreenShare | null>(null)
  const [permissions, setPermissions] = useState<any>(null)

  // Connect once per lobby.
  useEffect(() => {
    if (!lobbyId || !enabled) return

    const voice = new CampusVoice()
    voiceRef.current = voice
    let cancelled = false

    voice.onParticipantsChanged = (list) => {
      if (!cancelled) setParticipants(list)
    }
    // Tracked per identity rather than as a single slot: the presenter's own
    // share and a remote one arrive through the same callback, and one ending
    // used to clear the other.
    const shares = new Map()
    voice.onScreenShare = ({ identity, element, active, isLocal }) => {
      if (active) shares.set(identity, { identity, element, isLocal: Boolean(isLocal) })
      else shares.delete(identity)
      if (!cancelled) setScreenShare(shares.values().next().value || null)
    }

    voice
      .connect(lobbyId)
      .then(() => {
        if (cancelled) return
        setConnected(true)
        setMicEnabled(voice.microphoneEnabled)
        setError(null)
      })
      .catch((err) => {
        if (!cancelled) {
          // `errorMessage` unwraps whatever was thrown; reading
          // `err.response.data` is the axios shape, and this goes through the
          // fetch client, which throws `ApiError`. So the first term was always
          // undefined and users saw `err.message` — the bare "503 Service
          // Unavailable" — while the server was sending a perfectly clear
          // "LIVEKIT_API_KEY, LIVEKIT_API_SECRET and LIVEKIT_URL must be set."
          //
          // CLAUDE.md warns about exactly this: the client returns parsed JSON,
          // not an axios `{data}` envelope.
          setError(errorMessage(err, "Voice unavailable"))
        }
      })

    return () => {
      cancelled = true
      voice.disconnect().catch(() => {})
      voiceRef.current = null
      setConnected(false)
    }
  }, [lobbyId, enabled])

  // Move the listener with the local player.
  useEffect(() => {
    if (!connected || !userPosition) return
    voiceRef.current?.setLocalPosition({
      x: userPosition.x ?? 0,
      y: userPosition.y ?? 0,
      elevation: userPosition.elevation ?? 0,
    })
  }, [connected, userPosition?.x, userPosition?.y, userPosition?.elevation])

  /**
   * Move each remote voice with its player, and silence anybody in another room.
   *
   * The room is not a refinement of the distance — it is the thing distance
   * cannot express. Every interior is built at the origin and shares one
   * coordinate frame with the outdoors, so the library on the fourth floor and
   * the cafeteria on the second are at the same coordinates. At a full-volume
   * radius of six world metres in rooms forty metres across, that meant
   * everybody in the building heard everybody else at full volume, and
   * somebody standing on the quad near the origin heard all of them.
   *
   * The visual layer has always known this — `visibleAvatars` filters by
   * `inSameRoom`, with a comment saying exactly why. The audio layer never got
   * the same treatment, so you could hear somebody you could not see and who
   * was not there.
   *
   * It calls the same function rather than repeating the comparison, so the
   * two cannot drift: whoever you can see is exactly whoever you can hear.
   */
  const myRoom = userPosition?.current_room ?? null
  useEffect(() => {
    if (!connected || !playerPositions) return
    const entries = playerPositions instanceof Map
      ? [...playerPositions.entries()]
      : Object.entries(playerPositions || {})

    for (const [userId, position] of entries) {
      if (!position) continue
      voiceRef.current?.setRemotePosition(
        userId,
        {
          x: position.x ?? 0,
          y: position.y ?? 0,
          elevation: position.elevation ?? 0,
        },
        inSameRoom(position.current_room, myRoom),
      )
    }
  }, [connected, playerPositions, myRoom])

  const loadPermissions = useCallback(async () => {
    if (!lobbyId) return null
    const data = await campusHostApi.permissions(lobbyId)
    setPermissions(data)
    return data
  }, [lobbyId])

  // Asked for as soon as there is a lobby, not once voice connects. Who is in
  // the lobby and what they are allowed to do is a fact about the lobby; tying
  // it to LiveKit meant the People panel was empty on every deployment without
  // voice configured — including every developer's machine — and the host
  // could not hand anything out from there at all.
  useEffect(() => {
    if (lobbyId) loadPermissions().catch(() => {})
  }, [lobbyId, loadPermissions])

  // And again when voice arrives, because connecting can change what the
  // server says about publishing rights.
  useEffect(() => {
    if (connected) loadPermissions().catch(() => {})
  }, [connected, loadPermissions])

  const toggleMic = useCallback(async () => {
    const voice = voiceRef.current
    if (!voice) return
    const next = !voice.microphoneEnabled
    const ok = await voice.setMicrophoneEnabled(next)
    setMicEnabled(ok ? next : voice.microphoneEnabled)
    if (!ok) setError("You have been muted by the host.")
  }, [])

  const toggleScreenShare = useCallback(async () => {
    const voice = voiceRef.current
    if (!voice) return
    const next = !voice.screenShareEnabled
    const ok = await voice.setScreenShareEnabled(next)
    if (!ok) setError("The host has not given you permission to share your screen.")
  }, [])

  const setMemberMuted = useCallback(
    async (userId: string | number, muted: boolean) => {
      if (!lobbyId) return
      await campusHostApi.setMuted(lobbyId, userId, muted)
      await loadPermissions()
    },
    [lobbyId, loadPermissions],
  )

  const setMemberScreenShare = useCallback(
    async (userId: string | number, allowed: boolean) => {
      if (!lobbyId) return
      await campusHostApi.setScreenShare(lobbyId, userId, allowed)
      await loadPermissions()
    },
    [lobbyId, loadPermissions],
  )

  const setMemberPrivileges = useCallback(
    async (
      userId: string | number,
      granted: Partial<Record<'manage' | 'kick' | 'mute' | 'present', boolean>>,
    ) => {
      if (!lobbyId) return
      await campusHostApi.setPrivileges(lobbyId, userId, granted)
      await loadPermissions()
    },
    [lobbyId, loadPermissions],
  )

  const removeMember = useCallback(
    async (userId: string | number) => {
      if (!lobbyId) return
      await campusHostApi.kick(lobbyId, userId)
      await loadPermissions()
    },
    [lobbyId, loadPermissions],
  )

  // Our own rights can change while connected; re-mint to pick that up.
  const refreshMyPermissions = useCallback(async () => {
    const voice = voiceRef.current
    if (!voice || !lobbyId) return
    await voice.refreshPermissions(lobbyId)
    setMicEnabled(voice.microphoneEnabled)
  }, [lobbyId])

  return {
    connected,
    error,
    participants,
    micEnabled,
    screenShare,
    permissions,
    setMemberPrivileges,
    removeMember,
    reloadPermissions: loadPermissions,
    isHost: Boolean(voiceRef.current?.isHost),
    mayScreenShare: Boolean(voiceRef.current?.mayScreenShare),
    toggleMic,
    toggleScreenShare,
    setMemberMuted,
    setMemberScreenShare,
    refreshMyPermissions,
    loadPermissions,
  }
}

export default useCampusVoice
