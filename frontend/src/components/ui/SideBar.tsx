import { BookOpen,Calculator,TrendingUp,PenTool,
  Users,Settings,LogOut,Calendar,Activity,X, Gamepad,
  Brain, Telescope, MessageSquare,
  HomeIcon
} from "lucide-react"

import { useNavigate } from "react-router-dom"

interface SideBarProps {
  isSidebarOpen: boolean
  setIsSidebarOpen: (open: boolean) => void
  /** Highlights the matching entry. Use the exact name from the nav below. */
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


export default function SideBar({ isSidebarOpen, setIsSidebarOpen, pageTitle, children }: SideBarProps) {
  const navigate = useNavigate();

  const handleLogout = () => {
    // Clear any stored authentication data
    localStorage.removeItem('access');
    localStorage.removeItem('refresh');
    // Navigate to login page
    navigate('/auth');
  };

  const sidebarItems = [
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


    return (

        <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg flex flex-col transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Ufazien
            </span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-1 rounded-md hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrolls, so a page panel below cannot push Sign Out off screen. */}
        <div className="flex-1 overflow-y-auto">
        <nav className="mt-6 px-3">
          {sidebarItems.map((item, index) => (
            <a
              key={index}
              href={item.url}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg mb-1 transition-colors ${
                item.name === pageTitle
                  ? "bg-blue-50 text-blue-600 border-r-2 border-blue-600"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.name}</span>
            </a>
          ))}
        </nav>

        {children}
        </div>

        <div className="p-4 border-t border-gray-200 shrink-0">
          <button onClick={handleLogout} className="flex items-center gap-3 w-full px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </aside>

    )
}