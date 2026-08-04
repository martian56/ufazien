import { useCallback, useEffect, useRef, useState } from "react"
import { CampusVoice, campusHostApi } from "../services/campusVoice"

/**
 * Binds LiveKit voice to the campus lobby.
 *
 * Positions come from the game's own WebSocket, so voice needs no extra
 * transport: it just re-points the Web Audio listener and each remote panner
 * whenever the game says someone moved.
 */
export function useCampusVoice({ lobbyId, userPosition, playerPositions, enabled = true }) {
  const voiceRef = useRef(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState(null)
  const [participants, setParticipants] = useState([])
  const [micEnabled, setMicEnabled] = useState(false)
  const [screenShare, setScreenShare] = useState(null)
  const [permissions, setPermissions] = useState(null)

  // Connect once per lobby.
  useEffect(() => {
    if (!lobbyId || !enabled) return

    const voice = new CampusVoice()
    voiceRef.current = voice
    let cancelled = false

    voice.onParticipantsChanged = (list) => {
      if (!cancelled) setParticipants(list)
    }
    voice.onScreenShare = ({ identity, element, active }) => {
      if (!cancelled) setScreenShare(active ? { identity, element } : null)
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
          setError(err?.response?.data?.error || err?.message || "Voice unavailable")
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
    voiceRef.current?.setLocalPosition({ x: userPosition.x ?? 0, y: userPosition.y ?? 0 })
  }, [connected, userPosition?.x, userPosition?.y])

  // Move each remote voice with its player.
  useEffect(() => {
    if (!connected || !playerPositions) return
    const entries = playerPositions instanceof Map
      ? [...playerPositions.entries()]
      : Object.entries(playerPositions || {})

    for (const [userId, position] of entries) {
      if (!position) continue
      voiceRef.current?.setRemotePosition(userId, {
        x: position.x ?? 0,
        y: position.y ?? 0,
      })
    }
  }, [connected, playerPositions])

  const loadPermissions = useCallback(async () => {
    if (!lobbyId) return null
    const data = await campusHostApi.permissions(lobbyId)
    setPermissions(data)
    return data
  }, [lobbyId])

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
    async (userId, muted) => {
      await campusHostApi.setMuted(lobbyId, userId, muted)
      await loadPermissions()
    },
    [lobbyId, loadPermissions],
  )

  const setMemberScreenShare = useCallback(
    async (userId, allowed) => {
      await campusHostApi.setScreenShare(lobbyId, userId, allowed)
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
