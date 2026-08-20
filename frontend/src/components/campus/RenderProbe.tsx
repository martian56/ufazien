import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'

/**
 * Measures what the campus costs to draw, at fixed places.
 *
 * The rule this project works to is "instance it or don't ship it", and the
 * rule under that is that a claim about cost has to be a number. Nothing read
 * `gl.info.render.calls` before this, so every judgement about whether a change
 * was affordable came down to how it looked — which has been wrong here more
 * than once, and is about to matter a great deal more, because models are
 * arriving to replace geometry that is currently generated and instanced.
 *
 * ## Using it
 *
 * Add `?probe=1` to the campus URL. The camera is moved to each viewpoint in
 * turn, a frame is allowed to settle, and the renderer's own counters are read
 * and left on `window.__campusProbe`:
 *
 *     JSON.stringify(window.__campusProbe, null, 2)
 *
 * The player is not moved and nothing is saved: the camera is put back where it
 * was when the sweep finishes. It is a measurement, not a mode.
 *
 * ## Why it is in the app rather than a script
 *
 * The numbers only mean anything inside the real scene graph, with the real
 * materials, the real instancing and the real frustum. A standalone harness
 * would measure a different campus.
 *
 * Development only — `import.meta.env.DEV` guards the mount, so this cannot
 * ship even if a URL carrying the flag is shared.
 */

/** Where to stand, and what each viewpoint is for. */
export interface Viewpoint {
  name: string
  position: [number, number, number]
  /** What the camera looks at, so the frustum is the same every run. */
  lookAt: [number, number, number]
}

export const PROBE_VIEWPOINTS: Viewpoint[] = [
  // The first thing anybody sees, and the widest outdoor view: the whole quad,
  // the facade, both rows of trees.
  { name: 'spawn', position: [0, 1.7, 12], lookAt: [0, 1.7, -40] },
  // Across the quad with the district behind the building — the heaviest
  // outdoor frame, and where scattered props will show up first.
  { name: 'quad-north', position: [0, 1.7, -30], lookAt: [0, 6, -90] },
  // Down the length of the campus, so the tree scatter is edge on and most of
  // it is in frustum at once.
  { name: 'spine-south', position: [0, 1.7, 60], lookAt: [0, 1.7, -60] },
  // The interior with the most in it, and the one place furniture is drawn per
  // object rather than instanced.
  //
  // Only measures the interior if the player is *already inside* when the sweep
  // runs — the campus draws one or the other, and moving the camera does not
  // move the player. Run from the quad this is a fourth outdoor sample and
  // should be read as one.
  { name: 'interior-if-indoors', position: [0, 1.7, 8], lookAt: [0, 1.7, -20] },
]

export interface ProbeSample {
  name: string
  calls: number
  triangles: number
  geometries: number
  textures: number
  programs: number
}

declare global {
  interface Window {
    __campusProbe?: ProbeSample[]
  }
}

export default function RenderProbe({ viewpoints = PROBE_VIEWPOINTS }: { viewpoints?: Viewpoint[] }) {
  const { gl, camera } = useThree()
  const done = useRef(false)

  useEffect(() => {
    if (done.current) return
    done.current = true

    const samples: ProbeSample[] = []
    const home = camera.position.clone()
    const quat = camera.quaternion.clone()

    let index = 0
    let raf = 0
    // Frames to let the scene finish arriving before measuring it. The campus
    // streams in — avatars, textures, the district — and a sweep that starts on
    // mount measures an empty renderer and reports zero for everything, which
    // is worse than not measuring at all because it looks like an answer.
    let warmup = 90
    // Two frames per viewpoint: one to draw it, one to read counters that
    // describe that draw. Reading in the same frame as the move gives the
    // previous viewpoint's numbers, which is the kind of off-by-one that makes
    // a measurement worse than none.
    let settle = 0

    const step = () => {
      if (warmup > 0) {
        // Not just a fixed wait: hold until something is actually being drawn,
        // so a slow machine is measured when it is ready rather than when a
        // timer says so.
        if (gl.info.render.calls > 0) warmup -= 1
        raf = requestAnimationFrame(step)
        return
      }

      if (index >= viewpoints.length) {
        camera.position.copy(home)
        camera.quaternion.copy(quat)
        window.__campusProbe = samples
        // eslint-disable-next-line no-console
        console.info('[campus probe]', JSON.stringify(samples))
        return
      }

      const view = viewpoints[index]
      if (settle === 0) {
        camera.position.set(...view.position)
        camera.lookAt(...view.lookAt)
        gl.info.reset()
      } else if (settle >= 2) {
        const { render, memory, programs } = gl.info
        samples.push({
          name: view.name,
          calls: render.calls,
          triangles: render.triangles,
          geometries: memory.geometries,
          textures: memory.textures,
          programs: programs?.length ?? 0,
        })
        index += 1
        settle = -1
      }
      settle += 1
      raf = requestAnimationFrame(step)
    }

    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [gl, camera, viewpoints])

  return null
}
