import { Copy, Facebook, Linkedin, Twitter, X } from "lucide-react"

interface ShareModalProps {
  darkMode: boolean
  onClose: () => void
  onShare: (network: "twitter" | "facebook" | "linkedin") => void
  onCopyLink: () => void
}


/**
 * Share sheet for an article.
 *
 * `onCopyLink` reports whether the copy actually happened, because the previous
 * version called navigator.clipboard.writeText without awaiting or catching it
 * and then claimed success unconditionally. The clipboard rejects whenever the
 * document is not focused, so that message was sometimes simply untrue.
 */
export default function ShareModal({ darkMode, onClose, onShare, onCopyLink }: ShareModalProps) {
  const optionClass = "w-full flex items-center space-x-3 p-3 rounded-lg transition-colors"

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`rounded-xl w-full max-w-md ${darkMode ? "bg-gray-800" : "bg-white"}`}>
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Share Article</h3>
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
          <button onClick={() => onShare("twitter")} className={`${optionClass} hover:bg-blue-50 hover:text-blue-600`}>
            <Twitter className="w-5 h-5" />
            <span>Share on Twitter</span>
          </button>

          <button onClick={() => onShare("facebook")} className={`${optionClass} hover:bg-blue-50 hover:text-blue-600`}>
            <Facebook className="w-5 h-5" />
            <span>Share on Facebook</span>
          </button>

          <button onClick={() => onShare("linkedin")} className={`${optionClass} hover:bg-blue-50 hover:text-blue-600`}>
            <Linkedin className="w-5 h-5" />
            <span>Share on LinkedIn</span>
          </button>

          <button onClick={onCopyLink} className={`${optionClass} hover:bg-gray-50 hover:text-gray-600`}>
            <Copy className="w-5 h-5" />
            <span>Copy Link</span>
          </button>
        </div>
      </div>
    </div>
  )
}
