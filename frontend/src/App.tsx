import { lazy, Suspense } from "react"
import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import { SubscriptionProvider } from "./hooks/useSubscription"
import ProtectedRoute from "./pages/auth/ProtectedRoute"
import RouteFallback from "./components/ui/RouteFallback"
import Home from "./pages/Home"
import NotFound from "./pages/NotFound"

// Routes load on demand. Home and NotFound stay eager: Home is the first paint.
const AuthPage = lazy(() => import("./pages/auth/AuthPage"))
const Profile = lazy(() => import("./pages/Profile"))
const Dashboard = lazy(() => import("./pages/DashBoard"))
const Settings = lazy(() => import("./pages/Settings"))
const Notifications = lazy(() => import("./pages/Notifications"))
const Feedback = lazy(() => import("./pages/Feedback"))
const Terms = lazy(() => import("./pages/Terms"))
const Privacy = lazy(() => import("./pages/Privacy"))

const GpaCalculator = lazy(() => import("./pages/apps/gpa/GpaCalculator"))
const AverageCalculator = lazy(() => import("./pages/apps/average/AverageCalculator"))
const Calendar = lazy(() => import("./pages/apps/calendar/Calendar"))

const Blog = lazy(() => import("./pages/apps/blog/Blog"))
const BlogCreate = lazy(() => import("./pages/apps/blog/BlogCreate"))
const BlogRead = lazy(() => import("./pages/apps/blog/BlogRead"))

const Community = lazy(() => import("./pages/apps/community/Community"))
const PostDetail = lazy(() => import("./pages/community/PostDetail"))

const CampusSimulatorMenuV2 = lazy(() => import("./pages/game/CampusSimulatorMenuV2"))
const CampusWithBackend = lazy(() => import("./pages/game/CampusWithBackend"))

const AiToolsMenu = lazy(() => import("./pages/ai-tools/AiToolsMenu"))
const Humanizer = lazy(() => import("./pages/ai-tools/humanizer/Humanizer"))
const Paraphraser = lazy(() => import("./pages/ai-tools/paraphraser/Paraphraser"))
const Summarizer = lazy(() => import("./pages/ai-tools/summarizer/Summarizer"))
const GrammarAssistant = lazy(() => import("./pages/ai-tools/grammar/GrammarAssistant"))

const UserSites = lazy(() => import("./pages/hosting/UserSites"))
const Hosting = lazy(() => import("./pages/hosting/Hosting"))
const Websites = lazy(() => import("./pages/hosting/Websites"))
const WebsiteDetail = lazy(() => import("./pages/hosting/WebsiteDetail"))
const CreateWebsite = lazy(() => import("./pages/hosting/CreateWebsite"))
const Databases = lazy(() => import("./pages/hosting/Databases"))
const CreateDatabase = lazy(() => import("./pages/hosting/CreateDatabase"))
const Domains = lazy(() => import("./pages/hosting/Domains"))
const Analytics = lazy(() => import("./pages/hosting/Analytics"))
const SSL = lazy(() => import("./pages/hosting/SSL"))
const Logs = lazy(() => import("./pages/hosting/Logs"))
const Billing = lazy(() => import("./pages/hosting/Billing"))
const HostingSettings = lazy(() => import("./pages/hosting/HostingSettings"))
const Upgrade = lazy(() => import("./pages/hosting/Upgrade"))

// Wrapper component for hosting routes with subscription context
const HostingRoutes = () => (
  <SubscriptionProvider>
    <Routes>
      <Route path="" element={<ProtectedRoute><Hosting /></ProtectedRoute>} />
      <Route path="websites" element={<ProtectedRoute><Websites /></ProtectedRoute>} />
      <Route path="websites/create" element={<ProtectedRoute><CreateWebsite /></ProtectedRoute>} />
      <Route path="databases" element={<ProtectedRoute><Databases /></ProtectedRoute>} />
      <Route path="databases/create" element={<ProtectedRoute><CreateDatabase /></ProtectedRoute>} />
      <Route path="domains" element={<ProtectedRoute><Domains /></ProtectedRoute>} />
      <Route path="analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
      <Route path="ssl" element={<ProtectedRoute><SSL /></ProtectedRoute>} />
      <Route path="logs" element={<ProtectedRoute><Logs /></ProtectedRoute>} />
      <Route path="billing" element={<ProtectedRoute><Billing /></ProtectedRoute>} />
      <Route path="settings" element={<ProtectedRoute><HostingSettings /></ProtectedRoute>} />
      <Route path="website/:websiteId" element={<ProtectedRoute><WebsiteDetail /></ProtectedRoute>} />
      <Route path="upgrade" element={<ProtectedRoute><Upgrade /></ProtectedRoute>} />
    </Routes>
  </SubscriptionProvider>
)

function App() {
  return (
    <Router>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/auth" element={<AuthPage />} />
          {/* Protected routes */}
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/profile/:userId" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/gpa-calculator" element={<ProtectedRoute><GpaCalculator /></ProtectedRoute>} />
          <Route path="/average-calculator" element={<ProtectedRoute><AverageCalculator /></ProtectedRoute>} />
          <Route path="/blog" element={<ProtectedRoute><Blog /></ProtectedRoute>} />
          <Route path="/blog/new" element={<ProtectedRoute><BlogCreate /></ProtectedRoute>} />
          <Route path="/blog/:id" element={<ProtectedRoute><BlogRead /></ProtectedRoute>} />
          <Route path="/community" element={<ProtectedRoute><Community /></ProtectedRoute>} />
          <Route path="/community/posts/:postId" element={<ProtectedRoute><PostDetail /></ProtectedRoute>} />
          <Route path="/calendar" element={<ProtectedRoute><Calendar /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/feedback" element={<ProtectedRoute><Feedback /></ProtectedRoute>} />
          <Route path="/campus-simulator/:lobbyId" element={<ProtectedRoute><CampusWithBackend /></ProtectedRoute>} />
          <Route path="/campus-simulator" element={<ProtectedRoute><CampusSimulatorMenuV2 /></ProtectedRoute>} />
          <Route path="/ai-tools" element={<ProtectedRoute><AiToolsMenu /></ProtectedRoute>} />
          <Route path="/ai-tools/humanizer" element={<ProtectedRoute><Humanizer /></ProtectedRoute>} />
          <Route path="/ai-tools/paraphraser" element={<ProtectedRoute><Paraphraser /></ProtectedRoute>} />
          <Route path="/ai-tools/summarizer" element={<ProtectedRoute><Summarizer /></ProtectedRoute>} />
          <Route path="/ai-tools/grammar-checker" element={<ProtectedRoute><GrammarAssistant /></ProtectedRoute>} />
          <Route path="/user-sites" element={<ProtectedRoute><UserSites /></ProtectedRoute>} />
          {/* Hosting routes with subscription context */}
          <Route path="/hosting/*" element={<HostingRoutes />} />
          {/* Add more routes as needed */}
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          {/* Anything unmatched rendered a blank white page before this. */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </Router>
  )
}

export default App
