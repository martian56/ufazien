import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, Trash2 } from 'lucide-react'
import { blogApi, type BlogPost } from '../../lib/api/endpoints/blog'
import { toList } from '../../lib/api/types'
import { errorMessage } from '../../lib/api/errors'

/**
 * Your unfinished posts, so writing can be picked up later.
 *
 * There was nothing like this: a draft lived in localStorage under one key, so
 * starting a second post silently discarded the first.
 */
export default function DraftList() {
  const [drafts, setDrafts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<number | null>(null)

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      setDrafts(toList(await blogApi.drafts()))
    } catch (err) {
      setError(errorMessage(err, 'Could not load your drafts'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const remove = async (id: number) => {
    try {
      await blogApi.remove(id)
      setDrafts((prev) => prev.filter((d) => d.id !== id))
    } catch (err) {
      setError(errorMessage(err, 'Could not delete that draft'))
    } finally {
      setConfirming(null)
    }
  }

  if (loading) return <p className="text-sm text-gray-500">Loading drafts...</p>
  if (error) return <p className="text-sm text-red-600">{error}</p>
  if (drafts.length === 0) {
    return <p className="text-sm text-gray-500">No drafts. Anything you start writing appears here.</p>
  }

  return (
    <ul className="divide-y divide-gray-100">
      {drafts.map((draft) => (
        <li key={draft.id} className="py-3 flex items-start gap-3">
          <FileText className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />

          <div className="flex-1 min-w-0">
            <Link
              to={`/blog/new?draft=${draft.id}`}
              className="block font-medium text-gray-900 hover:text-blue-600 truncate"
            >
              {draft.title || 'Untitled draft'}
            </Link>
            <p className="text-xs text-gray-500">
              Last edited {new Date(draft.updated_at).toLocaleString()}
            </p>
          </div>

          {confirming === draft.id ? (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => remove(draft.id)}
                className="text-xs px-2 py-0.5 rounded bg-red-600 text-white hover:bg-red-700"
              >
                Delete
              </button>
              <button
                onClick={() => setConfirming(null)}
                className="text-xs px-2 py-0.5 rounded text-gray-600 hover:bg-gray-100"
              >
                Keep
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirming(draft.id)}
              className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 shrink-0"
              aria-label="Delete draft"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}
