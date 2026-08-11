import { useState } from "react"
import { X } from "lucide-react"
import { api } from "../../lib/api/client"
import { errorMessage } from "../../lib/api/errors"

import type { BlogPost } from "../../lib/api/endpoints/blog"
import Radio from "../../components/ui/Radio"

interface ReportModalProps {
  darkMode: boolean
  post: Pick<BlogPost, "id" | "title"> | null
  onClose: () => void
  onDone?: (sent: boolean) => void
}


const REASONS = [
  "Spam or misleading content",
  "Inappropriate content",
  "Copyright violation",
  "Harassment or bullying",
  "Other",
]

/**
 * Report an article.
 *
 * This used to be a mock: picking a reason and pressing Submit closed the
 * dialog and said "Report submitted. Thank you for helping keep our community
 * safe." while sending nothing anywhere. Nobody was ever told.
 *
 * It now posts to the existing feedback endpoint, so a report reaches the same
 * place as everything else users send in.
 */
export default function ReportModal({ darkMode, post, onClose, onDone }: ReportModalProps) {
  const [reason, setReason] = useState(REASONS[0])
  const [details, setDetails] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      await api.post("/feedback/", {
        feedback_type: "general",
        subject: `Reported article: ${post?.title ?? "untitled"} (#${post?.id ?? "?"})`,
        message: [
          `Reason: ${reason}`,
          `Article: ${window.location.href}`,
          details.trim() ? `Details: ${details.trim()}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
      })
      onDone?.(true)
      onClose()
    } catch (err) {
      setError(errorMessage(err, "Could not send your report"))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`rounded-xl w-full max-w-md ${darkMode ? "bg-gray-800" : "bg-white"}`}>
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Report Article</h3>
            <button
              onClick={onClose}
              className={`p-2 rounded-lg transition-colors ${darkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-gray-600">Why are you reporting this article?</p>

          <div className="space-y-2">
            {REASONS.map((option) => (
              <label key={option} className="flex items-center space-x-3 cursor-pointer">
                <Radio
                  name="report-reason"
                  value={option}
                  checked={reason === option}
                  onSelect={() => setReason(option)}
                />
                <span>{option}</span>
              </label>
            ))}
          </div>

          <textarea
            placeholder="Additional details (optional)"
            rows={3}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            className={`w-full p-3 border rounded-lg resize-none ${
              darkMode
                ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                : "bg-white border-gray-300 placeholder-gray-500"
            }`}
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className={`flex-1 px-4 py-2 border rounded-lg transition-colors ${
                darkMode ? "border-gray-600 hover:bg-gray-700" : "border-gray-300 hover:bg-gray-50"
              }`}
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 transition-colors"
            >
              {submitting ? "Sending..." : "Submit Report"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
