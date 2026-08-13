import { describe, it, expect } from 'vitest'

/**
 * No two source files may have paths that differ only in case.
 *
 * This is not a style rule. `NizamiDistrict.tsx` (the component) and
 * `nizamiDistrict.ts` (the survey data) once sat in this directory, and
 * `import NizamiDistrict from './NizamiDistrict'` resolved to different files
 * depending on whose machine it ran on. Vite tries `.ts` before `.tsx`, so on a
 * case-insensitive filesystem — every Windows and macOS machine — the extension
 * search matched the *data* module, which has no default export, and the campus
 * page went blank with a single console error.
 *
 * On Linux the two names are distinct, the `.ts` candidate genuinely does not
 * exist, and resolution falls through to the `.tsx`. So the app worked here,
 * every CI check passed, and it was dead for everyone reviewing it. That is the
 * worst shape a bug can have — green everywhere it is measured, broken
 * everywhere it is used — so it gets a test rather than a note.
 *
 * Asked through `import.meta.glob`, which is the bundler's own view of the
 * tree rather than a second opinion from `fs`.
 */

const FILES = Object.keys(import.meta.glob('/src/**/*.{ts,tsx,js,jsx,css}'))

describe('module names', () => {
  it('finds the source tree at all', () => {
    // A glob that silently matches nothing would make everything below pass.
    expect(FILES.length).toBeGreaterThan(20)
  })

  it('never differ only in case', () => {
    const seen = new Map<string, string>()
    const clashes: string[] = []

    for (const path of FILES) {
      const key = path.toLowerCase()
      const first = seen.get(key)
      if (first) clashes.push(`${first} and ${path}`)
      else seen.set(key, path)
    }

    expect(clashes).toEqual([])
  })

  it('never leave an extensionless import ambiguous', () => {
    // The same trap one step removed: `foo.ts` beside `foo.tsx` makes
    // `from './foo'` ambiguous, and which one wins is a resolver setting rather
    // than anything visible at the import site. Compared case-insensitively,
    // because that is the comparison the filesystem will make.
    const byStem = new Map<string, string[]>()

    for (const path of FILES) {
      const stem = path.replace(/\.(ts|tsx|js|jsx)$/, '').toLowerCase()
      if (stem === path.toLowerCase()) continue
      byStem.set(stem, [...(byStem.get(stem) ?? []), path])
    }

    const ambiguous = [...byStem.entries()]
      .filter(([, files]) => files.length > 1)
      .map(([stem, files]) => `${stem}: ${files.join(', ')}`)

    expect(ambiguous).toEqual([])
  })
})
