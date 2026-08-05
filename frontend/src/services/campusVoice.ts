import { Room, RoomEvent, Track } from "livekit-client"
import { api as apiClient } from "../lib/api/client"
import { errorMessage } from "../lib/api/errors"

/**
 * Voice and screen share for a campus lobby.
 *
 * One LiveKit room per lobby. Remote voice is routed through a Web Audio
 * PannerNode so it attenuates with distance and pans left/right, driven by the
 * player positions the game already streams over its own WebSocket.
 *
 * Publishing rights are not decided here. The server mints a token listing the
 * sources this participant may publish, so a modified client still cannot
 * publish audio while muted or share a screen without being granted it.
 */

// World units. The campus map uses roughly 800x600, so voice carries about a
// quarter of the map before fading out entirely.
const HEARING_RADIUS = 220
const FULL_VOLUME_RADIUS = 60


export interface Position {
  x: number
  y: number
}

interface RemoteAudio {
  identity: string
  element: HTMLMediaElement
  source: MediaStreamAudioSourceNode
  panner: PannerNode
  gain: GainNode
}

export interface LiveKitToken {
  url: string
  token: string
  can_publish_sources?: string[]
  is_host?: boolean
}

export interface Participant {
  identity: string
  name?: string
  speaking: boolean
}

export interface ScreenShareEvent {
  identity?: string
  element: HTMLVideoElement | null
  active: boolean
  isLocal?: boolean
}

export class CampusVoice {
  room: Room | null = null
  audioContext: AudioContext | null = null
  listener: AudioListener | null = null
  remotes = new Map<string, RemoteAudio>()
  localPosition: Position = { x: 0, y: 0 }
  onParticipantsChanged: ((participants: Participant[]) => void) | null = null
  onScreenShare: ((share: ScreenShareEvent) => void) | null = null
  canPublishSources: string[] = []
  isHost = false
  mayScreenShareFlag = false
  microphoneError: string | null = null

  constructor() {
    this.room = null
    this.audioContext = null
    this.listener = null
    // Keyed by track sid, not identity: a participant sharing a screen with
    // audio publishes two audio tracks, and keying by identity meant the second
    // overwrote the first, leaking the mic's nodes and leaving them playing.
    this.remotes = new Map() // sid -> { identity, element, source, panner, gain }
    this.localPosition = { x: 0, y: 0 }
    this.onParticipantsChanged = null
    this.onScreenShare = null
    this.canPublishSources = []
    this.isHost = false
  }

  get connected() {
    return this.room?.state === "connected"
  }

  async connect(lobbyId: string) {
    const data = await apiClient.post<LiveKitToken>(`/game/lobbies/${lobbyId}/livekit-token/`)
    this.canPublishSources = data.can_publish_sources || []
    this.isHost = Boolean(data.is_host)

    // Adaptive stream sizes video to the element it is attached to. The shared
    // screen is a texture on a mesh, so the element is parked at 2px and
    // LiveKit would either drop to its lowest layer or pause the track
    // outright, leaving the projector blank.
    this.room = new Room({ adaptiveStream: false, dynacast: true })

    this.room
      .on(RoomEvent.TrackSubscribed, (track, publication, participant) =>
        this._onTrackSubscribed(track, publication, participant),
      )
      .on(RoomEvent.TrackUnsubscribed, (track, publication, participant) =>
        this._onTrackUnsubscribed(track, publication, participant),
      )
      // Your own tracks are never subscribed back to you, so without these the
      // presenter is the one person who cannot see what they are presenting.
      .on(RoomEvent.LocalTrackPublished, (publication) => {
        if (publication.source !== Track.Source.ScreenShare) return
        const element = publication.track?.attach() as HTMLVideoElement | undefined
        if (element) {
          this.onScreenShare?.({
            identity: this.room?.localParticipant?.identity,
            element,
            active: true,
            isLocal: true,
          })
        }
      })
      .on(RoomEvent.LocalTrackUnpublished, (publication) => {
        if (publication.source !== Track.Source.ScreenShare) return
        this.onScreenShare?.({
          identity: this.room?.localParticipant?.identity,
          element: null,
          active: false,
          isLocal: true,
        })
      })
      .on(RoomEvent.ParticipantConnected, () => this._notifyParticipants())
      .on(RoomEvent.ParticipantDisconnected, (p) => {
        this._teardownRemote(p.identity)
        this._notifyParticipants()
      })

    await this.room.connect(data.url, data.token)

    // Publishing a mic is best effort. If the user denies permission or has no
    // input device, they should still be connected and able to hear everyone
    // else rather than losing voice altogether.
    if (this.canPublishSources.includes("microphone")) {
      try {
        await this.room.localParticipant.setMicrophoneEnabled(true)
      } catch (err) {
        this.microphoneError = errorMessage(err, "Microphone unavailable")
      }
    }

    this._notifyParticipants()
    return data
  }

  async disconnect() {
    for (const identity of [...this.remotes.keys()]) this._teardownRemote(identity)
    await this.room?.disconnect()
    this.room = null
    if (this.audioContext) {
      await this.audioContext.close().catch(() => {})
      this.audioContext = null
      this.listener = null
    }
  }

  // -- spatial audio ------------------------------------------------------

  _ensureAudioContext() {
    if (!this.audioContext) {
      // Safari still exposes only the prefixed constructor.
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.audioContext = new Ctx()
      this.listener = this.audioContext.listener
    }
    // Browsers start the context suspended until a user gesture.
    if (this.audioContext.state === "suspended") this.audioContext.resume().catch(() => {})
    return this.audioContext
  }

  _onTrackSubscribed(track: any, publication: any, participant: any) {
    if (track.kind === Track.Kind.Video) {
      // Screen share: hand the element to the caller to mount on the board.
      if (publication.source === Track.Source.ScreenShare) {
        this.onScreenShare?.({
          identity: participant.identity,
          element: track.attach(),
          active: true,
        })
      }
      return
    }

    if (track.kind !== Track.Kind.Audio) return

    const ctx = this._ensureAudioContext()
    const element = track.attach()
    // Route through Web Audio instead of letting the element play directly,
    // otherwise the raw track would be audible at full volume regardless of
    // where the speaker is standing.
    element.muted = true
    element.play?.().catch(() => {})

    const source = ctx.createMediaStreamSource(new MediaStream([track.mediaStreamTrack]))
    const panner = ctx.createPanner()
    panner.panningModel = "HRTF"
    panner.distanceModel = "inverse"
    panner.refDistance = FULL_VOLUME_RADIUS
    panner.maxDistance = HEARING_RADIUS
    panner.rolloffFactor = 1.4

    const gain = ctx.createGain()
    source.connect(panner)
    panner.connect(gain)
    gain.connect(ctx.destination)

    this.remotes.set(track.sid, {
      identity: participant.identity,
      element,
      source,
      panner,
      gain,
    })
    this._notifyParticipants()
  }

  _onTrackUnsubscribed(track: any, publication: any, participant: any) {
    if (publication.source === Track.Source.ScreenShare) {
      this.onScreenShare?.({ identity: participant.identity, element: null, active: false })
      return
    }
    if (track.kind === Track.Kind.Audio) this._teardownTrack(track.sid)
  }

  _teardownTrack(sid: string) {
    const remote = this.remotes.get(sid)
    if (!remote) return
    try {
      remote.source.disconnect()
      remote.panner.disconnect()
      remote.gain.disconnect()
      remote.element.remove()
    } catch {
      // already torn down
    }
    this.remotes.delete(sid)
  }

  /** Every track belonging to one participant, for disconnect. */
  _teardownRemote(identity: string) {
    for (const [sid, remote] of this.remotes) {
      if (remote.identity === identity) this._teardownTrack(sid)
    }
  }

  /** Where the local player is. Moves the Web Audio listener. */
  setLocalPosition({ x, y }: Position) {
    this.localPosition = { x, y }
    if (!this.listener) return
    // The map is 2D; treat y as depth so left/right panning follows x.
    if (this.listener.positionX) {
      this.listener.positionX.value = x
      this.listener.positionY.value = 0
      this.listener.positionZ.value = y
    } else {
      this.listener.setPosition(x, 0, y)
    }
  }

  /** Where a remote player is, keyed by their user id. Moves all their tracks. */
  setRemotePosition(userId: string | number, { x, y }: Position) {
    const identity = `user-${userId}`
    for (const remote of this.remotes.values()) {
      if (remote.identity !== identity) continue
      const { panner } = remote
      if (panner.positionX) {
        panner.positionX.value = x
        panner.positionY.value = 0
        panner.positionZ.value = y
      } else {
        panner.setPosition(x, 0, y)
      }
    }
  }

  /** Volume 0..1 for a remote, for UI such as a speaking indicator. */
  distanceVolume(userId: string | number, position: any) {
    const dx = position.x - this.localPosition.x
    const dy = position.y - this.localPosition.y
    const distance = Math.hypot(dx, dy)
    if (distance <= FULL_VOLUME_RADIUS) return 1
    if (distance >= HEARING_RADIUS) return 0
    return 1 - (distance - FULL_VOLUME_RADIUS) / (HEARING_RADIUS - FULL_VOLUME_RADIUS)
  }

  // -- publishing ---------------------------------------------------------

  async setMicrophoneEnabled(enabled: boolean) {
    if (!this.room) return false
    if (enabled && !this.canPublishSources.includes("microphone")) return false
    await this.room.localParticipant.setMicrophoneEnabled(enabled)
    return true
  }

  get microphoneEnabled() {
    return Boolean(this.room?.localParticipant?.isMicrophoneEnabled)
  }

  get mayScreenShare() {
    return this.canPublishSources.includes("screen_share")
  }

  async setScreenShareEnabled(enabled: boolean) {
    if (!this.room) return false
    if (enabled && !this.mayScreenShare) return false
    await this.room.localParticipant.setScreenShareEnabled(enabled, { audio: true })
    return true
  }

  get screenShareEnabled() {
    return Boolean(this.room?.localParticipant?.isScreenShareEnabled)
  }

  _notifyParticipants() {
    if (!this.onParticipantsChanged || !this.room) return
    this.onParticipantsChanged(
      [...this.room.remoteParticipants.values()].map((p) => ({
        identity: p.identity,
        name: p.name,
        speaking: p.isSpeaking,
      })),
    )
  }

  /** Re-mint the token after the host changes this member's permissions. */
  async refreshPermissions(lobbyId: string) {
    const data = await apiClient.post<LiveKitToken>(`/game/lobbies/${lobbyId}/livekit-token/`)
    this.canPublishSources = data.can_publish_sources || []
    this.isHost = Boolean(data.is_host)
    if (!this.canPublishSources.includes("microphone") && this.microphoneEnabled) {
      await this.room?.localParticipant.setMicrophoneEnabled(false)
    }
    if (!this.mayScreenShare && this.screenShareEnabled) {
      await this.room?.localParticipant.setScreenShareEnabled(false)
    }
    return data
  }
}

export const campusHostApi = {
  permissions: (lobbyId: string) =>
    apiClient.get(`/game/lobbies/${lobbyId}/permissions/`),
  setMuted: (lobbyId: string, userId: string | number, muted: boolean) =>
    apiClient
      .post(`/game/lobbies/${lobbyId}/members/${userId}/mute/`, { muted })
      ,
  setScreenShare: (lobbyId: string, userId: string | number, allowed: boolean) =>
    apiClient
      .post(`/game/lobbies/${lobbyId}/members/${userId}/screen-share/`, { allowed })
      ,
}

export default CampusVoice
