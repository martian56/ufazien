import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { installStorageIfMissing } from './storage'

// Node 25 broke every test that touches storage — 615 of them, all reporting
// `localStorage.clear is not a function`, which points at this file rather
// than at the cause and reads like the test setup is at fault.
//
// The cause is that Node 25 ships its own Web Storage: it defines
// `localStorage` on `globalThis` as an own accessor, and without
// `--localstorage-file` that accessor warns and hands back a bare object with
// none of the Storage methods on it. jsdom installs a real Storage on its
// window, but vitest's jsdom environment copies those onto `globalThis`, where
// Node's own property is already sitting, so jsdom's never lands. Node 24 has
// no such global, which is why the suite passes there and nowhere else.
//
// `.nvmrc` and `engines` say which Node this project is built for, but a
// contributor whose `node` is newer should get a working suite rather than 615
// failures, so a missing Storage is replaced with a working one.
installStorageIfMissing(globalThis)

// jsdom has no ResizeObserver, and recharts' ResponsiveContainer constructs one
// on mount — so any test that renders a chart dies with "ResizeObserver is not
// defined" before it can assert anything. A stub is enough: nothing here
// measures a layout, and jsdom reports every element as zero-sized anyway.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

afterEach(() => {
  cleanup()
  localStorage.clear()
  sessionStorage.clear()
  vi.restoreAllMocks()
})
