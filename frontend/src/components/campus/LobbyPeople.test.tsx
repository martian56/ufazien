import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'

import LobbyPeople, { mayDo, type LobbyMemberPermissions } from './LobbyPeople'

const HOST = 1
const DEPUTY = 2
const GUEST = 3

const members: LobbyMemberPermissions[] = [
  { user_id: HOST, username: 'owner', full_name: 'Aysel', is_host: true, is_online: true },
  { user_id: DEPUTY, username: 'deputy', full_name: 'Rashad', is_online: true, kick: true },
  { user_id: GUEST, username: 'guest', full_name: 'Nigar', is_online: false },
]

function show(meId: number, overrides: Partial<React.ComponentProps<typeof LobbyPeople>> = {}) {
  const onSetMuted = vi.fn()
  const onSetPrivilege = vi.fn()
  const onRemove = vi.fn()
  render(
    <LobbyPeople
      members={members}
      meId={meId}
      hostId={HOST}
      onSetMuted={onSetMuted}
      onSetPrivilege={onSetPrivilege}
      onRemove={onRemove}
      {...overrides}
    />,
  )
  return { onSetMuted, onSetPrivilege, onRemove }
}

/**
 * The host keeps their lobby when they leave it now, so a room the host is not
 * in still needs somebody who can moderate it. The powers move instead of the
 * role — which only works if the host can actually hand them out.
 */
describe('handing out the host powers', () => {
  it('lets the host grant one', () => {
    const { onSetPrivilege } = show(HOST)

    act(() => screen.getByRole('button', { name: /rashad: change the lobby/i }).click())

    expect(onSetPrivilege).toHaveBeenCalledWith(DEPUTY, 'manage', true)
  })

  it('takes one back that is already given', () => {
    const { onSetPrivilege } = show(HOST)

    // Rashad has `kick` in the fixture.
    act(() => screen.getByRole('button', { name: /rashad: remove people/i }).click())

    expect(onSetPrivilege).toHaveBeenCalledWith(DEPUTY, 'kick', false)
  })

  it('says which are on, for a screen reader as well as by colour', () => {
    show(HOST)
    expect(screen.getByRole('button', { name: /rashad: remove people/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: /rashad: mute people/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('offers nothing to grant to the host themselves', () => {
    show(HOST)
    // The host holds all four implicitly; there is nothing to hand them.
    const hostRow = screen.getByText('Aysel').closest('li')
    expect(hostRow!.querySelectorAll('button')).toHaveLength(0)
  })

  it('does not offer granting to anybody else', () => {
    // Not even to somebody the host allowed to manage the lobby: they must not
    // be able to promote themselves further, or promote a friend and lock the
    // host out of their own room.
    show(DEPUTY)
    expect(screen.queryByRole('button', { name: /nigar: change the lobby/i })).not.toBeInTheDocument()
  })

  it('keeps each person to one line, so a full lobby is not a long scroll', () => {
    // Spelled out under each name it was four labelled rows per member, and a
    // lobby holds twenty.
    show(HOST)
    const row = screen.getByText('Nigar').closest('li')
    expect(row).not.toBeNull()
    // Four grants, mute and remove — six controls, all on the row itself.
    expect(row!.querySelectorAll('button')).toHaveLength(6)
  })
})

describe('what each person is told', () => {
  it('tells the host the lobby stays theirs', () => {
    show(HOST)
    expect(screen.getByText(/stays yours when you leave/i)).toBeInTheDocument()
  })

  it('tells a member what they may do, rather than letting them find out', () => {
    show(DEPUTY)
    const summary = screen.getByText(/what you can do here/i).closest('div')
    expect(summary).not.toBeNull()
    // Granted `kick` in the fixture and nothing else.
    expect(summary!.textContent).toContain('Remove people')
  })

  it('shows who is actually connected', () => {
    show(GUEST)
    expect(screen.getByTitle('Not connected')).toBeInTheDocument()
  })
})

describe('removing somebody', () => {
  it('asks before it does it', () => {
    const { onRemove } = show(HOST)

    act(() => screen.getByRole('button', { name: /remove nigar/i }).click())

    expect(onRemove).not.toHaveBeenCalled()
    expect(screen.getByText(/remove nigar from the lobby\?/i)).toBeInTheDocument()
  })

  it('removes once confirmed', () => {
    const { onRemove } = show(HOST)

    act(() => screen.getByRole('button', { name: /remove nigar/i }).click())
    act(() => screen.getByRole('button', { name: /^remove$/i }).click())

    expect(onRemove).toHaveBeenCalledWith(GUEST)
  })

  it('is not offered to somebody without the power', () => {
    show(GUEST)
    expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument()
  })

  it('is never offered for the host', () => {
    // Otherwise granting `kick` hands over the lobby by another route, which is
    // the thing keeping the host was meant to stop.
    show(HOST)
    expect(screen.queryByRole('button', { name: /remove aysel/i })).not.toBeInTheDocument()
  })

  it('is not offered for yourself — that is leaving', () => {
    show(DEPUTY)
    expect(screen.queryByRole('button', { name: /remove rashad/i })).not.toBeInTheDocument()
  })
})

/**
 * A lobby holds twenty. Past a handful, finding one person by eye is the slow
 * part, so the list offers a search rather than a longer scroll.
 */
describe('a lobby with a lot of people in it', () => {
  const crowd: LobbyMemberPermissions[] = [
    members[0],
    ...Array.from({ length: 9 }, (_, i) => ({
      user_id: 100 + i,
      username: `student${i}`,
      full_name: `Student ${i}`,
      is_online: true,
    })),
  ]

  it('offers a search once there are enough of them', () => {
    show(HOST, { members: crowd })
    expect(screen.getByRole('searchbox', { name: /search people/i })).toBeInTheDocument()
  })

  it('does not clutter a small lobby with one', () => {
    show(HOST)
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
  })

  it('narrows the list to what was typed', () => {
    show(HOST, { members: crowd })
    const box = screen.getByRole('searchbox', { name: /search people/i })

    act(() => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
      setter.call(box, 'student3')
      box.dispatchEvent(new Event('input', { bubbles: true }))
    })

    expect(screen.getByText('Student 3')).toBeInTheDocument()
    expect(screen.queryByText('Student 4')).not.toBeInTheDocument()
  })

  it('says so when nobody matches, rather than showing an empty list', () => {
    show(HOST, { members: crowd })
    const box = screen.getByRole('searchbox', { name: /search people/i })

    act(() => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
      setter.call(box, 'nobody by that name')
      box.dispatchEvent(new Event('input', { bubbles: true }))
    })

    expect(screen.getByText(/nobody here matches/i)).toBeInTheDocument()
  })
})

describe('reading a privilege', () => {
  it('gives the host everything without any of it being stored', () => {
    const host = members[0]
    expect(host.manage).toBeUndefined()
    for (const privilege of ['manage', 'kick', 'mute', 'present'] as const) {
      expect(mayDo(host, HOST, privilege)).toBe(true)
    }
  })

  it('gives a member only what was granted', () => {
    expect(mayDo(members[1], HOST, 'kick')).toBe(true)
    expect(mayDo(members[1], HOST, 'manage')).toBe(false)
  })
})
