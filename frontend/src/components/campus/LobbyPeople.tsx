import { useMemo, useState } from 'react'
import { Crown, Loader2, MicOff, MonitorUp, ShieldCheck, UserMinus, Users } from 'lucide-react'

/**
 * Who is in the lobby, and what each of them is allowed to do.
 *
 * The host used to lose their lobby by walking out of it: leaving handed it to
 * whoever was left. They keep it now, which only works if a room the host is
 * not in still has somebody who can moderate it — so the host hands out the
 * individual powers instead of the whole role.
 *
 * Everybody sees this panel. A member is not shown a row of controls that will
 * refuse them; they are shown what they themselves may do, which is the thing
 * they actually want to know and which nothing told them before.
 */

/** The powers, in the order they are offered. Names match the API. */
export const PRIVILEGES = [
  {
    id: 'manage' as const,
    label: 'Change the lobby',
    hint: 'Rename it, set who can get in, close it',
    icon: ShieldCheck,
  },
  { id: 'kick' as const, label: 'Remove people', hint: 'Turn somebody out of the lobby', icon: UserMinus },
  { id: 'mute' as const, label: 'Mute people', hint: 'Mute and unmute anybody', icon: MicOff },
  { id: 'present' as const, label: 'Share their screen', hint: 'Put a screen on the projector', icon: MonitorUp },
]

export type PrivilegeId = (typeof PRIVILEGES)[number]['id']

export interface LobbyMemberPermissions {
  user_id: number | string
  username: string
  full_name?: string
  is_host?: boolean
  is_muted?: boolean
  is_online?: boolean
  manage?: boolean
  kick?: boolean
  mute?: boolean
  present?: boolean
}

export interface LobbyPeopleProps {
  members: LobbyMemberPermissions[]
  /** The signed-in player, so the panel can tell them apart from everyone else. */
  meId: number | string | null
  hostId: number | string | null
  onSetMuted: (userId: number | string, muted: boolean) => Promise<void> | void
  onSetPrivilege: (userId: number | string, privilege: PrivilegeId, granted: boolean) => Promise<void> | void
  onRemove: (userId: number | string) => Promise<void> | void
}

/** Above this many people, the list gets a search box rather than more scroll. */
export const SEARCHABLE_FROM = 6

const same = (a: number | string | null | undefined, b: number | string | null | undefined) =>
  a !== null && a !== undefined && b !== null && b !== undefined && String(a) === String(b)

/** What this player may do, reading the host's implicit everything. */
export function mayDo(
  member: LobbyMemberPermissions | undefined,
  hostId: number | string | null,
  privilege: PrivilegeId,
): boolean {
  if (!member) return false
  if (same(member.user_id, hostId)) return true
  return Boolean(member[privilege])
}

export default function LobbyPeople({
  members,
  meId,
  hostId,
  onSetMuted,
  onSetPrivilege,
  onRemove,
}: LobbyPeopleProps) {
  const [busy, setBusy] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<number | string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const me = useMemo(
    () => members.find((member) => same(member.user_id, meId)),
    [members, meId],
  )
  const [query, setQuery] = useState('')
  const iAmHost = same(meId, hostId)
  const iMayKick = mayDo(me, hostId, 'kick')
  const iMayMute = mayDo(me, hostId, 'mute')

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return members
    return members.filter((member) =>
      `${member.full_name ?? ''} ${member.username}`.toLowerCase().includes(needle),
    )
  }, [members, query])

  const run = async (key: string, action: () => Promise<void> | void) => {
    setBusy(key)
    setError(null)
    try {
      await action()
    } catch {
      setError('That did not go through. Nothing has changed.')
    } finally {
      setBusy(null)
    }
  }

  if (members.length === 0) {
    return <p className="text-sm text-slate-400">Nobody is here yet.</p>
  }

  return (
    <div className="space-y-4">
      {/* What you can do, for everybody — a member had no way to find out
          whether they were allowed to present until the button refused them. */}
      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          <Users className="h-3.5 w-3.5" />
          What you can do here
        </p>
        {iAmHost ? (
          <>
            <p className="text-sm text-slate-300">
              You host this lobby, so you can do everything — and it stays yours when you leave.
            </p>
            {/* What the buttons beside each name mean. Said once here rather
                than spelled out per person, which is what made the list long. */}
            <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-white/10 pt-2">
              {PRIVILEGES.map(({ id, label, icon: Icon }) => (
                <li key={id} className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <Icon className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                  {label}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <ul className="space-y-1 text-sm">
            {PRIVILEGES.map(({ id, label }) => (
              <li key={id} className="flex items-center gap-2">
                <span
                  aria-hidden
                  className={`h-1.5 w-1.5 rounded-full ${mayDo(me, hostId, id) ? 'bg-emerald-400' : 'bg-slate-600'}`}
                />
                <span className={mayDo(me, hostId, id) ? 'text-slate-200' : 'text-slate-500'}>
                  {label}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {/* A lobby holds twenty. Past a handful, finding one person by eye is the
          slow part, so offer the search rather than a longer scroll. */}
      {members.length > SEARCHABLE_FROM && (
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${members.length} people…`}
          aria-label="Search people"
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white placeholder-slate-500 outline-none focus:border-white/25"
        />
      )}

      <ul className="space-y-1.5">
        {shown.length === 0 && (
          <li className="py-2 text-sm text-slate-400">Nobody here matches “{query}”.</li>
        )}
        {shown.map((member) => {
          const isHost = same(member.user_id, hostId)
          const isMe = same(member.user_id, meId)
          const name = member.full_name || member.username
          const key = String(member.user_id)

          return (
            <li key={key} className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  title={member.is_online ? 'Here now' : 'Not connected'}
                  className={`h-2 w-2 shrink-0 rounded-full ${member.is_online ? 'bg-emerald-400' : 'bg-slate-600'}`}
                />
                <span className="min-w-0 flex-1 truncate text-sm text-white">
                  {name}
                  {isMe && <span className="text-slate-500"> (you)</span>}
                </span>

                {isHost && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-300">
                    <Crown className="h-3 w-3" />
                    Host
                  </span>
                )}

                {/* Handing out the host's powers, on the person's own line.
                    Spelled out under each name it was four labelled rows each,
                    and a lobby holds twenty — the host was scrolling past a
                    screenful per person. The legend above says what the icons
                    mean, once, instead of repeating it per member.

                    Only the host sees these: a member allowed to manage the
                    lobby must not be able to promote themselves further, or
                    promote a friend and lock the host out of their own room. */}
                {iAmHost && !isHost && (
                  <span className="flex shrink-0 items-center gap-0.5">
                    {PRIVILEGES.map(({ id, label, icon: Icon }) => {
                      const granted = Boolean(member[id])
                      return (
                        <button
                          key={id}
                          type="button"
                          aria-pressed={granted}
                          aria-label={`${name}: ${label.toLowerCase()}`}
                          title={`${label} — ${granted ? 'allowed' : 'not allowed'}`}
                          disabled={busy !== null}
                          onClick={() =>
                            run(`${key}:${id}`, () => onSetPrivilege(member.user_id, id, !granted))
                          }
                          className={`rounded-md p-1 transition disabled:opacity-50 ${
                            granted
                              ? 'bg-blue-600/80 text-white hover:bg-blue-600'
                              : 'bg-white/5 text-slate-500 hover:bg-white/15 hover:text-slate-300'
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </button>
                      )
                    })}
                  </span>
                )}

                {!isHost && iMayMute && (
                  <button
                    onClick={() => run(`${key}:mute`, () => onSetMuted(member.user_id, !member.is_muted))}
                    disabled={busy !== null}
                    className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-medium transition disabled:opacity-50 ${
                      member.is_muted
                        ? 'bg-red-600/80 text-white hover:bg-red-600'
                        : 'bg-white/10 text-slate-200 hover:bg-white/20'
                    }`}
                  >
                    {busy === `${key}:mute` ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : member.is_muted ? (
                      'Unmute'
                    ) : (
                      'Mute'
                    )}
                  </button>
                )}

                {!isHost && !isMe && iMayKick && (
                  <button
                    onClick={() => setConfirming(member.user_id)}
                    disabled={busy !== null}
                    aria-label={`Remove ${name}`}
                    className="shrink-0 rounded-md bg-white/10 p-1 text-slate-300 transition hover:bg-red-600/80 hover:text-white disabled:opacity-50"
                  >
                    <UserMinus className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {confirming !== null && same(confirming, member.user_id) && (
                <div className="mt-2 rounded-md border border-red-500/30 bg-red-950/40 p-2">
                  <p className="mb-2 text-xs text-red-200">
                    Remove {name} from the lobby? They can be let back in afterwards.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirming(null)}
                      className="flex-1 rounded-md bg-white/10 px-2 py-1 text-xs text-slate-200 transition hover:bg-white/20"
                    >
                      Keep them
                    </button>
                    <button
                      onClick={() =>
                        run(`${key}:kick`, async () => {
                          await onRemove(member.user_id)
                          setConfirming(null)
                        })
                      }
                      disabled={busy !== null}
                      className="flex-1 rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
                    >
                      {busy === `${key}:kick` ? 'Removing…' : 'Remove'}
                    </button>
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
