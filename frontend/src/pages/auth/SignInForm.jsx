"use client"

import { useState, useEffect } from "react"
import { Eye, EyeOff, Mail, Lock } from "lucide-react"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { Label } from "../../components/ui/label"
import { Checkbox } from "../../components/ui/checkbox"
import { useNavigate } from "react-router-dom"

const API_URL = import.meta.env.VITE_API_URL
const API_LOGIN = `${API_URL}/api/auth/login/`

export default function SignInForm() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    rememberMe: false,
  })
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const navigate = useNavigate()

  const validateForm = () => {
    const newErrors = {}

    if (!formData.email) {
      newErrors.email = "Email is required"
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address"
    }

    if (!formData.password) {
      newErrors.password = "Password is required"
    } else if (formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setApiError("")
    setSuccess(false)
    if (!validateForm()) return

    setIsLoading(true)

    try {
      const response = await fetch(API_LOGIN, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        let errorMsg = "Login failed."
        if (data && typeof data === "object") {
          errorMsg = Object.values(data).flat().join(" ")
        }
        setApiError(errorMsg)
        setIsLoading(false)
        return
      }
      setSuccess(true)
      // Store tokens if present. dj-rest-auth returns "access" and "refresh" if JWT is enabled
      if (data.access && data.refresh) {
        localStorage.setItem("access", data.access)
        localStorage.setItem("refresh", data.refresh)
        navigate("/dashboard")
      }
      // Optionally store user info
      // localStorage.setItem("user", JSON.stringify(data.user))

      // Optionally clear the form
      setFormData({
        email: "",
        password: "",
        rememberMe: false,
      })
    } catch (err) {
      setApiError("An error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="signin-email" className="text-sm font-medium text-gray-700">
          Email Address
        </Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            id="signin-email"
            type="email"
            placeholder="Enter your email"
            value={formData.email}
            onChange={(e) => handleInputChange("email", e.target.value)}
            className={`pl-10 ${errors.email ? "border-red-500 focus:border-red-500" : ""}`}
            aria-describedby={errors.email ? "email-error" : undefined}
          />
        </div>
        {errors.email && (
          <p id="email-error" className="text-sm text-red-600" role="alert">
            {errors.email}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="signin-password" className="text-sm font-medium text-gray-700">
          Password
        </Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            id="signin-password"
            type={showPassword ? "text" : "password"}
            placeholder="Enter your password"
            value={formData.password}
            onChange={(e) => handleInputChange("password", e.target.value)}
            className={`pl-10 pr-10 ${errors.password ? "border-red-500 focus:border-red-500" : ""}`}
            aria-describedby={errors.password ? "password-error" : undefined}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {errors.password && (
          <p id="password-error" className="text-sm text-red-600" role="alert">
            {errors.password}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="remember-me"
            checked={formData.rememberMe}
            onCheckedChange={(checked) => handleInputChange("rememberMe", checked)}
          />
          <Label htmlFor="remember-me" className="text-sm text-gray-600">
            Remember me
          </Label>
        </div>
        <button type="button" className="text-sm text-blue-600 hover:text-blue-800 font-medium">
          Forgot password?
        </button>
      </div>

      {apiError && (
        <div className="text-red-600 text-sm">{apiError}</div>
      )}
      {success && (
        <div className="text-green-600 text-sm">Signed in successfully!</div>
      )}

      <Button
        type="submit"
        disabled={isLoading}
        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium py-2.5 rounded-lg transition-all duration-200 transform hover:scale-[1.02] disabled:transform-none disabled:opacity-70"
      >
        {isLoading ? (
          <div className="flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
            Signing in...
          </div>
        ) : (
          "Sign In"
        )}
      </Button>
    </form>
  )
}