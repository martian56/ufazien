import { Helmet } from "react-helmet"
import HostingSidebar from "../../components/hosting/HostingSidebar"

import type React from "react"

interface HostingPageProps {
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}

export default function HostingPage({ title, description, icon: Icon, children }: HostingPageProps) {
  return (
    <>
      <Helmet>
        <title>{title} | Ufazien Hosting</title>
        <meta name="description" content={description} />
      </Helmet>
      <div className="min-h-screen bg-gray-50">
        <HostingSidebar />
        
        <div className="lg:ml-64">
          <div className="p-4 lg:p-6 pt-16 lg:pt-6">{/* Added top padding for mobile menu button */}
            <div className="mb-8">
              <div className="flex items-center space-x-3 mb-4">
                {Icon && (
                  <div className="bg-blue-100 rounded-lg p-2">
                    <Icon className="h-6 w-6 text-blue-600" />
                  </div>
                )}
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
                  <p className="mt-2 text-gray-600">{description}</p>
                </div>
              </div>
            </div>
            
            {children || (
              <div className="text-center py-12">
                <div className="bg-gray-100 rounded-lg p-8">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Coming Soon</h3>
                  <p className="text-gray-600">This feature is currently under development.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
