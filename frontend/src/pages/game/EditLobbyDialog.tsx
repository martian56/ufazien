import { useState } from 'react'
import { Loader2 } from 'lucide-react'

import type { Lobby } from '../../services/campusTypes'
import { Checkbox } from '../../components/ui/checkbox'
import Range from '../../components/ui/Range'

/**
 * Changing a lobby you host.
 *
 * The endpoints have always been there and nothing on the menu ever called
 * them, so a lobby was fixed at whatever it was created as. That mattered more
 * once the host stopped losing their lobby by walking out of it: they keep it,
 * so they need somewhere to come back to it.
 *
 * Only what has actually changed is sent. `PUT` here is partial, and sending
 * the whole form back would rewrite the password on every save — including
 * with the empty string the field starts at, which quietly unlocks the lobby.
 */
export interface EditLobbyDialogProps {
  lobby: Lobby
  busy?: boolean
  onCancel: () => void
  onSave: (changes: Partial<Lobby> & { password?: string }) => void
}

export function changedFields(
  lobby: Lobby,
  form: { name: string; description: string; max_players: number; is_private: boolean; password: string },
): Partial<Lobby> & { password?: string } {
  const changes: Partial<Lobby> & { password?: string } = {}

  if (form.name.trim() !== lobby.name) changes.name = form.name.trim()
  if (form.description !== (lobby.description ?? '')) changes.description = form.description
  if (form.max_players !== lobby.max_players) changes.max_players = form.max_players
  if (form.is_private !== lobby.is_private) changes.is_private = form.is_private

  // Only when they typed one. Blank means "leave it alone", not "remove it" —
  // the current password is never sent to the client, so an empty box is the
  // normal state of this field and cannot be read as an instruction.
  if (form.is_private && form.password.trim() !== '') changes.password = form.password

  return changes
}

export default function EditLobbyDialog({ lobby, busy = false, onCancel, onSave }: EditLobbyDialogProps) {
  const [form, setForm] = useState({
    name: lobby.name,
    description: lobby.description ?? '',
    max_players: lobby.max_players,
    is_private: lobby.is_private,
    password: '',
  })

  const changes = changedFields(lobby, form)
  const nothingToSave = Object.keys(changes).length === 0
  const nameIsEmpty = form.name.trim() === ''

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4">
      <div className="max-h-full w-full max-w-md overflow-y-auto rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-1 text-xl font-bold text-gray-900">Edit lobby</h2>
        <p className="mb-6 text-sm text-gray-500">
          Everyone in “{lobby.name}” sees these straight away.
        </p>

        <div className="space-y-4">
          <div>
            <label htmlFor="edit-name" className="mb-2 block text-sm font-medium text-gray-700">
              Lobby name
            </label>
            <input
              id="edit-name"
              type="text"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
            />
          </div>

          <div>
            <label htmlFor="edit-description" className="mb-2 block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              id="edit-description"
              rows={2}
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="What is this lobby for?"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Max players: {form.max_players}
            </label>
            <Range
              min={2}
              max={20}
              value={form.max_players}
              onValueChange={(value: number) => setForm((prev) => ({ ...prev, max_players: value }))}
              aria-label="Maximum players"
            />
            {form.max_players < lobby.current_players_count && (
              <p className="mt-1 text-xs text-amber-600">
                {lobby.current_players_count} are in it now. Nobody is turned out — the lobby is
                simply full until enough of them leave.
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Checkbox
              id="edit-private"
              checked={form.is_private}
              onCheckedChange={(checked: boolean) =>
                setForm((prev) => ({ ...prev, is_private: checked, password: '' }))
              }
            />
            <label htmlFor="edit-private" className="text-gray-700">
              Private lobby (requires a password)
            </label>
          </div>

          {form.is_private && (
            <div>
              <label htmlFor="edit-password" className="mb-2 block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="edit-password"
                type="password"
                value={form.password}
                onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                placeholder={lobby.is_private ? 'Leave blank to keep the current one' : 'Set a password…'}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400"
              />
            </div>
          )}
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(changes)}
            disabled={busy || nothingToSave || nameIsEmpty}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
