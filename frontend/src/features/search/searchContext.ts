import { createContext, useContext } from "react"

export interface SearchApi {
  isOpen: boolean
  open: () => void
  close: () => void
}

export const SearchContext = createContext<SearchApi | null>(null)

export function useSearch(): SearchApi {
  const value = useContext(SearchContext)
  if (!value) throw new Error("useSearch must be used inside <SearchProvider>")
  return value
}

export function isSearchShortcut(event: KeyboardEvent): boolean {
  if (!event.metaKey && !event.ctrlKey) return false
  if (event.altKey) return false
  return event.key.toLowerCase() === "k" || event.code === "KeyK"
}

export function onApplePlatform(agent: string): boolean {
  return /mac|iphone|ipad|ipod/i.test(agent)
}

export function shortcutLabel(agent: string): string {
  return onApplePlatform(agent) ? "⌘K" : "Ctrl K"
}
