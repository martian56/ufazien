import { describe, it, expect } from 'vitest'

import { changedFields } from './EditLobbyDialog'
import type { Lobby } from '../../services/campusTypes'

const lobby = {
  id: '12345678',
  name: 'Study group',
  description: 'Thursdays',
  max_players: 12,
  is_private: true,
  current_players_count: 3,
} as unknown as Lobby

const form = {
  name: lobby.name,
  description: 'Thursdays',
  max_players: 12,
  is_private: true,
  password: '',
}

/**
 * Only what changed is sent.
 *
 * The update is partial, and posting the whole form back rewrites the password
 * every time — including with the empty string the field starts at, which
 * quietly takes the lock off a private lobby.
 */
describe('working out what to save', () => {
  it('sends nothing when nothing was touched', () => {
    expect(changedFields(lobby, form)).toEqual({})
  })

  it('sends the fields that were touched, and no others', () => {
    expect(changedFields(lobby, { ...form, name: 'Study group II' })).toEqual({
      name: 'Study group II',
    })
  })

  it('never sends a blank password over a real one', () => {
    // The current password is never sent to the client, so an empty box is the
    // normal state of this field and cannot be read as "remove it".
    const changes = changedFields(lobby, { ...form, name: 'Renamed', password: '' })
    expect(changes).not.toHaveProperty('password')
  })

  it('sends a password when one was actually typed', () => {
    expect(changedFields(lobby, { ...form, password: 'hunter2' })).toEqual({
      password: 'hunter2',
    })
  })

  it('does not send a password for a lobby being made public', () => {
    const changes = changedFields(lobby, { ...form, is_private: false, password: 'ignored' })
    expect(changes).toEqual({ is_private: false })
  })

  it('trims the name, so a stray space is not a change', () => {
    expect(changedFields(lobby, { ...form, name: '  Study group  ' })).toEqual({})
  })

  it('treats a lobby with no description as having an empty one', () => {
    const undescribed = { ...lobby, description: null } as unknown as Lobby
    expect(changedFields(undescribed, { ...form, description: '' })).toEqual({})
  })
})
