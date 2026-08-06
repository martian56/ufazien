import { Helmet } from "react-helmet"
import { Link, useLocation } from "react-router-dom"
import { Compass } from "lucide-react"

/**
 * Shown for any URL the router does not match.
 *
 * There was no catch-all before, so an unknown address rendered a blank white
 * page: no message, no way back, and nothing to say whether the link was
 * wrong or the site was broken.
 */
export default function NotFound() {
  const location = useLocation()

  return (
    <>
      <Helmet>
        <title>Page not found | Ufazien</title>
      </Helmet>
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-lg text-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center mx-auto mb-6">
            <Compass className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">There is nothing at this address</h1>
          <p className="text-gray-600 mb-2">
            We could not find a page for <span className="font-mono text-gray-800">{location.pathname}</span>.
          </p>
          <p className="text-gray-500 mb-8">
            The link may be out of date, or the address may have a typo in it.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link
              to="/dashboard"
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Go to your dashboard
            </Link>
            <Link
              to="/"
              className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Back to the home page
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
