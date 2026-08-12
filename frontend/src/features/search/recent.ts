export interface RecentItem {
  title: string
  url: string
  group: string
}

export const RECENT_KEY = "ufz:search:recent"

export const RECENT_LIMIT = 5

export interface RecentStore {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

function browserStore(): RecentStore | null {
  try {
    if (typeof localStorage === "undefined") return null
    return localStorage
  } catch {
    return null
  }
}

export function readRecents(store: RecentStore | null = browserStore()): RecentItem[] {
  if (!store) return []
  try {
    const raw = store.getItem(RECENT_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (item): item is RecentItem =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as RecentItem).title === "string" &&
          typeof (item as RecentItem).url === "string",
      )
      .map((item) => ({ title: item.title, url: item.url, group: item.group ?? "" }))
      .slice(0, RECENT_LIMIT)
  } catch {
    return []
  }
}

export function rememberRecent(
  item: RecentItem,
  store: RecentStore | null = browserStore(),
): RecentItem[] {
  const next = [item, ...readRecents(store).filter((seen) => seen.url !== item.url)].slice(
    0,
    RECENT_LIMIT,
  )
  if (store) {
    try {
      store.setItem(RECENT_KEY, JSON.stringify(next))
    } catch {
      return next
    }
  }
  return next
}
