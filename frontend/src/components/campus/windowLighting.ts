/** The three window shapes the campus facades use. */
export type WindowKind = 'arched' | 'square' | 'strip'

/** Where a window sits on a facade. */
export interface WindowPlacement {
  x: number
  y: number
  z: number
  ry: number
}

/**
 * Splits a facade's windows into the lit ones and the dark ones.
 *
 * `emissive` belongs to a material, not to an instance, so one instanced mesh
 * can only be all-glowing or all-dark. Rendering the two halves as two meshes
 * is what lets a building show a scattering of lit windows after dark instead
 * of a uniform grid of identical yellow rectangles.
 *
 * Deterministic in `(index, seed)`: a building has to look the same each time
 * you walk past it, and must not flicker between frames.
 */
export function splitLitWindows(items: WindowPlacement[], lit: boolean, seed: number) {
  if (!lit) return { onItems: [] as WindowPlacement[], offItems: items }

  const onItems: WindowPlacement[] = []
  const offItems: WindowPlacement[] = []
  for (let i = 0; i < items.length; i++) {
    // Knuth's multiplicative hash. `i % 3` would light every third window in a
    // visible stripe up the facade; this scatters them.
    const hash = Math.imul(i + seed, 2654435761) >>> 0
    if (hash % 100 < 55) onItems.push(items[i])
    else offItems.push(items[i])
  }
  return { onItems, offItems }
}
