import { useState } from 'react'
import { Check, Pencil, Trash2, X } from 'lucide-react'
import { errorMessage } from '../../../lib/api/errors'

interface EditableTextProps {
  value: string
  canEdit: boolean
  onSave: (value: string) => Promise<unknown>
  onDelete: () => Promise<unknown>
  deleteLabel?: string
  maxLength?: number
  /** Rendered when not editing, so posts and replies can style their own body. */
  children: React.ReactNode
}

/**
 * Inline edit and delete for content you own.
 *
 * The API has always allowed both, scoped to the author by CommunityPermission,
 * but nothing in the UI ever called updatePost, deletePost or their reply
 * equivalents.
 */
export default function EditableText({
  value,
  canEdit,
  onSave,
  onDelete,
  deleteLabel = 'Delete this?',
  maxLength = 5000,
  children,
}: EditableTextProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    const trimmed = draft.trim()
    if (!trimmed || busy) return
    setBusy(true)
    setError(null)
    try {
      await onSave(trimmed)
      setEditing(false)
    } catch (err) {
      setError(errorMessage(err, 'Could not save your change'))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    setError(null)
    try {
      await onDelete()
    } catch (err) {
      setError(errorMessage(err, 'Could not delete this'))
      setBusy(false)
      setConfirming(false)
    }
  }

  if (editing) {
    return (
      <div className="space-y-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setEditing(false)
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save()
          }}
          rows={4}
          maxLength={maxLength}
          autoFocus
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-y focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex items-center gap-2">
          <button
            onClick={save}
            disabled={busy || !draft.trim()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:bg-gray-300"
          >
            <Check className="w-3.5 h-3.5" />
            {busy ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={() => {
              setDraft(value)
              setEditing(false)
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-gray-600 text-sm hover:bg-gray-100"
          >
            <X className="w-3.5 h-3.5" />
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      {children}

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

      {canEdit && (
        <div className="mt-1.5 flex items-center gap-2">
          {confirming ? (
            <>
              <span className="text-xs text-gray-600">{deleteLabel}</span>
              <button
                onClick={remove}
                disabled={busy}
                className="text-xs px-2 py-0.5 rounded bg-red-600 text-white hover:bg-red-700 disabled:bg-gray-300"
              >
                {busy ? 'Deleting...' : 'Yes, delete'}
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="text-xs px-2 py-0.5 rounded text-gray-600 hover:bg-gray-100"
              >
                Keep
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setDraft(value)
                  setEditing(true)
                }}
                className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 rounded px-1.5 py-0.5 hover:bg-blue-50"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit
              </button>
              <button
                onClick={() => setConfirming(true)}
                className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-red-600 rounded px-1.5 py-0.5 hover:bg-red-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
