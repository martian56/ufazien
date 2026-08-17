/**
 * A minimal in-memory Web Storage, for environments that define `localStorage`
 * without implementing it. See `setup.js` for which environments those are.
 *
 * Faithful to the spec for the method API: keys and values are coerced to
 * strings, a missing key reads back as `null`, `key(n)` follows insertion
 * order, and `length` counts what is stored. It does *not* support property
 * access (`storage.token`), which real Storage exposes through a proxy — no
 * code in this app uses storage that way, and a stub that quietly half-worked
 * would be worse than one with a stated edge.
 */

export function createStorage() {
  const entries = new Map()
  return {
    get length() {
      return entries.size
    },
    key(index) {
      const n = Math.trunc(Number(index)) || 0
      if (n < 0 || n >= entries.size) return null
      return [...entries.keys()][n]
    },
    getItem(key) {
      const k = String(key)
      return entries.has(k) ? entries.get(k) : null
    },
    setItem(key, value) {
      entries.set(String(key), String(value))
    },
    removeItem(key) {
      entries.delete(String(key))
    },
    clear() {
      entries.clear()
    },
  }
}

/** Whether `candidate` is a Storage that can actually store anything. */
export function isUsableStorage(candidate) {
  if (!candidate || typeof candidate !== 'object') return false
  return ['getItem', 'setItem', 'removeItem', 'clear'].every(
    (method) => typeof candidate[method] === 'function',
  )
}

/**
 * Replaces `localStorage` and `sessionStorage` on `target` when what is there
 * cannot store anything. A working Storage — jsdom's, or a browser's — is left
 * alone, so this is inert on the Node the project is built for.
 *
 * Returns the names it replaced, which is what the tests assert on.
 */
export function installStorageIfMissing(target) {
  const replaced = []
  for (const name of ['localStorage', 'sessionStorage']) {
    let existing
    try {
      existing = target[name]
    } catch {
      // Node's accessor throws rather than returning when it cannot open its
      // backing file, and a throwing global is as unusable as an empty one.
      existing = undefined
    }
    if (isUsableStorage(existing)) continue
    Object.defineProperty(target, name, {
      value: createStorage(),
      configurable: true,
      writable: true,
    })
    replaced.push(name)
  }
  return replaced
}
