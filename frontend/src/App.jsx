import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import Home from "./pages/Home"
import AuthPage from "./pages/auth/AuthPage"
import Dashboard from "./pages/DashBoard"
import AverageCalculator from "./pages/apps/average/AverageCalculator"
import Blog from "./pages/apps/blog/Blog"
import GpaCalculator from "./pages/apps/gpa/GpaCalculator"
import Calendar from "./pages/apps/Calendar"
import Community from "./pages/apps/Community"
import Settings from "./pages/Settings"
import Notifications from "./pages/Notifications"
import BlogCreate from "./pages/apps/blog/BlogCreate"
import BlogRead from "./pages/apps/blog/BlogRead"
import ProtectedRoute from "./pages/auth/ProtectedRoute"
import UfazSimulation from "./pages/game/UfazSimulation"

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/auth" element={<AuthPage />} />
        {/* Protected routes */}
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
        <Route path="/simulation" element={<ProtectedRoute><UfazSimulation /></ProtectedRoute>} />
        {/* Add more routes as needed */}
      </Routes>
    </Router>
  )
}

export default App