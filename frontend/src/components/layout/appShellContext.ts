import { createContext, useContext } from "react"
import type { ReactNode } from "react"

export interface AppShellApi {
  isSidebarOpen: boolean
  setIsSidebarOpen: (open: boolean) => void
  setSidebarPanel: (panel: ReactNode) => void
}

export const AppShellContext = createContext<AppShellApi | null>(null)

export function useAppShell(): AppShellApi {
  const value = useContext(AppShellContext)
  if (!value) throw new Error("useAppShell must be used inside <AppShell>")
  return value
}
