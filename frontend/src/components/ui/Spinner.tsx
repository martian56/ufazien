interface SpinnerProps {
  /** 16px inside buttons, 24px inline, 40px for a whole page or panel. */
  size?: "sm" | "md" | "lg"
  /** `onColor` for use on a filled button, where blue on blue is invisible. */
  tone?: "primary" | "onColor"
  className?: string
  label?: string
}

const SIZE = {
  sm: "h-4 w-4 border-2",
  md: "h-6 w-6 border-2",
  lg: "h-10 w-10 border-4",
} as const

const TONE = {
  primary: "border-blue-600 border-t-transparent",
  onColor: "border-white border-t-transparent",
} as const

/**
 * The one spinner.
 *
 * There used to be two shapes: a partial arc (`border-b-2`) and a ring with a
 * gap (`border-t-transparent`), in four sizes between them. A lazy route shows
 * the fallback spinner while its chunk downloads and then the page's own
 * spinner while data loads, so on the dashboard you watched a 40px ring turn
 * into a 48px arc and it read as the loader breaking halfway through.
 */
export default function Spinner({
  size = "md",
  tone = "primary",
  className = "",
  label,
}: SpinnerProps) {
  return (
    <span
      className={`inline-flex items-center gap-2 ${className}`}
      role="status"
      aria-live="polite"
    >
      <span
        className={`rounded-full animate-spin shrink-0 ${SIZE[size]} ${TONE[tone]}`}
        aria-hidden="true"
      />
      {label ? <span className="sr-only">{label}</span> : <span className="sr-only">Loading</span>}
    </span>
  )
}
