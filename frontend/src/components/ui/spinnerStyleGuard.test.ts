import { describe, expect, it } from "vitest"

/**
 * Guards the fix for #111.
 *
 * A lazy route shows the Suspense fallback while its chunk downloads, then the
 * page's own loading state while data arrives. When those were two different
 * shapes, the dashboard visibly swapped a 40px ring for a 48px arc part way
 * through, and it read as the loader breaking rather than as two phases.
 *
 * Sources come from import.meta.glob rather than node:fs so the test needs no
 * node types. The pattern is root-absolute on purpose: a relative one keys
 * same-directory files as "./Spinner.tsx" and deeper ones as "../../pages/...",
 * so an exclusion written in one form silently misses the other.
 */
const SOURCES = import.meta.glob("/src/**/*.tsx", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>

const COMPONENT = "/src/components/ui/Spinner.tsx"

// The campus simulator is being changed in parallel; its one remaining
// hand-rolled spinner is excluded so this does not fail on work it cannot see.
// Remove this entry once that has landed and been converted.
const EXCLUDED = ["/src/pages/game/CampusWithBackend.tsx"]

// Every className form the codebase actually uses. Matching only double-quoted
// literals would miss the template form, which is used, so a new hand-rolled
// spinner could slip straight past this guard.
const CLASS_ATTR = /className=(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\})/g

function classNamesIn(source: string): string[] {
  return [...source.matchAll(CLASS_ATTR)].map((m) => m[1] ?? m[2] ?? m[3] ?? "")
}

function isHandRolledSpinner(classes: string): boolean {
  // A div that spins and is round is a page loader someone rolled by hand.
  // A lucide icon that spins is an icon, not the page loader, and is fine.
  return classes.includes("animate-spin") && classes.includes("rounded-full")
}

describe("no second spinner style", () => {
  it("has no hand-rolled spinner outside the shared component", () => {
    const offenders: string[] = []

    for (const [path, source] of Object.entries(SOURCES)) {
      if (path === COMPONENT) continue
      if (path.includes(".test.")) continue
      if (EXCLUDED.includes(path)) continue

      for (const classes of classNamesIn(source)) {
        if (isHandRolledSpinner(classes)) offenders.push(`${path}: ${classes}`)
      }
      if (/<svg[^>]*animate-spin/.test(source)) {
        offenders.push(`${path}: inline svg spinner`)
      }
    }

    expect(offenders, `use <Spinner> instead of rolling one:\n${offenders.join("\n")}`).toEqual([])
  })

  it("actually scanned the source tree", () => {
    // Without this, a glob that silently matched nothing would look like a pass.
    expect(Object.keys(SOURCES).length).toBeGreaterThan(50)
    expect(SOURCES[COMPONENT], "the component itself must be in the glob").toBeTruthy()
  })

  it("recognises a spinner however its classes are written", () => {
    const detect = (src: string) => classNamesIn(src).some(isHandRolledSpinner)

    expect(detect('<div className="animate-spin rounded-full h-6 w-6" />')).toBe(true)
    expect(detect("<div className='animate-spin rounded-full h-6 w-6' />")).toBe(true)
    expect(detect("<div className={`animate-spin rounded-full ${size}`} />")).toBe(true)
    // A spinning icon is not a page loader and must not be flagged.
    expect(detect('<RefreshCw className="w-4 h-4 animate-spin" />')).toBe(false)
  })
})
