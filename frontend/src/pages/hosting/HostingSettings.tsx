import { Settings } from "lucide-react"
import { Helmet } from "react-helmet"
import { Link } from "react-router-dom"
import HostingSidebar from "../../components/hosting/HostingSidebar"

/**
 * Hosting settings.
 *
 * There is nothing configurable here yet, and this page used to spin a
 * loading indicator for a second before admitting that: a setTimeout with
 * "Simulate loading settings data" beside it, which loaded nothing. Waiting
 * to be told there is nothing to see is worse than being told immediately.
 *
 * It now says so straight away and points at the settings that do exist,
 * since this page is linked from the hosting sidebar and people arrive here
 * looking for something.
 */
export default function HostingSettings() {
  return (
    <>
      <Helmet>
        <title>Settings | Ufazien Hosting</title>
        <meta name="description" content="Configure your hosting preferences" />
      </Helmet>
      <div className="min-h-screen bg-white">
        <HostingSidebar />

        <div className="lg:ml-64">
          <div className="p-4 lg:p-6 pt-16 lg:pt-6">
            <div className="mb-8">
              <div className="flex items-center space-x-3 mb-4">
                <div className="bg-blue-100 rounded-lg p-2">
                  <Settings className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
                  <p className="mt-2 text-gray-600">Configure your hosting preferences</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-8 max-w-2xl">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nothing to configure here yet
              </h3>
              <p className="text-gray-600 mb-6">
                Hosting has no account-wide options of its own. Everything you can change
                lives with the site it belongs to, or in your account settings.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  to="/hosting/websites"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Your websites
                </Link>
                <Link
                  to="/settings"
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Account settings
                </Link>
              </div>
              <p className="text-sm text-gray-500 mt-6">
                A site's domain, environment variables and SSL are on its own Settings tab.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
