import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"

import { SearchContext, isSearchShortcut } from "./searchContext"
import SearchPalette from "./SearchPalette"

export default function SearchProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isSearchShortcut(event)) return
      event.preventDefault()
      setIsOpen((wasOpen) => !wasOpen)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  const api = useMemo(() => ({ isOpen, open, close }), [isOpen, open, close])

  return (
    <SearchContext.Provider value={api}>
      {children}
      <SearchPalette />
    </SearchContext.Provider>
  )
}
