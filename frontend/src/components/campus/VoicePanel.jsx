import { useEffect, useRef } from "react"
import { Mic, MicOff, MonitorUp, MonitorOff, ShieldCheck, Volume2 } from "lucide-react"

/** The shared screen, mounted wherever the caller puts the board. */
export function ScreenShareBoard({ screenShare }) {
  const holder = useRef(null)

  useEffect(() => {
    const node = holder.current
    if (!node) return
    node.replaceChildren()
    if (screenShare?.element) {
      const video = screenShare.element
      video.style.width = "100%"
      video.style.height = "100%"
      video.style.objectFit = "contain"
      node.appendChild(video)
    }
  }, [screenShare])

  return (
    <div className="w-full h-full bg-black/80 rounded-lg overflow-hidden flex items-center justify-center">
      <div ref={holder} className="w-full h-full" />
      {!screenShare && (
        <p className="absolute text-gray-400 text-sm">No one is sharing a screen</p>
      )}
    </div>
  )
}

export default function VoicePanel({
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
    <div className="bg-gray-900/90 text-white rounded-lg p-3 w-56 sm:w-72 space-y-3 backdrop-blur">
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
