import { useState } from 'react'
import { Send, X } from 'lucide-react'
import { errorMessage } from '../../../lib/api/errors'

interface ReplyComposerProps {
  onSubmit: (content: string) => Promise<unknown>
  onCancel?: () => void
  placeholder?: string
  autoFocus?: boolean
}

export default function ReplyComposer({
  onSubmit,
  onCancel,
  placeholder = 'Write a reply...',
  autoFocus = false,
}: ReplyComposerProps) {
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const send = async () => {
    const trimmed = content.trim()
    if (!trimmed || sending) return

    setSending(true)
    setError(null)
    try {
      await onSubmit(trimmed)
      setContent('')
      onCancel?.()
    } catch (err) {
      setError(errorMessage(err, 'Could not post your reply'))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-2">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={(e) => {
          // Enter alone inserts a newline; a reply can be more than one line.
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send()
          if (e.key === 'Escape') onCancel?.()
        }}
        placeholder={placeholder}
        autoFocus={autoFocus}
        rows={3}
        maxLength={2000}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-y focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          onClick={send}
          disabled={!content.trim() || sending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          <Send className="w-3.5 h-3.5" />
          {sending ? 'Posting...' : 'Reply'}
        </button>

        {onCancel && (
          <button
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-gray-600 text-sm hover:bg-gray-100"
          >
            <X className="w-3.5 h-3.5" />
            Cancel
          </button>
        )}

        <span className="ml-auto text-xs text-gray-400">{content.length}/2000</span>
      </div>
    </div>
  )
}
