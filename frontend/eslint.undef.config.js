import globals from 'globals'
import react from 'eslint-plugin-react'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

/**
 * Undefined-identifier check, run as its own CI gate.
 *
 * A reference to something that does not exist throws ReferenceError the moment
 * its code path runs, and the bundler does not catch it: the build was green
 * while eight upload error paths, a saved-calculation click and a follow button
 * were all guaranteed to crash.
 *
 * The main lint config reports 200 pre-existing style problems, so it runs with
 * continue-on-error and this class of bug hid in the noise. This config enables
 * only the two rules that catch it, so it can fail the build on its own.
 *
 * Both rules are needed. `no-undef` does not see JSX element names: a component
 * used as `<Minus />` without an import passes it cleanly and then throws in the
 * browser, which is exactly what happened when the reading settings panel was
 * split out of BlogRead. `react/jsx-no-undef` is what covers that half.
 */
const shared = {
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    globals: { ...globals.browser, ...globals.node },
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
  plugins: { react },
  rules: {
    'no-undef': 'error',
    'react/jsx-no-undef': 'error',
  },
}

export default defineConfig([
  globalIgnores(['dist', 'node_modules']),
  {
    files: ['**/*.{js,jsx}'],
    ...shared,
  },
  {
    files: ['**/*.{ts,tsx}'],
    ...shared,
    languageOptions: {
      ...shared.languageOptions,
      parser: tseslint.parser,
    },
    rules: {
      // TypeScript already rejects unknown identifiers at compile time, and
      // no-undef misreads type-only names as undefined values. jsx-no-undef
      // stays on: it is cheap and does not have that problem.
      'no-undef': 'off',
      'react/jsx-no-undef': 'error',
    },
  },
])
