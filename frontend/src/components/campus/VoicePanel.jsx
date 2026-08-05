import { useEffect, useRef } from "react"
import { Mic, MicOff, MonitorUp, MonitorOff, ShieldCheck, Volume2 } from "lucide-react"

/**
 * Owns the shared video element.
 *
 * The picture belongs on the projector screen in the room, but a `VideoTexture`
 * only keeps decoding while its element is in the document, so the element
 * still needs a home. It gets exactly one: this holder never changes parent,
 * only size, which is what lets `expanded` toggle without interrupting the
 * texture. Parked it is a 2px corner nobody sees; expanded it is a reader for
 * slides too small to make out from a seat.
 */
export function ScreenShareStage({ screenShare, expanded, onClose }) {
  const holder = useRef(null)

  useEffect(() => {
    const node = holder.current
    const video = screenShare?.element
    if (!node || !video) return

    video.muted = true
    video.playsInline = true
    video.style.width = "100%"
    video.style.height = "100%"
    video.style.objectFit = "contain"
    node.appendChild(video)
    video.play?.().catch(() => {})

    return () => video.remove()
  }, [screenShare])

  if (!screenShare) return null

  return (
    <div
      className={
        expanded
          ? "fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4 pointer-events-auto"
          : "fixed top-0 left-0 w-[2px] h-[2px] overflow-hidden opacity-0 pointer-events-none -z-10"
      }
    >
      <div ref={holder} className={expanded ? "w-full h-full" : "w-full h-full"} />
      {expanded && (
        <button
          onClick={onClose}
          className="mt-3 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm border border-white/20"
        >
          Back to the room
        </button>
      )}
    </div>
  )
}

export default function VoicePanel({
  embedded = false,
  connected,
  error,
  participants,
  micEnabled,
  mayScreenShare,
  isHost,
  permissions,
  onToggleMic,
  onToggleScreenShare,
  onSetMemberMuted,
  onSetMemberScreenShare,
}) {
  const members = permissions?.members || []

  return (
    <div
      className={
        embedded
          // Already inside the settings menu, so no card of its own.
          ? "text-white space-y-3"
          : "bg-gray-900/90 text-white rounded-lg p-3 w-56 sm:w-72 space-y-3 backdrop-blur"
      }
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold flex items-center gap-2">
          <Volume2 className="w-4 h-4" />
          Voice
        </span>
        <span className={`text-xs ${connected ? "text-green-400" : "text-gray-400"}`}>
          {connected ? `${participants.length + 1} in range` : "connecting..."}
        </span>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={onToggleMic}
          className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs ${
            micEnabled ? "bg-green-600 hover:bg-green-700" : "bg-gray-700 hover:bg-gray-600"
          }`}
        >
          {micEnabled ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
          {micEnabled ? "Mic on" : "Mic off"}
        </button>

        <button
          onClick={onToggleScreenShare}
          disabled={!mayScreenShare}
          title={mayScreenShare ? "Share your screen" : "The host has not allowed you to share"}
          className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs ${
            mayScreenShare
              ? "bg-blue-600 hover:bg-blue-700"
              : "bg-gray-800 text-gray-500 cursor-not-allowed"
          }`}
        >
          {mayScreenShare ? (
            <MonitorUp className="w-3.5 h-3.5" />
          ) : (
            <MonitorOff className="w-3.5 h-3.5" />
          )}
          Share
        </button>
      </div>

      {isHost && members.length > 0 && (
        <div className="pt-2 border-t border-gray-700 space-y-1.5">
          <p className="text-xs text-gray-400 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            Host controls
          </p>
          {members
            .filter((m) => !m.is_host)
            .map((m) => (
              <div key={m.user_id} className="flex items-center justify-between text-xs">
                <span className="truncate max-w-[7rem]">{m.full_name}</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => onSetMemberMuted(m.user_id, !m.is_muted)}
                    className={`px-1.5 py-0.5 rounded ${
                      m.is_muted ? "bg-red-600" : "bg-gray-700 hover:bg-gray-600"
                    }`}
                  >
                    {m.is_muted ? "Unmute" : "Mute"}
                  </button>
                  <button
                    onClick={() => onSetMemberScreenShare(m.user_id, !m.can_share_screen)}
                    className={`px-1.5 py-0.5 rounded ${
                      m.can_share_screen ? "bg-blue-600" : "bg-gray-700 hover:bg-gray-600"
                    }`}
                  >
                    {m.can_share_screen ? "Revoke" : "Allow"}
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
