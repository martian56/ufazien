import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useNavigate } from "react-router-dom"
import {
  AlignLeft,
  BarChart3,
  Bell,
  BookOpen,
  Calculator,
  Calendar,
  CalendarDays,
  Clock,
  Compass,
  CornerDownLeft,
  CreditCard,
  Database,
  DatabaseZap,
  FilePlus2,
  FileText,
  Gamepad2,
  Globe,
  LayoutDashboard,
  type LucideIcon,
  MessageSquare,
  MessagesSquare,
  Network,
  Newspaper,
  PenLine,
  Repeat2,
  Rocket,
  ScrollText,
  Search,
  Server,
  Settings,
  ShieldCheck,
  Sigma,
  SlidersHorizontal,
  Sparkles,
  SpellCheck,
  Table2,
  User,
  Users,
  Wand2,
} from "lucide-react"

import { buildRows, shouldQueryRemote, step, type Row } from "./rows"
import type { IconName } from "./destinations"
import { readRecents, rememberRecent, type RecentItem } from "./recent"
import { useSearch, shortcutLabel } from "./searchContext"
import { searchApi, type SearchHit } from "../../lib/api/endpoints/search"
import { logger } from "../../lib/logger"

const DESTINATION_ICONS: Record<IconName, LucideIcon> = {
  dashboard: LayoutDashboard,
  user: User,
  bell: Bell,
  settings: Settings,
  feedback: MessageSquare,
  gpa: Calculator,
  average: Sigma,
  calendar: CalendarDays,
  campus: Gamepad2,
  blog: Newspaper,
  write: PenLine,
  community: Users,
  ai: Sparkles,
  humanize: Wand2,
  paraphrase: Repeat2,
  summarize: AlignLeft,
  grammar: SpellCheck,
  showcase: Compass,
  hosting: Server,
  website: Globe,
  newWebsite: FilePlus2,
  database: Database,
  newDatabase: DatabaseZap,
  domain: Network,
  analytics: BarChart3,
  ssl: ShieldCheck,
  logs: ScrollText,
  billing: CreditCard,
  hostingSettings: SlidersHorizontal,
  upgrade: Rocket,
}

const HIT_ICONS: Record<string, LucideIcon> = {
  blog: BookOpen,
  post: MessagesSquare,
  group: Users,
  forum: MessagesSquare,
  schema: Table2,
  event: Calendar,
  website: Globe,
  person: User,
}

function iconFor(row: Row): LucideIcon {
  if (row.hitType) return HIT_ICONS[row.hitType] ?? FileText
  if (row.kind === "recent") return Clock
  return row.icon ? DESTINATION_ICONS[row.icon] : BookOpen
}

export default function SearchPalette() {
  const { isOpen, close } = useSearch()
  const navigate = useNavigate()

  const [query, setQuery] = useState("")
  const [remote, setRemote] = useState<SearchHit[]>([])
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(0)
  const [recents, setRecents] = useState<RecentItem[]>([])

  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const returnFocusTo = useRef<HTMLElement | null>(null)

  const rows = useMemo(() => buildRows(query, recents, remote), [query, recents, remote])

  useEffect(() => {
    if (!isOpen) return
    returnFocusTo.current = document.activeElement as HTMLElement | null
    setQuery("")
    setRemote([])
    setActive(0)
    setRecents(readRecents())
    const focus = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(focus)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      returnFocusTo.current?.focus?.()
      returnFocusTo.current = null
      return
    }
    const { overflow } = document.body.style
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = overflow
    }
  }, [isOpen])

  useEffect(() => {
    setActive(0)
  }, [query])

  useEffect(() => {
    if (!isOpen) return
    if (!shouldQueryRemote(query)) {
      setRemote([])
      setLoading(false)
      return
    }
    const controller = new AbortController()
    setLoading(true)
    const id = setTimeout(() => {
      searchApi
        .query(query.trim(), controller.signal)
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
  }, [query, isOpen])

  useEffect(() => {
    const node = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)
    node?.scrollIntoView({ block: "nearest" })
  }, [active, rows.length])

  const go = useCallback(
    (row: Row) => {
      setRecents(rememberRecent({ title: row.title, url: row.url, group: row.group }))
      close()
      navigate(row.url)
    },
    [close, navigate],
  )

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault()
      close()
      return
    }
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActive((index) => step(index, 1, rows.length))
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setActive((index) => step(index, -1, rows.length))
    } else if (event.key === "Enter" && rows[active]) {
      event.preventDefault()
      go(rows[active])
    }
  }

  if (!isOpen) return null

  const hint = shortcutLabel(typeof navigator === "undefined" ? "" : navigator.userAgent)
  let lastGroup = ""

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-gray-900/40 backdrop-blur-sm sm:p-4 sm:pt-[10vh]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search Ufazien"
        onKeyDown={onKeyDown}
        className="flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[70vh] sm:max-w-xl sm:rounded-xl sm:border sm:border-gray-200"
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-gray-100 px-4">
          <Search className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search pages, posts, people"
            autoComplete="off"
            spellCheck={false}
            role="combobox"
            aria-expanded
            aria-controls="search-results"
            aria-autocomplete="list"
            aria-activedescendant={rows[active] ? `search-row-${active}` : undefined}
            className="min-w-0 flex-1 border-0 bg-transparent py-4 text-[15px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0"
          />
          <button
            type="button"
            onClick={close}
            className="shrink-0 rounded border border-gray-200 px-1.5 py-0.5 text-[11px] font-medium text-gray-400 transition hover:border-gray-300 hover:text-gray-600"
          >
            Esc
          </button>
        </div>

        <div ref={listRef} id="search-results" role="listbox" className="min-h-0 flex-1 overflow-y-auto py-2">
          {rows.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-gray-500">
              {loading ? "Searching" : `Nothing matches "${query.trim()}"`}
            </p>
          )}

          {rows.map((row, index) => {
            const header = row.group !== lastGroup ? row.group : null
            lastGroup = row.group
            const Icon = iconFor(row)
            const isActive = index === active
            return (
              <div key={row.key}>
                {header && (
                  <div className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                    {header}
                  </div>
                )}
                <button
                  type="button"
                  id={`search-row-${index}`}
                  data-index={index}
                  role="option"
                  aria-selected={isActive}
                  onMouseMove={() => setActive(index)}
                  onClick={() => go(row)}
                  className={`flex w-full items-center gap-3 px-4 py-2 text-left transition-colors ${
                    isActive ? "bg-blue-50" : "hover:bg-gray-50"
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 ${isActive ? "text-blue-600" : "text-gray-400"}`}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-gray-900">{row.title}</span>
                    {row.subtitle && (
                      <span className="block truncate text-xs text-gray-500">{row.subtitle}</span>
                    )}
                  </span>
                  {row.hint && (
                    <span className="shrink-0 text-[11px] text-gray-400">{row.hint}</span>
                  )}
                  {isActive && (
                    <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden="true" />
                  )}
                </button>
              </div>
            )
          })}
        </div>

        <div className="hidden shrink-0 items-center justify-between border-t border-gray-100 px-4 py-2 text-[11px] text-gray-400 sm:flex">
          <span className="flex items-center gap-3">
            <span>↑↓ to move</span>
            <span>↵ to open</span>
          </span>
          <span>{loading && rows.length > 0 ? "Searching" : hint}</span>
        </div>
      </div>
    </div>,
    document.body,
  )
}
