import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Search, CornerDownLeft } from "lucide-react"

import { matchDestinations } from "./destinations"
import { searchApi, type SearchHit } from "../../lib/api/endpoints/search"
import { logger } from "../../lib/logger"

interface Row {
  key: string
  group: string
  title: string
  subtitle: string
  url: string
}

const MIN_REMOTE_QUERY = 2

export default function GlobalSearch() {
  const navigate = useNavigate()
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [remote, setRemote] = useState<SearchHit[]>([])
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(0)

  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const destinations = useMemo(() => matchDestinations(query), [query])

  const rows: Row[] = useMemo(() => {
    const fromPages: Row[] = destinations.map((d) => ({
      key: `page:${d.url}`,
      group: d.group,
      title: d.title,
      subtitle: "",
      url: d.url,
    }))
    const fromContent: Row[] = remote.map((r, i) => ({
      key: `hit:${r.type}:${r.url}:${i}`,
      group: r.label,
      title: r.title,
      subtitle: r.subtitle,
      url: r.url,
    }))
    return [...fromPages, ...fromContent]
  }, [destinations, remote])

  useEffect(() => {
    setActive(0)
  }, [query])

  useEffect(() => {
    const q = query.trim()
    if (q.length < MIN_REMOTE_QUERY) {
      setRemote([])
      setLoading(false)
      return
    }
    const controller = new AbortController()
    setLoading(true)
    const id = setTimeout(() => {
      searchApi
        .query(q, controller.signal)
        .then((data) => setRemote(data.results ?? []))
        .catch((error) => {
          if (!controller.signal.aborted) {
            logger.error("Search failed:", error)
            setRemote([])
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false)
        })
    }, 250)
    return () => {
      controller.abort()
      clearTimeout(id)
    }
  }, [query])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  const go = useCallback(
    (row: Row) => {
      setOpen(false)
      setQuery("")
      navigate(row.url)
    },
    [navigate],
  )

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setOpen(false)
      inputRef.current?.blur()
      return
    }
    if (!rows.length) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActive((i) => (i + 1) % rows.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActive((i) => (i - 1 + rows.length) % rows.length)
    } else if (e.key === "Enter") {
      e.preventDefault()
      go(rows[active])
    }
  }

  const showPanel = open && query.trim().length > 0
  let lastGroup = ""

  return (
    <div ref={containerRef} className="relative">
      <label htmlFor="global-search" className="sr-only">
        Search Ufazien
      </label>
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none"
        aria-hidden="true"
      />
      <input
        id="global-search"
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Search pages, posts, people..."
        autoComplete="off"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls="global-search-results"
        aria-autocomplete="list"
        className="w-full sm:w-72 pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm placeholder-gray-400 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors"
      />

      {showPanel && (
        <div
          id="global-search-results"
          role="listbox"
          className="absolute right-0 mt-2 w-[22rem] sm:w-96 max-h-[70vh] overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg z-50"
        >
          {rows.length === 0 && (
            <p className="px-4 py-6 text-sm text-gray-500 text-center">
              {loading ? "Searching..." : `Nothing matches "${query.trim()}"`}
            </p>
          )}

          {rows.map((row, index) => {
            const header = row.group !== lastGroup ? row.group : null
            lastGroup = row.group
            return (
              <div key={row.key}>
                {header && (
                  <div className="px-3 pt-3 pb-1 text-xs font-medium text-gray-400 uppercase tracking-wide">
                    {header}
                  </div>
                )}
                <button
                  type="button"
                  role="option"
                  aria-selected={index === active}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => go(row)}
                  className={`w-full text-left px-3 py-2 flex items-start gap-3 cursor-pointer ${
                    index === active ? "bg-blue-50" : "hover:bg-gray-50"
                  }`}
                >
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-gray-900 truncate">{row.title}</span>
                    {row.subtitle && (
                      <span className="block text-xs text-gray-500 truncate">{row.subtitle}</span>
                    )}
                  </span>
                  {index === active && (
                    <CornerDownLeft className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" aria-hidden="true" />
                  )}
                </button>
              </div>
            )
          })}

          {loading && rows.length > 0 && (
            <p className="px-3 py-2 text-xs text-gray-400 border-t border-gray-100">Searching...</p>
          )}
        </div>
      )}
    </div>
  )
}
