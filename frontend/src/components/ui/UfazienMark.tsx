/**
 * The Ufazien mark: a U monogram in a rounded square.
 *
 * Drawn as a path rather than set in a font so it renders identically before
 * the webfont loads.
 */
export default function UfazienMark({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} role="img" aria-label="Ufazien">
      <rect width="32" height="32" rx="8" fill="#2563eb" />
      <path
        d="M11 9v8a5 5 0 0 0 10 0V9"
        fill="none"
        stroke="#ffffff"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}
