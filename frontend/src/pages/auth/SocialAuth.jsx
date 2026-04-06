"use client"

import { useState, useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { GoogleOAuthProvider, useGoogleLogin } from "@react-oauth/google"
import axios from "axios"
import { Button } from "../../components/ui/button"

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const FACEBOOK_APP_ID = import.meta.env.VITE_FACEBOOK_APP_ID
const API_URL = import.meta.env.VITE_API_URL

function GoogleLoginButton({ loadingProvider, setLoadingProvider }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const login = useGoogleLogin({
    flow: "auth-code",
    ux_mode: "popup",
    redirect_uri: "postmessage",
    onSuccess: async (codeResponse) => {
      console.log("Google login successful:", codeResponse)
      setLoadingProvider("Google")  
      try {
        const res = await axios.post(`${API_URL}/api/auth/google/login/`, {
          code: codeResponse.code,
        })

        console.log("Google login successful:", res.data)
        localStorage.setItem("access", res.data.access)
        localStorage.setItem("refresh", res.data.refresh)
        
        // Redirect to the original page or dashboard
        const redirectPath = searchParams.get("redirect") || "/dashboard"
        navigate(redirectPath)
      } catch (err) {
        console.error("Google login failed:", err.response?.data || err.message)
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
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
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

function FacebookLoginButton({ loadingProvider, setLoadingProvider }) {
  useEffect(() => {
    window.fbAsyncInit = function () {
      window.FB.init({
        appId: FACEBOOK_APP_ID,
        cookie: true,
        xfbml: true,
        version: "v18.0",
      });
    };

    if (!window.FB) {
      const fbScript = document.createElement("script");
      fbScript.src = "https://connect.facebook.net/en_US/sdk.js";
      fbScript.async = true;
      fbScript.defer = true;
      document.body.appendChild(fbScript);
    }
  }, []);

  const handleFacebookLogin = () => {
    setLoadingProvider("Facebook");
    window.FB.login(
      function (response) {
        if (response.authResponse) {
          axios
            .post("http://127.0.0.1:8000/api/dj-rest-auth/facebook/", {
              access_token: response.authResponse.accessToken,
            })
            .then((res) => {
              console.log("Facebook login success:", res.data)
              localStorage.setItem("access", res.data.access)
              localStorage.setItem("refresh", res.data.refresh)
            })
            .catch((err) => {
              console.error("Facebook login error:", err.response?.data || err.message)
            })
            .finally(() => setLoadingProvider(null));
        } else {
          console.error("User cancelled Facebook login or did not authorize.");
          setLoadingProvider(null);
        }
      },
      { scope: "public_profile,email" }
    );
  };

  return (
    <Button
      type="button"
      onClick={handleFacebookLogin}
      disabled={loadingProvider !== null}
      className="w-full bg-[#1877F2] text-white border border-[#1877F2] py-2.5 rounded-lg hover:bg-[#166FE5] transition-all"
    >
      {loadingProvider === "Facebook" ? (
        <div className="flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
          Connecting...
        </div>
      ) : (
        <div className="flex items-center justify-center">
          <svg className="w-5 h-5 mr-2" fill="#fff" viewBox="0 0 24 24">
            <path d="M24 12.073c0-6.627-5.373-12-12-12S0 5.446 0 12.073c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47H13.87v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
          Continue with Facebook
        </div>
      )}
    </Button>
  );
}

export default function SocialAuth() {
  const [loadingProvider, setLoadingProvider] = useState(null);

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <div className="space-y-3">
        <GoogleLoginButton loadingProvider={loadingProvider} setLoadingProvider={setLoadingProvider} />
        <FacebookLoginButton loadingProvider={loadingProvider} setLoadingProvider={setLoadingProvider} />
      </div>
    </GoogleOAuthProvider>
  );
}
