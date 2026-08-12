import { DESTINATIONS, matchDestinations, type Destination, type IconName } from "./destinations"
import type { RecentItem } from "./recent"
import type { SearchHit } from "../../lib/api/endpoints/search"

export type RowKind = "recent" | "destination" | "content"

export interface Row {
  key: string
  kind: RowKind
  group: string
  title: string
  subtitle: string
  url: string
  hitType?: string
  icon?: IconName
  hint?: string
}

export const RECENT_GROUP = "Recent"

export const PAGES_GROUP = "Pages"

export const MIN_REMOTE_QUERY = 2

function fromDestination(destination: Destination, ranked: boolean): Row {
  return {
    key: `page:${destination.url}`,
    kind: "destination",
    group: ranked ? PAGES_GROUP : destination.group,
    title: destination.title,
    subtitle: "",
    url: destination.url,
    icon: destination.icon,
    hint: ranked ? destination.group : undefined,
  }
}

export function buildRows(query: string, recents: RecentItem[], remote: SearchHit[]): Row[] {
  const trimmed = query.trim()

  if (!trimmed) {
    const recentRows: Row[] = recents.map((item) => ({
      key: `recent:${item.url}`,
      kind: "recent",
      group: RECENT_GROUP,
      title: item.title,
      subtitle: "",
      url: item.url,
    }))
    const seen = new Set(recentRows.map((row) => row.url))
    const rest = DESTINATIONS.filter((d) => !seen.has(d.url)).map((d) => fromDestination(d, false))
    return [...recentRows, ...rest]
  }

  const pages = matchDestinations(trimmed).map((d) => fromDestination(d, true))
  const content: Row[] = remote.map((hit, index) => ({
    key: `hit:${hit.type}:${hit.url}:${index}`,
    kind: "content",
    group: hit.label,
    title: hit.title,
    subtitle: hit.subtitle,
    url: hit.url,
    hitType: hit.type,
  }))
  return [...pages, ...content]
}

export function shouldQueryRemote(query: string): boolean {
  return query.trim().length >= MIN_REMOTE_QUERY
}

export function step(active: number, delta: number, length: number): number {
  if (length === 0) return 0
  return (active + delta + length) % length
}
