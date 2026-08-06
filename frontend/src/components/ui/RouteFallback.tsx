/** Shown while a lazy route's chunk downloads. */
export default function RouteFallback() {
  return (
    <div
      className="min-h-screen bg-gray-50 flex items-center justify-center"
      role="status"
      aria-live="polite"
    >
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    </div>
  )
}
