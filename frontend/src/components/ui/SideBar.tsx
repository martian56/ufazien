import { Calculator,TrendingUp,PenTool,
  Users,Settings,LogOut,Calendar,Activity,X, Gamepad,
  Brain, Telescope, MessageSquare,
  HomeIcon
} from "lucide-react"

import { Link, useLocation, useNavigate } from "react-router-dom"
import UfazienMark from "./UfazienMark"

interface SideBarProps {
  isSidebarOpen: boolean
  setIsSidebarOpen: (open: boolean) => void
  /**
   * Overrides the entry highlighted by the URL. Pages inside the shell should
   * not need this: the active entry is derived from the current path.
   */
  pageTitle?: string
  /**
   * Extra panel under the nav, for pages that want one there.
   *
   * Community and Calendar each grew their own copy of this whole sidebar so
   * they could add a panel, and both copies then fell behind: Calendar's was
   * missing six destinations and neither had a way to sign out.
   */
  children?: React.ReactNode
}

const SIDEBAR_ITEMS = [
  { name: "Dashboard", icon: Activity, url: "/dashboard" },
  { name: "GPA Calculator", icon: Calculator, url: "/gpa-calculator" },
  { name: "Average Calculator", icon: TrendingUp, url: "/average-calculator" },
  { name: "Campus Simulator", icon: Gamepad, url: "/campus-simulator" },
  { name: "Hosting", icon: HomeIcon, url: "/hosting" },
  { name: "AI Tools", icon: Brain, url: "/ai-tools" },
  { name: "Blog", icon: PenTool, url: "/blog" },
  { name: "User Sites", icon: Telescope, url: "/user-sites" },
  { name: "Community", icon: Users, url: "/community" },
  { name: "Calendar", icon: Calendar, url: "/calendar" },
  { name: "Feedback", icon: MessageSquare, url: "/feedback" },
  { name: "Settings", icon: Settings, url: "/settings" },
]

export default function SideBar({ isSidebarOpen, setIsSidebarOpen, pageTitle, children }: SideBarProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const handleLogout = () => {
    // Clear any stored authentication data
    localStorage.removeItem('access');
    localStorage.removeItem('refresh');
    // Navigate to login page
    navigate('/auth');
  };

  /** A detail page such as /blog/62 still belongs to its section. */
  const activeUrl = SIDEBAR_ITEMS
    .filter((item) => pathname === item.url || pathname.startsWith(item.url + "/"))
    .sort((a, b) => b.url.length - a.url.length)[0]?.url

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 flex flex-col transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen lg:z-auto ${
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="flex items-center justify-between h-16 px-6 shrink-0">
        <Link to="/dashboard" className="flex items-center gap-2.5">
          <UfazienMark className="w-8 h-8" />
          <span className="text-xl font-semibold tracking-tight text-gray-900">Ufazien</span>
        </Link>
        <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-1 rounded-md hover:bg-gray-100" aria-label="Close menu">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Scrolls, so a page panel below cannot push Sign Out off screen. */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <nav className="mt-3 px-3">
          {SIDEBAR_ITEMS.map((item) => {
            const isActive = pageTitle ? item.name === pageTitle : item.url === activeUrl
            return (
              <Link
                key={item.url}
                to={item.url}
                aria-current={isActive ? "page" : undefined}
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-1.5 rounded-lg mb-0.5 transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-600 border-r-2 border-blue-600"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.name}</span>
              </Link>
            )
          })}
        </nav>

        {children}
      </div>

      <div className="p-3 shrink-0">
        <button onClick={handleLogout} className="flex items-center gap-3 w-full px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Sign Out</span>
        </button>
      </div>
    </aside>
  )
}
