"use client"

import { useState } from "react"
import SignInForm from "./SignInForm"
import SignUpForm from "./SignUpForm"
import SocialAuth from "./SocialAuth"

export default function AuthPage() {
  const [activeTab, setActiveTab] = useState("signin")

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Ufazien Web</h1>
          <p className="text-gray-600">A palce for ufaziens</p>
        </div>

        {/* Auth Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          {/* Tab Navigation */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab("signin")}
              className={`flex-1 py-4 px-6 text-sm font-medium transition-all duration-200 relative ${
                activeTab === "signin"
                  ? "text-blue-600 bg-blue-50"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              Sign In
              {activeTab === "signin" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 transition-all duration-300" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("signup")}
              className={`flex-1 py-4 px-6 text-sm font-medium transition-all duration-200 relative ${
                activeTab === "signup"
                  ? "text-blue-600 bg-blue-50"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              Sign Up
              {activeTab === "signup" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 transition-all duration-300" />
              )}
            </button>
          </div>

          {/* Form Content */}
          <div className="p-6">
            <div
              className={`transition-all duration-300 ${activeTab === "signin" ? "opacity-100" : "opacity-0 hidden"}`}
            >
              {activeTab === "signin" && <SignInForm />}
            </div>
            <div
              className={`transition-all duration-300 ${activeTab === "signup" ? "opacity-100" : "opacity-0 hidden"}`}
            >
              {activeTab === "signup" && <SignUpForm />}
            </div>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Or continue with</span>
              </div>
            </div>

            {/* Social Auth */}
            <SocialAuth />
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-sm text-gray-500">
          <p>By continuing, you agree to our Terms of Service and Privacy Policy</p>
        </div>
      </div>
    </div>
  )
}
