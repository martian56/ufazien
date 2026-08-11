import Spinner from "../../components/ui/Spinner"
/** Shown while a lazy route's chunk downloads. */
export default function RouteFallback() {
  return (
    <div
      className="min-h-screen bg-white flex items-center justify-center"
      role="status"
      aria-live="polite"
    >
      <div className="text-center">
        <Spinner size="lg" className="mx-auto mb-3" />
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    </div>
  )
}
