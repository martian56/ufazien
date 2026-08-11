import { describe, expect, it } from "vitest"

/**
 * Guards the fix for #111.
 *
 * A lazy route shows the Suspense fallback while its chunk downloads, then the
 * page's own loading state while data arrives. When those were two different
 * shapes, the dashboard visibly swapped a 40px ring for a 48px arc part way
 * through, and it read as the loader breaking rather than as two phases.
 *
 * Sources are pulled in with import.meta.glob rather than node:fs so the test
 * needs no node types and runs in the same environment as everything else.
 */
const SOURCES = import.meta.glob("../../**/*.tsx", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>

// The campus simulator is being changed in parallel; its one remaining
// hand-rolled spinner is excluded so this does not fail on work it cannot see.
// Remove this entry once that has landed and been converted.
const EXCLUDED = ["pages/game/CampusWithBackend.tsx"]

function normalise(path: string) {
  return path.replace(/^\.\.\/\.\.\//, "").replace(/\\/g, "/")
}

describe("no second spinner style", () => {
  it("has no hand-rolled spinner outside the shared component", () => {
    const offenders: string[] = []

    for (const [rawPath, source] of Object.entries(SOURCES)) {
      const path = normalise(rawPath)
      if (path === "components/ui/Spinner.tsx") continue
      if (path.includes(".test.")) continue
      if (EXCLUDED.includes(path)) continue

      // A div that spins and is round is a page loader someone rolled by hand.
      // Lucide icons that spin are fine: they are icons, not the page loader.
      for (const match of source.matchAll(/className="([^"]*animate-spin[^"]*)"/g)) {
        if (match[1].includes("rounded-full")) offenders.push(`${path}: ${match[1]}`)
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
  })
})
