import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react"
import type { ReactNode } from "react"
import { AlertTriangle, Info, X } from "lucide-react"

import { useToast, ToastContainer } from "../../hooks/useToast"
import type { ToastApi } from "../../hooks/useToast"

interface ConfirmOptions {
  title: string
  message?: string
  confirmText?: string
  cancelText?: string
  tone?: "danger" | "warning" | "info"
}

interface PromptOptions {
  title: string
  label?: string
  defaultValue?: string
  placeholder?: string
  confirmText?: string
}

interface DialogsApi {
  toast: ToastApi
  confirm: (options: ConfirmOptions) => Promise<boolean>
  promptText: (options: PromptOptions) => Promise<string | null>
}

const DialogsContext = createContext<DialogsApi | null>(null)

export function useDialogs(): DialogsApi {
  const value = useContext(DialogsContext)
  if (!value) throw new Error("useDialogs must be used inside <DialogProvider>")
  return value
}

const TONE = {
  danger: { icon: "text-red-600", chip: "bg-red-50", button: "bg-red-600 hover:bg-red-700" },
  warning: { icon: "text-amber-600", chip: "bg-amber-50", button: "bg-amber-600 hover:bg-amber-700" },
  info: { icon: "text-blue-600", chip: "bg-blue-50", button: "bg-blue-600 hover:bg-blue-700" },
} as const

function Shell({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose()
      }}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-gray-900/50 cursor-default"
      />
      <div className="relative w-full max-w-md bg-white rounded-lg border border-gray-200">{children}</div>
    </div>
  )
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const { notifications, toast, removeNotification } = useToast()
  const [confirmState, setConfirmState] = useState<ConfirmOptions | null>(null)
  const [promptState, setPromptState] = useState<PromptOptions | null>(null)
  const [promptValue, setPromptValue] = useState("")
  const resolver = useRef<((value: never) => void) | null>(null)

  const settle = useCallback((value: unknown) => {
    const resolve = resolver.current
    resolver.current = null
    setConfirmState(null)
    setPromptState(null)
    resolve?.(value as never)
  }, [])

  const confirm = useCallback((options: ConfirmOptions) => {
    setConfirmState(options)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve as (value: never) => void
    })
  }, [])

  const promptText = useCallback((options: PromptOptions) => {
    setPromptValue(options.defaultValue ?? "")
    setPromptState(options)
    return new Promise<string | null>((resolve) => {
      resolver.current = resolve as (value: never) => void
    })
  }, [])

  const api = useMemo(() => ({ toast, confirm, promptText }), [toast, confirm, promptText])

  const tone = TONE[confirmState?.tone ?? "danger"]
  const ToneIcon = confirmState?.tone === "info" ? Info : AlertTriangle

  return (
    <DialogsContext.Provider value={api}>
      {children}
      <ToastContainer notifications={notifications} removeNotification={removeNotification} />

      {confirmState && (
        <Shell onClose={() => settle(false)}>
          <div className="p-6">
            <div className="flex gap-4">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tone.chip}`}>
                <ToneIcon className={`h-5 w-5 ${tone.icon}`} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2 className="font-semibold text-gray-900">{confirmState.title}</h2>
                {confirmState.message && (
                  <p className="mt-1 text-sm text-gray-500">{confirmState.message}</p>
                )}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => settle(false)}
              className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {confirmState.cancelText ?? "Cancel"}
            </button>
            <button
              type="button"
              autoFocus
              onClick={() => settle(true)}
              className={`px-4 py-2 rounded-md text-sm font-medium text-white transition-colors ${tone.button}`}
            >
              {confirmState.confirmText ?? "Confirm"}
            </button>
          </div>
        </Shell>
      )}

      {promptState && (
        <Shell onClose={() => settle(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              settle(promptValue.trim() ? promptValue.trim() : null)
            }}
          >
            <div className="p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <h2 className="font-semibold text-gray-900">{promptState.title}</h2>
                <button
                  type="button"
                  onClick={() => settle(null)}
                  aria-label="Close"
                  className="p-1 -m-1 rounded-md text-gray-400 hover:text-gray-900"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {promptState.label && (
                <label htmlFor="ufz-prompt" className="block text-sm font-medium text-gray-700 mb-1">
                  {promptState.label}
                </label>
              )}
              <input
                id="ufz-prompt"
                autoFocus
                value={promptValue}
                onChange={(e) => setPromptValue(e.target.value)}
                placeholder={promptState.placeholder}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400"
              />
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => settle(null)}
                className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!promptValue.trim()}
                className="px-4 py-2 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 transition-colors"
              >
                {promptState.confirmText ?? "Save"}
              </button>
            </div>
          </form>
        </Shell>
      )}
    </DialogsContext.Provider>
  )
}
