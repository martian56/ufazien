import { type MutableRefObject, type ReactNode } from 'react'
import {
  Maximize,
  Mic,
  MicOff,
  Minimize,
  MonitorOff,
  MonitorUp,
  Settings,
} from 'lucide-react'
import MiniMap, { type MapPeer } from './MiniMap'
import type { Pose } from './mapProjection'

interface HudButtonProps {
  label: string
  hint?: string
  active?: boolean
  danger?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}

export function HudButton({ label, hint, active, danger, disabled, onClick, children }: HudButtonProps) {
  const tone = disabled
    ? 'border-white/10 bg-slate-950/50 text-slate-600'
    : danger
      ? 'border-rose-400/40 bg-rose-500/20 text-rose-200 hover:border-rose-300/60 hover:bg-rose-500/30'
      : active
        ? 'border-emerald-300/40 bg-emerald-500/20 text-emerald-100 hover:border-emerald-200/60 hover:bg-emerald-500/30'
        : 'border-white/15 bg-slate-950/70 text-slate-200 hover:border-white/35 hover:bg-slate-900/80'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={hint ? `${label} (${hint})` : label}
      className={`flex h-7 w-7 items-center justify-center rounded-md border shadow-md shadow-black/30 backdrop-blur transition sm:h-8 sm:w-8 ${tone}`}
    >
      {children}
    </button>
  )
}

interface Props {
  poseRef: MutableRefObject<Pose>
  peers: MapPeer[]
  mapOpen: boolean
  onToggleMap: () => void
  onCloseMap: () => void
  voiceConnected: boolean
  micEnabled: boolean
  onToggleMic: () => void
  mayScreenShare: boolean
  isSharing: boolean
  onToggleScreenShare: () => void
  onOpenSettings: () => void
  isFullscreen: boolean
  fullscreenSupported: boolean
  onToggleFullscreen: () => void
}

const ICON = 'h-3.5 w-3.5 sm:h-4 sm:w-4'

export default function HudDock({
  poseRef,
  peers,
  mapOpen,
  onToggleMap,
  onCloseMap,
  voiceConnected,
  micEnabled,
  onToggleMic,
  mayScreenShare,
  isSharing,
  onToggleScreenShare,
  onOpenSettings,
  isFullscreen,
  fullscreenSupported,
  onToggleFullscreen,
}: Props) {
  return (
    <div className="pointer-events-none absolute right-0 top-0 z-30 flex items-start gap-1.5 p-2 pr-[max(0.5rem,env(safe-area-inset-right))] pt-[max(0.5rem,env(safe-area-inset-top))] sm:gap-2 sm:p-3">
      <div className="pointer-events-auto flex flex-col gap-1.5">
        <HudButton
          label={micEnabled ? 'Mute yourself' : 'Unmute yourself'}
          hint="B"
          active={micEnabled}
          danger={!micEnabled && voiceConnected}
          disabled={!voiceConnected}
          onClick={onToggleMic}
        >
          {micEnabled ? <Mic className={ICON} /> : <MicOff className={ICON} />}
        </HudButton>

        <HudButton
          label={isSharing ? 'Stop sharing your screen' : 'Share your screen'}
          active={isSharing}
          disabled={!mayScreenShare || !voiceConnected}
          onClick={onToggleScreenShare}
        >
          {isSharing ? <MonitorOff className={ICON} /> : <MonitorUp className={ICON} />}
        </HudButton>

        <HudButton label="Settings" hint="P" onClick={onOpenSettings}>
          <Settings className={ICON} />
        </HudButton>

        {fullscreenSupported && (
          <HudButton
            label={isFullscreen ? 'Leave full screen' : 'Go full screen'}
            hint="O"
            active={isFullscreen}
            onClick={onToggleFullscreen}
          >
            {isFullscreen ? <Minimize className={ICON} /> : <Maximize className={ICON} />}
          </HudButton>
        )}
      </div>

      <div className="pointer-events-auto">
        <MiniMap
          poseRef={poseRef}
          peers={peers}
          expanded={mapOpen}
          onToggle={onToggleMap}
          onClose={onCloseMap}
        />
      </div>
    </div>
  )
}
