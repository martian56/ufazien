import { useEffect, useState } from 'react'

import {
  DASH_CHECKPOINTS,
  DASH_TIME_LIMIT,
  FREE_THROW_ATTEMPTS,
  MINIGAMES,
  TITRATION_ROUNDS,
  TITRATION_TOLERANCE,
  formatClock,
  type MinigameId,
} from './minigameLogic'
import { NEARBY_STATIONS } from './stationProximity'
import type { CampusGames } from './useCampusGames'

/**
 * The mini-game overlay: the prompt to start one, the scoreboard while it
 * runs, and the result card afterwards.
 *
 * This is plain DOM outside the canvas rather than drei `Html` inside it.
 * Anything mounted in the scene graph gets its transform recomputed every
 * frame whether it moved or not, and a scoreboard does not need perspective.
 */

/**
 * Whether the player is standing at a station, polled rather than pushed.
 *
 * The stations write into a plain `Set` from inside the render loop; a React
 * state update per step would re-render the page as you walk. Six samples a
 * second is imperceptible for a prompt and free by comparison.
 */
function useNearbyStation(enabled: boolean): MinigameId | null {
  const [station, setStation] = useState<MinigameId | null>(null)

  useEffect(() => {
    if (!enabled) {
      setStation(null)
      return
    }
    const timer = setInterval(() => {
      const first = NEARBY_STATIONS.values().next().value as MinigameId | undefined
      setStation((current) => (current === (first ?? null) ? current : (first ?? null)))
    }, 160)
    return () => clearInterval(timer)
  }, [enabled])

  return station
}

function Meter({ value, label, tone = 'blue' }: { value: number; label: string; tone?: 'blue' | 'amber' }) {
  return (
    <div>
      <div className="flex justify-between text-[11px] text-gray-300 mb-1">
        <span>{label}</span>
        <span>{Math.round(value * 100)}%</span>
      </div>
      <div className="h-2 rounded-full bg-white/15 overflow-hidden">
        <div
          className={`h-full rounded-full transition-[width] duration-75 ${
            tone === 'amber' ? 'bg-amber-400' : 'bg-blue-400'
          }`}
          style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }}
        />
      </div>
    </div>
  )
}

export default function MinigameHud({
  games,
  isTouchDevice = false,
  onAction,
}: {
  games: CampusGames
  isTouchDevice?: boolean
  /** Touch equivalent of holding the action key. */
  onAction?: (held: boolean) => void
}) {
  const nearby = useNearbyStation(!games.active)
  const live = games.live.current

  /* ---------------- result card ---------------- */
  if (games.result) {
    return (
      <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
        <div className="bg-black/90 backdrop-blur-sm border border-amber-400/40 rounded-2xl px-8 py-6 text-center text-white pointer-events-auto max-w-[90vw]">
          <div className="text-4xl mb-2">🏆</div>
          <h3 className="text-xl font-bold text-amber-300">{games.result.title}</h3>
          <p className="text-sm text-gray-300 mt-1">{games.result.detail}</p>
          <p className="text-3xl font-bold mt-3">{games.result.score.toLocaleString()}</p>
          <button
            onClick={games.dismissResult}
            className="mt-5 px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold"
          >
            Nice
          </button>
        </div>
      </div>
    )
  }

  /* ---------------- start prompt ---------------- */
  if (!games.active) {
    if (!nearby) return null
    const meta = MINIGAMES[nearby]
    const best = games.best[nearby]

    return (
      <div className="absolute left-1/2 -translate-x-1/2 bottom-24 z-30 pointer-events-auto max-w-[92vw]">
        <div className="bg-black/85 backdrop-blur-sm border border-amber-400/40 rounded-xl px-4 py-3 text-white flex items-center gap-3">
          <span className="text-2xl">{meta.icon}</span>
          <div className="min-w-0">
            <div className="font-semibold text-amber-300 text-sm">{meta.name}</div>
            <div className="text-xs text-gray-300 truncate">{meta.blurb}</div>
            {best !== undefined && (
              <div className="text-[11px] text-gray-400 mt-0.5">Your best: {best.toLocaleString()}</div>
            )}
          </div>
          <button
            onClick={() => games.start(nearby)}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold"
          >
            Play
          </button>
        </div>
      </div>
    )
  }

  /* ---------------- live scoreboard ---------------- */
  const meta = MINIGAMES[games.active]

  return (
    <div className="absolute left-1/2 -translate-x-1/2 bottom-20 z-30 pointer-events-none w-[min(24rem,92vw)]">
      <div className="bg-black/85 backdrop-blur-sm border border-amber-400/40 rounded-xl px-4 py-3 text-white space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-amber-300 text-sm">
            {meta.icon} {meta.name}
          </span>
          <button
            onClick={games.quit}
            className="pointer-events-auto text-xs text-gray-400 hover:text-white px-2 py-0.5 rounded hover:bg-white/10"
          >
            Quit
          </button>
        </div>

        {games.active === 'basketball' && (
          <>
            <div className="flex justify-between text-sm">
              <span>
                Shot {Math.min(games.throws.shots + 1, FREE_THROW_ATTEMPTS)}/{FREE_THROW_ATTEMPTS}
              </span>
              <span className="text-green-400">{games.throws.made} made</span>
              <span className="text-amber-300">{games.throws.score}</span>
            </div>
            <Meter value={live.charge} label="Power" tone="amber" />
          </>
        )}

        {games.active === 'dash' && (
          <>
            <div className="flex justify-between text-sm">
              <span>
                Ring {Math.min(games.dash.index + 1, DASH_CHECKPOINTS.length)}/{DASH_CHECKPOINTS.length}
              </span>
              <span className="tabular-nums">{formatClock(live.elapsed)}</span>
            </div>
            <Meter value={1 - live.elapsed / DASH_TIME_LIMIT} label="Time left" />
          </>
        )}

        {games.active === 'titration' && games.titration && (
          <>
            <div className="flex justify-between text-sm">
              <span>
                Round {games.titration.round + 1}/{TITRATION_ROUNDS}
              </span>
              <span className="text-blue-300">
                Endpoint {games.titration.target.toFixed(1)} ml ± {TITRATION_TOLERANCE}
              </span>
            </div>
            <div className="text-center text-2xl font-bold tabular-nums">
              {live.delivered.toFixed(1)} ml
            </div>
            <Meter value={live.delivered / Math.max(games.titration.target * 1.5, 1)} label="Delivered" />
            {games.titration.lastVerdict && (
              <div className="text-xs text-gray-300 text-center">{games.titration.lastVerdict}</div>
            )}
          </>
        )}

        {games.active === 'booksort' && games.shelf && (
          <div className="flex justify-between text-sm">
            <span>
              {games.shelf.state.picked.length}/{games.shelf.books.length} shelved
            </span>
            <span className="text-red-300">
              {games.shelf.mistakes} mistake{games.shelf.mistakes === 1 ? '' : 's'}
            </span>
          </div>
        )}

        <div className="text-[11px] text-gray-400 text-center">
          {isTouchDevice ? 'Use the Action button' : meta.controls}
        </div>
      </div>

      {/* A hold button, since a phone has no F key. */}
      {isTouchDevice && games.active !== 'dash' && (
        <button
          onTouchStart={(e) => {
            e.stopPropagation()
            onAction?.(true)
          }}
          onTouchEnd={(e) => {
            e.stopPropagation()
            onAction?.(false)
          }}
          onTouchCancel={() => onAction?.(false)}
          className="pointer-events-auto mt-2 mx-auto block w-32 h-12 rounded-full bg-amber-500 text-black font-semibold active:scale-95"
        >
          Hold
        </button>
      )}
    </div>
  )
}

/**
 * The crosshair.
 *
 * Only shown where aiming is the point: shelving a book means putting it under
 * the centre of the screen, and there is otherwise nothing to tell you where
 * that is.
 */
export function Crosshair({ visible }: { visible: boolean }) {
  if (!visible) return null
  return (
    <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center">
      <div className="w-5 h-5 rounded-full border-2 border-white/70 shadow-[0_0_6px_rgba(0,0,0,0.8)]" />
    </div>
  )
}
