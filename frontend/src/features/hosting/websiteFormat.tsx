import { AlertCircle, CheckCircle, Clock, RefreshCw, Square } from "lucide-react"
import type { Website } from "../../utils/hostingApi"

/**
 * Formatting and status helpers shared by the website detail tabs.
 *
 * These were closures inside WebsiteDetail, which meant every tab extracted
 * from that page had to take them as props. They depend on nothing but their
 * arguments, so they live here instead and each tab imports what it needs.
 */

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function formatStorage(mb: number | null | undefined): string {
  const storage = mb || 0
  if (storage < 1024) return `${storage.toFixed(1)} MB`
  return `${(storage / 1024).toFixed(1)} GB`
}

/** The website's own address, falling back to the generated subdomain. */
export function getWebsiteUrl(website: Website | null | undefined): string {
  if (website?.domain?.name) return website.domain.name
  return `${website?.name?.toLowerCase().replace(/\s+/g, "-")}.ufazien.com`
}

export function getSSLStatus(website: Website | null | undefined): boolean {
  return website?.domain?.ssl_enabled || false
}

export function getStatusIcon(status: string | undefined) {
  switch (status) {
    case "active":
      return <CheckCircle className="w-5 h-5 text-green-600" />
    case "building":
      return <RefreshCw className="w-5 h-5 text-yellow-600 animate-spin" />
    case "inactive":
      return <Square className="w-5 h-5 text-gray-400" />
    default:
      return <AlertCircle className="w-5 h-5 text-red-600" />
  }
}

export function getLogIcon(status: string | undefined) {
  switch (status) {
    case "success":
    case "completed":
      return <CheckCircle className="w-4 h-4 text-green-600" />
    case "error":
    case "failed":
      return <AlertCircle className="w-4 h-4 text-red-600" />
    case "building":
    case "queued":
      return <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
    default:
      return <Clock className="w-4 h-4 text-gray-400" />
  }
}
