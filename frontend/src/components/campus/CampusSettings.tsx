import { useState, type ReactNode } from 'react'
import { Keyboard, LogOut, Maximize, Minimize, Monitor, Moon, Sun, Sunset, Volume2, X } from 'lucide-react'
import { KEY_GROUPS, bindingsIn } from './keyBindings'
import { DISTRICT_ATTRIBUTION } from './districtSurvey'

export type TimeOfDay = 'day' | 'dusk' | 'night'

type Tab = 'display' | 'voice' | 'controls'

interface Props {
  open: boolean
  onClose: () => void
  timeOfDay: TimeOfDay
  onTimeOfDay: (value: TimeOfDay) => void
  isFullscreen: boolean
  fullscreenSupported: boolean
  onToggleFullscreen: () => void
  onLeave: () => void
  voice: ReactNode
}

const TABS: { id: Tab; label: string; icon: typeof Monitor }[] = [
  { id: 'display', label: 'Display', icon: Monitor },
  { id: 'voice', label: 'Voice', icon: Volume2 },
  { id: 'controls', label: 'Controls', icon: Keyboard },
]

const TIMES: { id: TimeOfDay; label: string; icon: typeof Sun }[] = [
  { id: 'day', label: 'Day', icon: Sun },
  { id: 'dusk', label: 'Dusk', icon: Sunset },
  { id: 'night', label: 'Night', icon: Moon },
]

function Key({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded border border-white/15 bg-white/10 px-1 font-sans text-[10px] font-semibold text-slate-200">
      {children}
    </kbd>
  )
}

export default function CampusSettings({
  open,
  onClose,
  timeOfDay,
  onTimeOfDay,
  isFullscreen,
  fullscreenSupported,
  onToggleFullscreen,
  onLeave,
  voice,
}: Props) {
  const [tab, setTab] = useState<Tab>('display')

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-6">
      <div className="flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-xl border border-white/10 bg-slate-950/95 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
          <h2 className="text-sm font-semibold text-white">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="rounded-md p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div role="tablist" className="flex shrink-0 gap-1 border-b border-white/10 px-2 py-1.5">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition ${
                tab === id ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {tab === 'display' && (
            <div className="space-y-4">
              <section>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                  Time of day
                </h3>
                <div className="grid grid-cols-3 gap-1.5">
                  {TIMES.map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      onClick={() => onTimeOfDay(id)}
                      aria-pressed={timeOfDay === id}
                      className={`flex flex-col items-center gap-1 rounded-lg border py-2.5 text-[11px] font-medium transition ${
                        timeOfDay === id
                          ? 'border-white/25 bg-white/15 text-white'
                          : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20 hover:text-slate-200'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </div>
              </section>

              {fullscreenSupported && (
                <section>
                  <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                    Screen
                  </h3>
                  <button
                    onClick={onToggleFullscreen}
                    className="flex w-full items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-left transition hover:border-white/25 hover:bg-white/10"
                  >
                    <span className="flex items-center gap-2.5">
                      {isFullscreen ? (
                        <Minimize className="h-4 w-4 text-slate-300" />
                      ) : (
                        <Maximize className="h-4 w-4 text-slate-300" />
                      )}
                      <span>
                        <span className="block text-sm text-white">
                          {isFullscreen ? 'Leave full screen' : 'Go full screen'}
                        </span>
                        <span className="block text-[11px] text-slate-500">
                          Fills the screen and hides the browser bars
                        </span>
                      </span>
                    </span>
                    <Key>O</Key>
                  </button>
                </section>
              )}
            </div>
          )}

          {tab === 'voice' && <div className="text-sm text-slate-300">{voice}</div>}

          {tab === 'controls' && (
            <div className="space-y-4">
              {KEY_GROUPS.map((group) => (
                <section key={group}>
                  <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                    {group}
                  </h3>
                  <ul className="divide-y divide-white/5 overflow-hidden rounded-lg border border-white/10">
                    {bindingsIn(group).map((binding) => (
                      <li
                        key={binding.label}
                        className="flex items-center justify-between gap-3 bg-white/[0.03] px-3 py-1.5"
                      >
                        <span className="text-[12px] text-slate-300">{binding.label}</span>
                        <span className="flex shrink-0 gap-1">
                          {binding.keys.map((key) => (
                            <Key key={key}>{key}</Key>
                          ))}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>

        {/* The streets and footprints around the university are OpenStreetMap
            data. ODbL requires the attribution to be visible to anyone using
            the work, so it goes on screen rather than in a source comment. */}
        <div className="shrink-0 border-t border-white/10 px-3 py-2 text-[11px] text-slate-500">
          Nizami Street and the surrounding blocks are drawn from{' '}
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-slate-600 underline-offset-2 hover:text-slate-300"
          >
            {DISTRICT_ATTRIBUTION}
          </a>
          , used under the ODbL. Characters by{' '}
          <a
            href="https://quaternius.com"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-slate-600 underline-offset-2 hover:text-slate-300"
          >
            Quaternius
          </a>
          , released under CC0.
        </div>

        <div className="shrink-0 border-t border-white/10 p-2">
          <button
            onClick={onLeave}
            className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-rose-300 transition hover:bg-rose-500/15 hover:text-rose-200"
          >
            <LogOut className="h-4 w-4" />
            Leave the campus
          </button>
        </div>
      </div>
    </div>
  )
}
