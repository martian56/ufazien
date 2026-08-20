"use client"

import { Component, useState, useEffect, type ReactNode } from "react"
import { api } from "../../lib/api/client"
import { setTokens } from "../../lib/api/tokens"
import { useNavigate, useSearchParams } from "react-router-dom"
import { GoogleOAuthProvider, useGoogleLogin } from "@react-oauth/google"
import { Button } from "../../components/ui/button"
import Spinner from "../../components/ui/Spinner"

/**
 * Google's OAuth client, from the environment.
 *
 * Unset in a fresh clone: `frontend/.env.example` declares it but CONTRIBUTING
 * never said to copy it, so following the setup to the letter left it
 * undefined. Google Identity Services is then handed `client_id: undefined`,
 * throws from inside its own minified code, and — with nothing catching it —
 * React unmounts the whole tree. The sign-in page went blank, including the
 * email and password form, which has nothing to do with Google. It worked in
 * production because the deployment sets the variable.
 */
const GOOGLE_CLIENT_ID: string | undefined = import.meta.env.VITE_GOOGLE_CLIENT_ID

interface ProviderButtonProps {
  loadingProvider: string | null
  setLoadingProvider: (provider: string | null) => void
}

/** The Facebook SDK attaches itself to window; declare what we touch. */
declare global {
  interface Window {
    fbAsyncInit?: () => void
    FB?: {
      init: (options: Record<string, unknown>) => void
      login: (callback: (response: unknown) => void, options?: Record<string, unknown>) => void
    }
  }
}

function GoogleLoginButton({ loadingProvider, setLoadingProvider }: ProviderButtonProps) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const login = useGoogleLogin({
    flow: "auth-code",
    ux_mode: "popup",
    redirect_uri: "postmessage",
    onSuccess: async (codeResponse) => {
      setLoadingProvider("Google")  
      try {
        // anonymous: signing in must not send a stale token, and the client
        // returns parsed JSON rather than an axios {data} envelope.
        const data = await api.post<{ access: string; refresh: string }>(
          "/auth/google/login/",
          { code: codeResponse.code },
          { anonymous: true },
        )

        setTokens(data.access, data.refresh)
        
        // Redirect to the original page or dashboard
        const redirectPath = searchParams.get("redirect") || "/dashboard"
        navigate(redirectPath)
      } catch {
        setLoadingProvider(null)
      } finally {
        setLoadingProvider(null)
      }
    },
    onError: () => {
      console.error("Google login failed")
      setLoadingProvider(null)
    },
  })

  return (
    <Button
      onClick={login}
      disabled={loadingProvider !== null}
      className="w-full bg-white text-gray-700 border border-gray-300 font-medium py-2.5 rounded-lg hover:bg-gray-50 transition-all"
    >
      {loadingProvider === "Google" ? (
        <div className="flex items-center justify-center">
          <Spinner size="sm" className="mr-2" />
          Connecting...
        </div>
      ) : (
        <div className="flex items-center justify-center">
          <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
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
          <span>Continue with Google</span>
        </div>
      )}
    </Button>
  )
}

/* The Facebook button lived here. It posted to a hardcoded
   http://127.0.0.1:8000/api/dj-rest-auth/facebook/ — someone's own machine in
   production — and that endpoint does not exist in this backend at all: no
   dj-rest-auth, no allauth, no facebook view. It could not succeed anywhere.
   Google sign-in is real and stays. */

/**
 * Whether a client id is one you could actually sign in with.
 *
 * Takes the id rather than reading the environment, so that "nobody
 * configured this" is expressible in a test. A default parameter could not
 * say it: passing `undefined` explicitly triggers the default, so the absent
 * case would silently read whatever the environment happened to hold.
 */
export function isClientIdUsable(clientId: string | undefined): boolean {
  return typeof clientId === "string" && clientId.trim().length > 0
}

/** Whether social sign-in is configured in this build. */
export function socialAuthConfigured(): boolean {
  return isClientIdUsable(GOOGLE_CLIENT_ID)
}

/**
 * Keeps a broken social button from taking the sign-in page with it.
 *
 * Signing in with an email address does not involve Google, and must not stop
 * working because Google's script is unhappy — a malformed client id throws
 * from inside its code just as an absent one does, and this component cannot
 * validate what it is given. So a failure here costs the buttons and nothing
 * else.
 */
class SocialAuthBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error("Social sign-in is unavailable:", error)
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}

export default function SocialAuth() {
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);

  // Nothing to offer without a client id, and offering it anyway is what broke
  // the page. Email and password sign-in stands on its own.
  if (!socialAuthConfigured()) return null

  return (
    <SocialAuthBoundary>
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID as string}>
        <div className="space-y-3">
          <GoogleLoginButton loadingProvider={loadingProvider} setLoadingProvider={setLoadingProvider} />
        </div>
      </GoogleOAuthProvider>
    </SocialAuthBoundary>
  );
}
