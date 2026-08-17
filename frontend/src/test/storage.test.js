import { describe, expect, it } from 'vitest'
import { createStorage, installStorageIfMissing, isUsableStorage } from './storage'

describe('createStorage', () => {
  it('reads back nothing for a key never written', () => {
    expect(createStorage().getItem('absent')).toBeNull()
  })

  it('stores values as strings, the way Storage does', () => {
    const storage = createStorage()
    storage.setItem('n', 42)
    storage.setItem('o', null)
    expect(storage.getItem('n')).toBe('42')
    expect(storage.getItem('o')).toBe('null')
  })

  it('coerces keys too, so 1 and "1" are the same slot', () => {
    const storage = createStorage()
    storage.setItem(1, 'first')
    expect(storage.getItem('1')).toBe('first')
    expect(storage.length).toBe(1)
  })

  it('counts, indexes and empties', () => {
    const storage = createStorage()
    storage.setItem('a', '1')
    storage.setItem('b', '2')
    expect(storage.length).toBe(2)
    expect(storage.key(0)).toBe('a')
    expect(storage.key(1)).toBe('b')
    expect(storage.key(2)).toBeNull()
    expect(storage.key(-1)).toBeNull()

    storage.removeItem('a')
    expect(storage.getItem('a')).toBeNull()
    expect(storage.length).toBe(1)

    storage.clear()
    expect(storage.length).toBe(0)
    expect(storage.getItem('b')).toBeNull()
  })

  it('overwrites in place rather than appending', () => {
    const storage = createStorage()
    storage.setItem('k', 'one')
    storage.setItem('k', 'two')
    expect(storage.getItem('k')).toBe('two')
    expect(storage.length).toBe(1)
  })
})

describe('isUsableStorage', () => {
  it('accepts something that implements the methods', () => {
    expect(isUsableStorage(createStorage())).toBe(true)
  })

  it('rejects what Node 25 hands back without a backing file', () => {
    // An own accessor yielding a bare object: present, typeof 'object', and
    // unable to store anything. This is the exact shape that produced 615
    // failures reading `localStorage.clear is not a function`.
    expect(isUsableStorage({})).toBe(false)
  })

  it('rejects an object missing only one method', () => {
    const partial = createStorage()
    delete partial.clear
    expect(isUsableStorage(partial)).toBe(false)
  })

  it('rejects nothing at all', () => {
    expect(isUsableStorage(undefined)).toBe(false)
    expect(isUsableStorage(null)).toBe(false)
  })
})

describe('installStorageIfMissing', () => {
  it('replaces a storage that cannot store', () => {
    const target = { localStorage: {}, sessionStorage: {} }
    expect(installStorageIfMissing(target)).toEqual(['localStorage', 'sessionStorage'])
    target.localStorage.setItem('k', 'v')
    expect(target.localStorage.getItem('k')).toBe('v')
  })

  it('leaves a working storage alone', () => {
    const mine = createStorage()
    mine.setItem('keep', 'me')
    const target = { localStorage: mine, sessionStorage: createStorage() }
    expect(installStorageIfMissing(target)).toEqual([])
    expect(target.localStorage).toBe(mine)
    expect(target.localStorage.getItem('keep')).toBe('me')
  })

  it('survives a global whose getter throws', () => {
    const target = {}
    Object.defineProperty(target, 'localStorage', {
      get() {
        throw new Error('cannot open the backing file')
      },
      configurable: true,
    })
    expect(() => installStorageIfMissing(target)).not.toThrow()
    expect(target.localStorage.getItem('anything')).toBeNull()
  })

  it('gives the two storages separate contents', () => {
    const target = { localStorage: {}, sessionStorage: {} }
    installStorageIfMissing(target)
    target.localStorage.setItem('k', 'local')
    expect(target.sessionStorage.getItem('k')).toBeNull()
  })
})

describe('the environment the rest of the suite runs in', () => {
  it('has a localStorage that works, whichever Node this is', () => {
    localStorage.setItem('probe', 'value')
    expect(localStorage.getItem('probe')).toBe('value')
    localStorage.removeItem('probe')
    expect(localStorage.getItem('probe')).toBeNull()
  })

  it('has a sessionStorage that works too', () => {
    sessionStorage.setItem('probe', 'value')
    expect(sessionStorage.getItem('probe')).toBe('value')
  })
})
