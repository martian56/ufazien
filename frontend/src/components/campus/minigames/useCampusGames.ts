import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  DASH_CHECKPOINTS,
  DASH_TIME_LIMIT,
  FREE_THROW_ATTEMPTS,
  MINIGAMES,
  TITRATION_ROUNDS,
  advanceDash,
  correctOrder,
  dashScore,
  makeShelf,
  newDashState,
  newShelfState,
  newThrowSession,
  pickBook,
  recordShot,
  shelfScore,
  throwSessionOver,
  titrationTarget,
  titrationVerdict,
  type DashState,
  type MinigameId,
  type ShelfBook,
  type ShelfState,
  type ThrowSession,
} from './minigameLogic'

/**
 * The mini-game session: which one is running, how it is going, and what the
 * HUD should say about it.
 *
 * State is split deliberately. Anything that changes on a discrete event — a
 * shot landing, a ring cleared, a book picked — is React state, because the
 * HUD has to re-render for it. Anything that changes every frame — the charge
 * meter, the clock, the volume in the burette — lives in a ref and is sampled
 * by the HUD at 12Hz. Putting the per-frame values in state instead would
 * re-render the entire page sixty times a second while you hold a key down.
 */

const STORAGE_KEY = 'ufazien.campus.bestScores'

export interface LiveValues {
  /** Free throws: 0..1 while the shot is charging. */
  charge: number
  /** Dash: seconds since the run started. */
  elapsed: number
  /** Titration: millilitres delivered this round. */
  delivered: number
  /** Whether the pour/charge key is currently down. */
  holding: boolean
}

export interface TitrationRun {
  round: number
  target: number
  total: number
  lastVerdict: string | null
}

export interface ShelfRun {
  books: ShelfBook[]
  state: ShelfState
  startedAt: number
}

function loadBest(): Partial<Record<MinigameId, number>> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    // Anything could be in local storage, including something another version
    // of this game wrote. Only take numbers for keys we know.
    if (!parsed || typeof parsed !== 'object') return {}
    const out: Partial<Record<MinigameId, number>> = {}
    for (const id of Object.keys(MINIGAMES) as MinigameId[]) {
      const value = (parsed as Record<string, unknown>)[id]
      if (typeof value === 'number' && Number.isFinite(value)) out[id] = value
    }
    return out
  } catch {
    return {}
  }
}

export function useCampusGames() {
  const [active, setActive] = useState<MinigameId | null>(null)
  const [throws, setThrows] = useState<ThrowSession>(newThrowSession)
  const [dash, setDash] = useState<DashState>(newDashState)
  const [titration, setTitration] = useState<TitrationRun | null>(null)
  const [shelf, setShelf] = useState<ShelfRun | null>(null)
  const [result, setResult] = useState<{ title: string; detail: string; score: number } | null>(null)
  const [best, setBest] = useState<Partial<Record<MinigameId, number>>>(() => loadBest())

  const live = useRef<LiveValues>({ charge: 0, elapsed: 0, delivered: 0, holding: false })
  /** Wall-clock start of the current run, for the dash and the shelf. */
  const startedAt = useRef(0)
  /** Seeds the titration targets, so every round of one run is reproducible. */
  const titrationSeed = useRef(0)

  /**
   * Records a personal best.
   *
   * The updater only computes the next value. React may call an updater more
   * than once — StrictMode does it deliberately in development — so writing to
   * local storage from inside one is a side effect that can run twice. The
   * write happens in an effect keyed to the result instead.
   */
  const recordBest = useCallback((id: MinigameId, score: number) => {
    setBest((previous) => ((previous[id] ?? 0) >= score ? previous : { ...previous, [id]: score }))
  }, [])

  const persisted = useRef(false)
  useEffect(() => {
    // Skip the first pass: that value came out of storage a moment ago.
    if (!persisted.current) {
      persisted.current = true
      return
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(best))
    } catch {
      // A full or blocked storage must not take the game down with it.
    }
  }, [best])

  const start = useCallback((id: MinigameId) => {
    setResult(null)
    setActive(id)
    live.current = { charge: 0, elapsed: 0, delivered: 0, holding: false }
    startedAt.current = performance.now()

    if (id === 'basketball') setThrows(newThrowSession())
    if (id === 'dash') setDash(newDashState())
    if (id === 'titration') {
      const seed = Math.floor(performance.now())
      titrationSeed.current = seed
      setTitration({ round: 0, target: titrationTarget(seed, 0), total: 0, lastVerdict: null })
    }
    if (id === 'booksort') {
      const books = makeShelf(Math.floor(performance.now()), 6)
      setShelf({ books, state: newShelfState(), startedAt: performance.now() })
    }
  }, [])

  const quit = useCallback(() => {
    setActive(null)
    live.current = { charge: 0, elapsed: 0, delivered: 0, holding: false }
  }, [])

  /* ---------------- free throws ---------------- */

  const takeShot = useCallback((made: boolean) => {
    setThrows((session) => recordShot(session, made))
  }, [])

  // The set ending is a property of the state, so it is watched rather than
  // detected inside the updater that produced it.
  useEffect(() => {
    if (active !== 'basketball' || !throwSessionOver(throws)) return
    recordBest('basketball', throws.score)
    setResult({
      title: throws.streak > 0 ? 'Buzzer beater!' : "That's the set",
      detail: `${throws.made}/${FREE_THROW_ATTEMPTS} made · best streak ${throws.bestStreak}`,
      score: throws.score,
    })
    setActive(null)
  }, [active, throws, recordBest])

  /* ---------------- dash ---------------- */

  const dashProgress = useCallback((x: number, z: number) => {
    const elapsed = (performance.now() - startedAt.current) / 1000
    live.current.elapsed = elapsed

    setDash((state) => {
      if (state.finished) return state
      if (elapsed > DASH_TIME_LIMIT) return { ...state, finished: true, running: false }
      return advanceDash(state, x, z, elapsed)
    })
  }, [])

  useEffect(() => {
    if (active !== 'dash' || !dash.finished) return
    // Cleared the last ring, or ran out of clock: the index says which.
    const complete = dash.index >= DASH_CHECKPOINTS.length
    const elapsed = dash.splits[dash.splits.length - 1] ?? live.current.elapsed

    if (complete) {
      const score = dashScore(elapsed)
      recordBest('dash', score)
      setResult({
        title: 'Course complete',
        detail: `${elapsed.toFixed(1)}s across the whole campus`,
        score,
      })
    } else {
      setResult({
        title: 'Out of time',
        detail: `${dash.index}/${DASH_CHECKPOINTS.length} rings cleared`,
        score: 0,
      })
    }
    setActive(null)
  }, [active, dash, recordBest])

  /* ---------------- titration ---------------- */

  const pourStop = useCallback(() => {
    const delivered = live.current.delivered
    live.current.delivered = 0

    setTitration((run) => {
      if (!run) return run
      const verdict = titrationVerdict(delivered, run.target)
      const round = run.round + 1
      return {
        round,
        target: titrationTarget(titrationSeed.current, round),
        total: run.total + verdict.score,
        lastVerdict: `${verdict.label} · ${verdict.score}%`,
      }
    })
  }, [])

  useEffect(() => {
    if (active !== 'titration' || !titration || titration.round < TITRATION_ROUNDS) return
    recordBest('titration', titration.total)
    setResult({
      title: titration.total >= TITRATION_ROUNDS * 80 ? 'Analytically sound' : 'Run complete',
      detail: `${TITRATION_ROUNDS} titrations · ${Math.round(titration.total / TITRATION_ROUNDS)}% average`,
      score: titration.total,
    })
    setActive(null)
    setTitration(null)
  }, [active, titration, recordBest])

  /* ---------------- shelf ---------------- */

  const pick = useCallback((id: number) => {
    setShelf((run) => {
      if (!run) return run
      const state = pickBook(run.state, run.books, id)
      return state === run.state ? run : { ...run, state }
    })
  }, [])

  useEffect(() => {
    if (active !== 'booksort' || !shelf?.state.done) return
    const seconds = (performance.now() - shelf.startedAt) / 1000
    const score = shelfScore(shelf.books.length, seconds, shelf.state.mistakes)
    recordBest('booksort', score)
    setResult({
      title: 'Shelf restored',
      detail: `${seconds.toFixed(1)}s · ${shelf.state.mistakes} mistake${shelf.state.mistakes === 1 ? '' : 's'}`,
      score,
    })
    setActive(null)
    setShelf(null)
  }, [active, shelf, recordBest])

  /** The id the shelf game wants picked next, for highlighting it after a slip. */
  const shelfExpecting = useMemo(() => {
    if (!shelf) return null
    return correctOrder(shelf.books)[shelf.state.picked.length] ?? null
  }, [shelf])

  /* ---------------- HUD sampling ---------------- */

  // Re-render the HUD often enough for the meters to look continuous, and no
  // more. Only while something is actually running.
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => setTick((t) => t + 1), 80)
    return () => clearInterval(timer)
  }, [active])

  return {
    active,
    start,
    quit,
    result,
    dismissResult: () => setResult(null),
    best,

    live,
    throws,
    takeShot,

    dash,
    dashProgress,

    titration,
    pourStop,

    shelf,
    shelfExpecting,
    pick,
  }
}

export type CampusGames = ReturnType<typeof useCampusGames>
