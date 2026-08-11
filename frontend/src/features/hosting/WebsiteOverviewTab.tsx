import { formatDate, getLogIcon, getSSLStatus, getStatusIcon } from "./websiteFormat"
import type { Deployment, Website } from "../../utils/hostingApi"

interface WebsiteOverviewTabProps {
  website: Website
  deployments: Deployment[]
  onDeploy: () => void
  onViewLogs: () => void
}


/** Deployment status and recent activity, the tab the page opens on. */
export default function WebsiteOverviewTab({ website, deployments, onDeploy, onViewLogs }: WebsiteOverviewTabProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Deployment Status</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Status</span>
            <div className="flex items-center">
              {getStatusIcon(website.status)}
              <span className="ml-2 text-sm capitalize">{website.status}</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Type</span>
            <span className="text-sm text-gray-600 capitalize">{website.website_type || 'static'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Last Deployment</span>
            <span className="text-sm text-gray-600">
              {website.last_deployment ? formatDate(website.last_deployment) : 'Never'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">SSL Certificate</span>
            <span className={`text-sm ${getSSLStatus(website) ? 'text-green-600' : 'text-red-600'}`}>
              {getSSLStatus(website) ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        <div className="mt-6 flex space-x-3">
          <button
            onClick={onDeploy}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Deploy Now
          </button>
          <button
            onClick={onViewLogs}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            View Logs
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
        <div className="space-y-4">
          {deployments.slice(0, 4).map((deployment) => (
            <div key={deployment.id} className="flex items-start space-x-3">
              <div className="flex-shrink-0 mt-0.5">
                {getLogIcon(deployment.status)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900">
                  {deployment.commit_message || `Deployment ${deployment.status}`}
                </p>
                <p className="text-xs text-gray-500">
                  {deployment.started_at ? formatDate(deployment.started_at) : 'Unknown time'}
                </p>
              </div>
              {deployment.deploy_time_seconds && (
                <span className="text-xs text-gray-500">{deployment.deploy_time_seconds}s</span>
              )}
            </div>
          ))}
          {deployments.length === 0 && (
            <p className="text-sm text-gray-500">No deployment history available</p>
          )}
        </div>
      </div>
    </div>
  )
}
