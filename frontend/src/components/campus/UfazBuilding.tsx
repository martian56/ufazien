import { useLayoutEffect, useMemo } from 'react'
import { Instance, Instances } from '@react-three/drei'
import * as THREE from 'three'

import { daylight, type CampusBuilding, type TimeOfDay } from './campusLayout'
import { flagTexture, lettersTexture } from './campusTextures'
import WavingFlag from './WavingFlag'
import {
  Entrance,
  OPENING_HALF_W,
  OPENING_HEIGHT,
  PORCH_DEPTH,
  SPRING_HEIGHT,
  THRESHOLD,
} from './CampusScenery'

/**
 * 183 Nizami Street: the building UFAZ actually occupies.
 *
 * Rebuilt from photographs of the real thing. The previous version was written
 * without them — outbound requests were blocked at the time — and reconstructed
 * the building from its published description plus the shared vocabulary of the
 * oil-boom terraces around it: six storeys of Baku limestone, a rusticated
 * ground floor, arched openings, pilasters, a dentilled cornice, balustrades.
 *
 * Almost none of that is what stands there. The real building is:
 *
 * - **Four storeys**, not six: a low plinth with small square basement windows
 *   at pavement level, then three tall floors.
 * - **Pale grey render**, not honey limestone, with cream stone dressings
 *   around every opening — the contrast between the two is most of the look.
 * - **Curved Dutch gables** along the roofline, and this is the signature. Two
 *   tall ones meet over the corner, and a row of smaller ogee-headed dormers
 *   runs along the flank, each with a cream coping following the curve. A
 *   building with those gables removed is not this building, and the old model
 *   had a flat parapet.
 * - **A red tiled roof** behind them, and black cast-iron downpipes.
 *
 * The gables are extruded from a profile rather than assembled from boxes,
 * because an ogee is a curve: approximated with rectangles it reads as a
 * staircase, and the curve is the whole point of the shape.
 *
 * Photographs are used as reference for proportion and detail only. Nothing is
 * traced and no image ships in this repository.
 */

/** Bays across the long front. Odd, so the entrance has a centre bay. */
const BAYS = 11

/** The three tall floors above the plinth. */
const FLOORS = 3

/** How high the plinth stands, with its small square windows. */
const PLINTH = 2.4

// Near-white with a lavender cast, which is what the render actually is. The
// first pass read it as mid-grey off a single overcast photograph; the flank
// elevation in better light is much lighter than that.
const RENDER_COLOUR = '#d5d6dd'
const DRESSING = '#e0d5bd'
const ROOF_TILE = '#a24b34'
/** The semi-basement, a shade down from the wall above but the same render. */
const PLINTH_COLOUR = '#c4c5ce'

interface UfazBuildingProps {
  building: CampusBuilding
  timeOfDay?: TimeOfDay | string
}

/**
 * The outline of a Dutch gable, as a profile to extrude.
 *
 * Drawn from the middle of the base outwards so it is symmetrical by
 * construction: up the side, a shoulder that curves outwards, then a long
 * concave sweep to the apex. `width` is the full base, `height` the apex above
 * the base.
 */
function gableProfile(width: number, height: number): THREE.Shape {
  const half = width / 2
  const shape = new THREE.Shape()

  shape.moveTo(-half, 0)
  shape.lineTo(-half, height * 0.3)
  // The shoulder: a small outward flare, which is what makes it Dutch rather
  // than a plain triangle.
  shape.quadraticCurveTo(-half * 1.06, height * 0.42, -half * 0.82, height * 0.5)
  // The long sweep to the apex, concave on the way up.
  shape.bezierCurveTo(
    -half * 0.62,
    height * 0.62,
    -half * 0.3,
    height * 0.78,
    0,
    height,
  )
  shape.bezierCurveTo(
    half * 0.3,
    height * 0.78,
    half * 0.62,
    height * 0.62,
    half * 0.82,
    height * 0.5,
  )
  shape.quadraticCurveTo(half * 1.06, height * 0.42, half, height * 0.3)
  shape.lineTo(half, 0)
  shape.closePath()

  return shape
}

/**
 * A gable: the render face, and the cream coping that follows its edge.
 *
 * The coping is the same profile extruded slightly wider and deeper and set a
 * hair behind, so it shows as a band all the way round the curve. Two separate
 * outlines would drift apart the moment either was adjusted.
 */
function Gable({
  width,
  height,
  position,
  rotation = 0,
}: {
  width: number
  height: number
  position: [number, number, number]
  rotation?: number
}) {
  const { face, coping } = useMemo(() => {
    const settings = { depth: 0.5, bevelEnabled: false, curveSegments: 18 }
    return {
      face: new THREE.ExtrudeGeometry(gableProfile(width, height), settings),
      coping: new THREE.ExtrudeGeometry(gableProfile(width + 0.42, height + 0.34), {
        ...settings,
        depth: 0.66,
      }),
    }
  }, [width, height])

  useLayoutEffect(
    () => () => {
      face.dispose()
      coping.dispose()
    },
    [face, coping],
  )

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Behind the face, not in front of it. Extruded slightly larger, the
          coping is meant to show as a band following the outline; drawn proud
          of the face it covered the render completely and every gable on the
          building came out solid cream. */}
      <mesh geometry={coping} position={[0, -0.17, -0.62]} castShadow>
        <meshStandardMaterial color={DRESSING} roughness={0.85} />
      </mesh>
      <mesh geometry={face} position={[0, 0, -0.25]} castShadow receiveShadow>
        <meshStandardMaterial color={RENDER_COLOUR} roughness={0.92} />
      </mesh>
      {/* The pair of narrow arched lights every gable carries. */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * width * 0.13, height * 0.42, 0.3]}>
          <mesh>
            <planeGeometry args={[width * 0.11, height * 0.2]} />
            <meshStandardMaterial color="#2b3138" roughness={0.35} metalness={0.3} />
          </mesh>
          <mesh position={[0, height * 0.1, -0.01]}>
            <circleGeometry args={[width * 0.055, 14, 0, Math.PI]} />
            <meshStandardMaterial color="#2b3138" roughness={0.35} metalness={0.3} />
          </mesh>
          {/* Cream surround, as every opening on the building has. */}
          <mesh position={[0, 0, -0.02]}>
            <planeGeometry args={[width * 0.155, height * 0.235]} />
            <meshStandardMaterial color={DRESSING} roughness={0.85} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** One window's placement on the building. */
interface WindowSpot {
  x: number
  y: number
  z: number
  ry: number
  w: number
  h: number
  lit: boolean
}

/**
 * Every window on the building, as five instanced meshes.
 *
 * This was a `DressedWindow` component drawing five meshes each — surround,
 * sill, glass, and two glazing bars — for forty-five windows, which is two
 * hundred and twenty-five draw calls from one building and was most of why the
 * campus froze when the landmark came into view. The picture is identical; it
 * is one mesh per *kind* of part now instead of one per part.
 *
 * The geometries are unit-sized and each instance carries its own scale, which
 * is what lets the wide front windows and the narrower ones on the returns
 * share a mesh.
 *
 * The architrave is what carries the building. On a grey render every opening
 * is outlined in pale stone, and it is that contrast rather than the window
 * itself that you read from across the street. Square-headed on every floor:
 * the first pass arched the top floor on the assumption that a building of this
 * date would, and the photographs say the opposite — the only arches on it are
 * the paired attic lights inside the gables and the entrance.
 */
function DressedWindows({ spots }: { spots: WindowSpot[] }) {
  const dark = spots.filter((spot) => !spot.lit)
  const glowing = spots.filter((spot) => spot.lit)

  const place = (spot: WindowSpot, depth: number): [number, number, number] => [
    spot.x + Math.sin(spot.ry) * depth,
    spot.y,
    spot.z + Math.cos(spot.ry) * depth,
  ]

  const glass = (list: WindowSpot[], key: string, isLit: boolean) =>
    list.length ? (
      <Instances key={key} limit={list.length} range={list.length}>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial
          color={isLit ? '#f6e2b4' : '#2f3742'}
          emissive={isLit ? '#ffd98a' : '#0d1218'}
          emissiveIntensity={isLit ? 0.85 : 0.12}
          roughness={0.25}
          metalness={0.35}
        />
        {list.map((spot, i) => (
          <Instance
            key={i}
            position={place(spot, 0.15)}
            rotation={[0, spot.ry, 0]}
            scale={[spot.w, spot.h, 1]}
          />
        ))}
      </Instances>
    ) : null

  return (
    <group>
      {/* Surround, proud of the wall. */}
      <Instances limit={spots.length} range={spots.length} castShadow>
        <boxGeometry args={[1, 1, 0.16]} />
        <meshStandardMaterial color={DRESSING} roughness={0.85} />
        {spots.map((spot, i) => (
          <Instance
            key={i}
            position={place(spot, 0.06)}
            rotation={[0, spot.ry, 0]}
            scale={[spot.w + 0.46, spot.h + 0.5, 1]}
          />
        ))}
      </Instances>

      {/* A sill, heavier than the rest of the surround. */}
      <Instances limit={spots.length} range={spots.length} castShadow>
        <boxGeometry args={[1, 0.16, 0.3]} />
        <meshStandardMaterial color={DRESSING} roughness={0.85} />
        {spots.map((spot, i) => {
          const at = place(spot, 0.13)
          return (
            <Instance
              key={i}
              position={[at[0], spot.y - spot.h / 2 - 0.28, at[2]]}
              rotation={[0, spot.ry, 0]}
              scale={[spot.w + 0.7, 1, 1]}
            />
          )
        })}
      </Instances>

      {glass(dark, 'dark', false)}
      {glass(glowing, 'lit', true)}

      {/* A mullion, so a window is not one flat pane. The transom the old
          component also drew has gone: a second instanced mesh across the whole
          building to draw a horizontal line nobody reads from the street. */}
      <Instances limit={spots.length} range={spots.length}>
        <boxGeometry args={[0.07, 1, 0.03]} />
        <meshStandardMaterial color="#3d444d" roughness={0.6} />
        {spots.map((spot, i) => (
          <Instance
            key={i}
            position={place(spot, 0.17)}
            rotation={[0, spot.ry, 0]}
            scale={[1, spot.h, 1]}
          />
        ))}
      </Instances>
    </group>
  )
}

export default function UfazBuilding({ building, timeOfDay = 'day' }: UfazBuildingProps) {
  const [width, height, depth] = building.size
  const lit = daylight(timeOfDay).lampsOn

  const halfW = width / 2
  const halfD = depth / 2
  const bay = width / BAYS
  const floorHeight = (height - PLINTH - 1.1) / FLOORS

  // One each, because the university is a joint project of the two.
  const flags = [flagTexture('az'), flagTexture('fr')]
  const letters = lettersTexture('UFAZ')

  /**
   * Which windows are lit after dark.
   *
   * Fixed per bay and floor rather than random per render, so the building
   * does not flicker every time React touches this component.
   */
  const isLit = (bayIndex: number, floor: number) =>
    lit && (bayIndex * 7 + floor * 3) % 5 < 2

  /**
   * Every window on the building, collected before anything is drawn.
   *
   * Front elevation bay by bay and floor by floor, then two down each return so
   * the building does not read as a flat. Gathered into one list rather than
   * rendered where they are computed, because they are drawn instanced and an
   * instanced mesh needs to know how many of them there are.
   */
  const windows = useMemo(() => {
    const spots: WindowSpot[] = []
    for (let floor = 0; floor < FLOORS; floor++) {
      const y = PLINTH + floorHeight * (floor + 0.55)
      const h = floorHeight * 0.52
      for (let i = 0; i < BAYS; i++) {
        const x = -halfW + bay * (i + 0.5)
        // Not through the entrance.
        if (Math.abs(x) < OPENING_HALF_W + 0.8 && floor === 0) continue
        spots.push({ x, y, z: halfD + 0.02, ry: 0, w: bay * 0.52, h, lit: isLit(i, floor) })
      }
      for (const side of [-1, 1]) {
        for (const [j, t] of [-0.28, 0.1].entries()) {
          spots.push({
            x: side * (halfW + 0.02),
            y,
            z: depth * t,
            ry: (side * Math.PI) / 2,
            w: bay * 0.46,
            h,
            lit: isLit(j + 3, floor),
          })
        }
      }
    }
    return spots
    // `isLit` is a closure over `lit`, which is the only thing that changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [halfW, halfD, bay, depth, floorHeight, lit])

  // The row of small gables along the front, one every other bay, skipping the
  // centre where the two big ones meet.
  const flankGables = useMemo(() => {
    // Mirrored pairs, not a stride across the bays. Stepping `i` by three over
    // eleven bays landed them at -4 and +2 bays — the middle one fell in the
    // gap kept clear for the two big gables and the other two were never a
    // pair to begin with, so the front elevation read visibly lopsided.
    return [2.5, 4.5].flatMap((step) => [-bay * step, bay * step])
  }, [bay])

  return (
    <group position={building.position}>
      {/* The plinth at pavement level, with its row of small square basement
          lights. Rendered the same colour as the wall above rather than a grey
          band: the real plinth is not a different material, it is the same
          render carried down, and only the cream sill course at its head marks
          where the semi-basement ends.

          Cut around the doorway, in pieces, the same way the wall above it is.
          It used to be one box across the whole footprint and it ran straight
          through the opening — so the bottom two and a half metres of the
          entrance were solid plinth, the lower half of each door leaf was
          buried in it, and the cream surround died into the cream band at the
          height where the two met. From the pavement the door looked welded to
          the building. */}
      {(() => {
        const clear = OPENING_HALF_W + 0.7
        const cheek = (width + 0.3) / 2 - clear
        return (
          <group>
            {[-1, 1].map((side) => (
              <mesh
                key={side}
                position={[side * (clear + cheek / 2), PLINTH / 2, 0]}
                castShadow
                receiveShadow
              >
                <boxGeometry args={[cheek, PLINTH, depth + 0.3]} />
                <meshStandardMaterial color={PLINTH_COLOUR} roughness={0.95} />
              </mesh>
            ))}
            {/* Behind the porch, where there is no opening to leave clear. */}
            <mesh
              position={[0, PLINTH / 2, -(PORCH_DEPTH + 0.3) / 2]}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[clear * 2, PLINTH, depth + 0.3 - PORCH_DEPTH]} />
              <meshStandardMaterial color={PLINTH_COLOUR} roughness={0.95} />
            </mesh>
          </group>
        )
      })()}
      {Array.from({ length: BAYS }, (_, i) => {
        const x = -halfW + bay * (i + 0.5)
        // Not across the doorway.
        if (Math.abs(x) < OPENING_HALF_W + 0.8) return null
        return (
          <group key={`b${i}`} position={[x, PLINTH * 0.5, halfD + 0.18]}>
            {/* Cream surround, because every opening on this building has one,
                down to the basement lights at ankle height. */}
            <mesh castShadow>
              <boxGeometry args={[1.16, 1.02, 0.14]} />
              <meshStandardMaterial color={DRESSING} roughness={0.86} />
            </mesh>
            <mesh position={[0, 0, 0.09]}>
              <planeGeometry args={[0.84, 0.7]} />
              <meshStandardMaterial color="#22282f" roughness={0.5} />
            </mesh>
          </group>
        )
      })}

      {/* The body: three floors of render above the plinth. The front face is
          left to `Building`'s doorway machinery, so this is the mass only. */}
      <mesh position={[0, PLINTH + (height - PLINTH) / 2, -PORCH_DEPTH / 2]} castShadow receiveShadow>
        <boxGeometry args={[width, height - PLINTH, depth - PORCH_DEPTH]} />
        <meshStandardMaterial color={RENDER_COLOUR} roughness={0.92} />
      </mesh>

      {/* The front wall, rebuilt around the entrance opening the same way every
          other building's is, so the doorway is a hole here too. */}
      {(() => {
        const pier = halfW - OPENING_HALF_W
        const top = THRESHOLD + OPENING_HEIGHT
        return (
          <group position={[0, 0, halfD - PORCH_DEPTH / 2]}>
            {[-1, 1].map((side) => (
              <mesh
                key={side}
                position={[side * (OPENING_HALF_W + pier / 2), PLINTH + (height - PLINTH) / 2, 0]}
                castShadow
                receiveShadow
              >
                <boxGeometry args={[pier, height - PLINTH, PORCH_DEPTH]} />
                <meshStandardMaterial color={RENDER_COLOUR} roughness={0.92} />
              </mesh>
            ))}
            {/* Over the opening, following the arch rather than sitting square
                on top of it. One box across the whole width would be right for
                a rectangular hole; over an arched one it leaves the two
                spandrels — the corners between the curve and the square — as
                holes straight through the facade. Cut into columns, each
                starting where the arch passes under it. */}
            {Array.from({ length: 24 }, (_, i) => {
              const columnWidth = (OPENING_HALF_W * 2) / 24
              const x = -OPENING_HALF_W + columnWidth * (i + 0.5)
              // The arch is a semicircle on the springing line, so its height
              // over any point is the circle's. Slightly inside the opening
              // half-width, or the outermost columns come out zero-height.
              const rise = Math.sqrt(Math.max(0, OPENING_HALF_W ** 2 - x ** 2))
              const from = SPRING_HEIGHT + rise
              return (
                <mesh
                  key={i}
                  position={[x, from + (height - from) / 2, 0]}
                  castShadow
                  receiveShadow
                >
                  <boxGeometry args={[columnWidth + 0.01, height - from, PORCH_DEPTH]} />
                  <meshStandardMaterial color={RENDER_COLOUR} roughness={0.92} />
                </mesh>
              )
            })}
          </group>
        )
      })()}

      {/* The entrance. The same doorway every other building has — steps, a
          surround and a lobby you can see into — because the collider already
          leaves the opening here and without it the main building had a hole
          in its facade with nothing drawn in it at all. */}
      <Entrance depth={depth} trim={DRESSING} accent={RENDER_COLOUR} />

      {/* Cornice under the roofline, running right round. */}
      <mesh position={[0, height - 0.5, 0]} castShadow>
        <boxGeometry args={[width + 0.5, 0.5, depth + 0.5]} />
        <meshStandardMaterial color={DRESSING} roughness={0.88} />
      </mesh>

      {/* String course over the plinth. In two lengths, stopped either side of
          the entrance: it used to run right round and so straight across the
          doorway at head height, which put a cream band over the doors and
          gave the surround something to dissolve into. On the building it
          dies into the stone architrave and starts again beyond it. */}
      {(() => {
        const clear = OPENING_HALF_W + 0.7
        const run = (width + 0.5) / 2 - clear
        return [-1, 1].map((side) => (
          <mesh key={side} position={[side * (clear + run / 2), PLINTH + 0.1, 0]} castShadow>
            <boxGeometry args={[run, 0.28, depth + 0.5]} />
            <meshStandardMaterial color={DRESSING} roughness={0.88} />
          </mesh>
        ))
      })()}

      {/* Every window on the building, in one instanced pass. */}
      <DressedWindows spots={windows} />

      {/* A pitched tiled roof running the length of the building. The first
          pass had a shallow slab tucked behind the gables on the assumption
          that little of the roof shows; the flank elevation says otherwise —
          it is a full red-tile roof and it reads from across the street. */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[0, height + 1.5, side * depth * 0.24]}
          rotation={[side * 0.62, 0, 0]}
          castShadow
        >
          <boxGeometry args={[width + 0.4, 0.26, depth * 0.62]} />
          <meshStandardMaterial color={ROOF_TILE} roughness={0.95} />
        </mesh>
      ))}
      {/* The ridge. */}
      <mesh position={[0, height + 3.05, 0]} castShadow>
        <boxGeometry args={[width + 0.5, 0.28, 0.5]} />
        <meshStandardMaterial color="#8d3f2c" roughness={0.9} />
      </mesh>

      {/* The turret. A conical red-tiled spire on an octagonal drum at the end
          of the flank, with a finial on top — the single most recognisable
          thing on the building after the gables, and entirely absent before. */}
      <group position={[halfW - bay * 1.1, height - 0.6, halfD - depth * 0.26]}>
        {/* Tall enough that the drum stands clear of the roof slope it comes
            through. At the first height the eaves swallowed it and only the
            spire showed, which reads as a cone dropped on a roof rather than a
            turret rising out of the corner. */}
        <mesh position={[0, 1.9, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[1.5, 1.6, 3.8, 8]} />
          <meshStandardMaterial color={RENDER_COLOUR} roughness={0.92} />
        </mesh>
        {/* Narrow arched lights round the drum, on the two faces you can see. */}
        {[0, 0.7].map((t) => (
          <group key={t} rotation={[0, t, 0]}>
            <mesh position={[0, 2.5, 1.48]}>
              <planeGeometry args={[0.5, 1.1]} />
              <meshStandardMaterial color="#2b3138" roughness={0.35} metalness={0.3} />
            </mesh>
          </group>
        ))}
        {/* A cream band round the drum, as every opening and edge here has. */}
        <mesh position={[0, 3.86, 0]} castShadow>
          <cylinderGeometry args={[1.68, 1.68, 0.24, 8]} />
          <meshStandardMaterial color={DRESSING} roughness={0.86} />
        </mesh>
        <mesh position={[0, 5.6, 0]} castShadow>
          <coneGeometry args={[1.8, 3.3, 8]} />
          <meshStandardMaterial color={ROOF_TILE} roughness={0.92} />
        </mesh>
        <mesh position={[0, 7.55, 0]} castShadow>
          <cylinderGeometry args={[0.05, 0.05, 0.9, 6]} />
          <meshStandardMaterial color="#3a3f46" roughness={0.5} metalness={0.6} />
        </mesh>
        <mesh position={[0, 8.05, 0]}>
          <sphereGeometry args={[0.15, 10, 8]} />
          <meshStandardMaterial color="#c9a227" roughness={0.35} metalness={0.75} />
        </mesh>
      </group>

      {/* The signature: two tall gables over the entrance, and a row of
          smaller ones along the front. */}
      {[-1, 1].map((side) => (
        <Gable
          key={side}
          width={bay * 2.5}
          height={5.4}
          position={[side * bay * 1.25, height - 0.4, halfD + 0.05]}
        />
      ))}
      {flankGables.map((x) => (
        <Gable key={x} width={bay * 1.5} height={2.6} position={[x, height - 0.4, halfD + 0.05]} />
      ))}
      {/* And down both returns. The photographs taken from along the street
          show the same row of ogee dormers on the side elevation; leaving them
          off made the building read as a facade with a plain shed behind it. */}
      {[-1, 1].map((side) =>
        [-0.3, 0.02, 0.3].map((t) => (
          <Gable
            key={`${side}-${t}`}
            width={bay * 1.4}
            height={2.4}
            position={[side * (halfW + 0.05), height - 0.4, depth * t]}
            rotation={side * Math.PI / 2}
          />
        )),
      )}

      {/* Cast-iron downpipes, which the corner of the real building has a pair
          of and which break up an otherwise blank expanse of render. */}
      {[-bay * 2.6, bay * 2.6].map((x) => (
        <mesh key={x} position={[x, (height + PLINTH) / 2, halfD + 0.16]} castShadow>
          <cylinderGeometry args={[0.11, 0.11, height - PLINTH, 8]} />
          <meshStandardMaterial color="#1e2228" roughness={0.7} metalness={0.35} />
        </mesh>
      ))}

      {/* The name, on the cornice over the door. */}
      {letters && (
        <mesh position={[0, height + 0.55, halfD + 0.3]}>
          <planeGeometry args={[bay * 3.4, 1.5]} />
          <meshStandardMaterial
            map={letters}
            transparent
            emissive="#ffffff"
            emissiveMap={letters}
            emissiveIntensity={lit ? 0.7 : 0.2}
          />
        </mesh>
      )}

      {/* Two flags: the university is a joint Strasbourg and ASOIU project. */}
      {flags.map((flag, i) => {
        if (!flag) return null
        const side = i === 0 ? -1 : 1
        return (
          <group key={i} position={[side * bay * 2, PLINTH + 1.4, halfD + 0.5]}>
            <mesh rotation={[0, 0, -side * 0.5]} castShadow>
              <cylinderGeometry args={[0.06, 0.06, 3.2, 8]} />
              <meshStandardMaterial color="#43484f" roughness={0.5} metalness={0.5} />
            </mesh>
            {/* Hung from the pole rather than centred on it, so the hoist edge
                is at the mast and the wave travels away from it. */}
            <group position={[side * 0.85, 1.35, 0]} rotation={[0, side < 0 ? Math.PI : 0, -side * 0.5]}>
              <WavingFlag width={1.5} height={0.95} texture={flag} phase={i * 1.7} wind={1} />
            </group>
          </group>
        )
      })}
    </group>
  )
}
