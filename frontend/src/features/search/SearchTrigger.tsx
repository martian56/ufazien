import { Search } from "lucide-react"

import { useSearch, shortcutLabel } from "./searchContext"

export default function SearchTrigger() {
  const { open } = useSearch()
  const hint = shortcutLabel(typeof navigator === "undefined" ? "" : navigator.userAgent)

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-label="Search"
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:border-gray-300 hover:text-gray-700 sm:hidden"
      >
        <Search className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={open}
        className="hidden w-64 items-center gap-2.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-left transition hover:border-gray-300 hover:bg-white sm:flex"
      >
        <Search className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
        <span className="flex-1 text-sm text-gray-400">Search</span>
        <kbd className="shrink-0 rounded border border-gray-200 bg-white px-1.5 py-0.5 font-sans text-[11px] font-medium text-gray-500">
          {hint}
        </kbd>
      </button>
    </>
  )
}
