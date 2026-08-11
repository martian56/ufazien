import { Suspense, useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import { Outlet, useLocation } from "react-router-dom"

import SideBar from "../ui/SideBar"
import RouteFallback from "../ui/RouteFallback"
import { AppShellContext, useAppShell } from "./appShellContext"

export default function AppShell() {
  const location = useLocation()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [sidebarPanel, setSidebarPanel] = useState<ReactNode>(null)

  useEffect(() => {
    setIsSidebarOpen(false)
    setSidebarPanel(null)
  }, [location.pathname])

  const api = useMemo(
    () => ({ isSidebarOpen, setIsSidebarOpen, setSidebarPanel }),
    [isSidebarOpen]
  )

  return (
    <AppShellContext.Provider value={api}>
      <div className="min-h-screen bg-white flex">
        <SideBar isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen}>
          {sidebarPanel}
        </SideBar>

        {isSidebarOpen && (
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 z-40 bg-gray-900/40 lg:hidden"
          />
        )}

        {/* Inside the shell, so a lazy page chunk cannot blank the sidebar. */}
        <div className="flex-1 flex flex-col min-w-0">
          <Suspense fallback={<RouteFallback />}>
            <Outlet />
          </Suspense>
        </div>
      </div>
    </AppShellContext.Provider>
  )
}

export function SidebarPanel({ children }: { children: ReactNode }) {
  const { setSidebarPanel } = useAppShell()
  useEffect(() => {
    setSidebarPanel(children)
    return () => setSidebarPanel(null)
  }, [children, setSidebarPanel])
  return null
}
