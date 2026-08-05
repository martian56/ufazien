import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import { SubscriptionProvider } from "./hooks/useSubscription.jsx"
import Home from "./pages/Home"
import Profile from "./pages/Profile"
import AuthPage from "./pages/auth/AuthPage"
import Dashboard from "./pages/DashBoard"
import AverageCalculator from "./pages/apps/average/AverageCalculator"
import Blog from "./pages/apps/blog/Blog"
import GpaCalculator from "./pages/apps/gpa/GpaCalculator"
import Calendar from "./pages/apps/calendar/Calendar"
import Community from "./pages/apps/community/Community"
import Settings from "./pages/Settings"
import Notifications from "./pages/Notifications"
import Feedback from "./pages/Feedback"
import BlogCreate from "./pages/apps/blog/BlogCreate"
import BlogRead from "./pages/apps/blog/BlogRead"
import ProtectedRoute from "./pages/auth/ProtectedRoute"
import CampusSimulatorMenuV2 from "./pages/game/CampusSimulatorMenuV2"
import CampusWithBackend from "./pages/game/CampusWithBackend"
import AiToolsMenu from "./pages/ai-tools/AiToolsMenu"
import Humanizer from "./pages/ai-tools/humanizer/Humanizer"
import Hosting from "./pages/hosting/Hosting"
import WebsiteDetail from "./pages/hosting/WebsiteDetail"
import Websites from "./pages/hosting/Websites"
import Databases from "./pages/hosting/Databases"
import Analytics from "./pages/hosting/Analytics"
import Domains from "./pages/hosting/Domains"
import SSL from "./pages/hosting/SSL"
import HostingSettings from "./pages/hosting/HostingSettings"
import CreateWebsite from "./pages/hosting/CreateWebsite"
import Logs from "./pages/hosting/Logs"
import Billing from "./pages/hosting/Billing"
import Upgrade from "./pages/hosting/Upgrade"
import ApiTest from "./components/ApiTest"
import CreateDatabase from "./pages/hosting/CreateDatabase.jsx"
import UserSites from "./pages/hosting/UserSites.jsx"
import Terms from "./pages/Terms.jsx"
import Privacy from "./pages/Privacy.jsx"

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
        <Route path="/calendar" element={<ProtectedRoute><Calendar /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="/feedback" element={<ProtectedRoute><Feedback /></ProtectedRoute>} />
        <Route path="/campus-simulator/:lobbyId" element={<ProtectedRoute><CampusWithBackend /></ProtectedRoute>} />
        <Route path="/campus-simulator" element={<ProtectedRoute><CampusSimulatorMenuV2 /></ProtectedRoute>} />
        <Route path="/ai-tools" element={<ProtectedRoute><AiToolsMenu /></ProtectedRoute>} />
        <Route path="/ai-tools/humanizer" element={<ProtectedRoute><Humanizer /></ProtectedRoute>} />
        <Route path="/user-sites" element={<ProtectedRoute><UserSites /></ProtectedRoute>} />
        <Route path="/api-test" element={<ApiTest />} />
        {/* Hosting routes with subscription context */}
        <Route path="/hosting/*" element={<HostingRoutes />} />
        {/* Add more routes as needed */}
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
      </Routes>
    </Router>
  )
}

export default App