"use client"

import { useState } from "react"
import { Button } from "../../components/ui/button"

import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google'
import axios from 'axios'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

export default function SocialAuth() {
  const [loadingProvider, setLoadingProvider] = useState(null)

  const handleSocialAuth = async (provider) => {
    setLoadingProvider(provider)

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500))

    console.log(`${provider} authentication`)
    setLoadingProvider(null)
  }

  const socialProviders = [
    {
      name: "Google",
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
      ),
      bgColor: "bg-white hover:bg-gray-50",
      textColor: "text-gray-700",
      borderColor: "border-gray-300",
    },
    {
      name: "Facebook",
      icon: (
        <svg className="w-5 h-5" fill="#1877F2" viewBox="0 0 24 24">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      ),
      bgColor: "bg-[#1877F2] hover:bg-[#166FE5]",
      textColor: "text-white",
      borderColor: "border-[#1877F2]",
    },
    {
      name: "GitHub",
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
        </svg>
      ),
      bgColor: "bg-gray-900 hover:bg-gray-800",
      textColor: "text-white",
      borderColor: "border-gray-900",
    },
  ]

  return (
    <div className="space-y-3">
      {socialProviders.map((provider) => (
        <Button
          key={provider.name}
          type="button"
          variant="outline"
          onClick={() => handleSocialAuth(provider.name)}
          disabled={loadingProvider !== null}
          className={`w-full ${provider.bgColor} ${provider.textColor} border ${provider.borderColor} font-medium py-2.5 rounded-lg transition-all duration-200 transform hover:scale-[1.02] disabled:transform-none disabled:opacity-70`}
        >
          {loadingProvider === provider.name ? (
            <div className="flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
              Connecting...
            </div>
          ) : (
            <div className="flex items-center justify-center">
              {provider.icon}
              <span className="ml-2">Continue with {provider.name}</span>
            </div>
          )}
        </Button>
      ))}
    </div>
  )
}
