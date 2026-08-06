import { Eye } from "lucide-react"
import { formatDate, getLogIcon } from "./websiteFormat"
import type { Deployment, Website } from "../../utils/hostingApi"

interface WebsiteDeploymentsTabProps {
  deployments: Deployment[]
  onDeploy: () => void
}


/** Full deployment history for one website. */
export default function WebsiteDeploymentsTab({ deployments, onDeploy }: WebsiteDeploymentsTabProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Deployment History</h3>
        <button
          onClick={onDeploy}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          New Deployment
        </button>
      </div>
      <div className="divide-y divide-gray-200">
        {deployments.map((deployment) => (
          <div key={deployment.id} className="p-6 hover:bg-gray-50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {getLogIcon(deployment.status)}
                <div>
                  <p className="font-medium text-gray-900">
                    {deployment.commit_message || `Deployment ${deployment.status}`}
                  </p>
                  <p className="text-sm text-gray-600">
                    {deployment.started_at ? formatDate(deployment.started_at) : 'Unknown time'}
                  </p>
                  {deployment.commit_hash && (
                    <p className="text-xs text-gray-500">
                      Commit: {deployment.commit_hash.substring(0, 8)}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {deployment.deploy_time_seconds && (
                  <span className="text-sm text-gray-500">{deployment.deploy_time_seconds}s</span>
                )}
                <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            </div>
            {deployment.error_message && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{deployment.error_message}</p>
              </div>
            )}
          </div>
        ))}
        {deployments.length === 0 && (
          <div className="p-6 text-center">
            <p className="text-gray-500">No deployments yet</p>
            <button
              onClick={onDeploy}
              className="mt-2 text-blue-600 hover:text-blue-700"
            >
              Create your first deployment
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
