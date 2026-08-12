import { useLayoutEffect, useMemo } from 'react'
import * as THREE from 'three'

import { daylight, type CampusBuilding, type TimeOfDay } from './campusLayout'
import { flagTexture, lettersTexture } from './campusTextures'
import { Entrance, OPENING_HALF_W, OPENING_HEIGHT, PORCH_DEPTH, THRESHOLD } from './CampusScenery'

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

/**
 * One window: the glass, and the cream architrave around it.
 *
 * The architrave is what carries the building. On a grey render every opening
 * is outlined in pale stone, and it is that contrast rather than the window
 * itself that you read from across the street.
 *
 * Square-headed, on every floor. The first pass arched the top floor on the
 * assumption that a building of this date would; the photographs say the
 * opposite — every window in the wall is rectangular and the only arches on the
 * building are the paired attic lights inside the gables and the entrance
 * itself. Arching the top floor made it read as a different, later building.
 */
function DressedWindow({
  width,
  height,
  position,
  rotation = 0,
  lit = false,
}: {
  width: number
  height: number
  position: [number, number, number]
  rotation?: number
  lit?: boolean
}) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Surround, proud of the wall. */}
      <mesh position={[0, 0, 0.06]} castShadow>
        <boxGeometry args={[width + 0.46, height + 0.5, 0.16]} />
        <meshStandardMaterial color={DRESSING} roughness={0.85} />
      </mesh>
      {/* A sill, heavier than the rest of the surround. */}
      <mesh position={[0, -height / 2 - 0.28, 0.13]} castShadow>
        <boxGeometry args={[width + 0.7, 0.16, 0.3]} />
        <meshStandardMaterial color={DRESSING} roughness={0.85} />
      </mesh>
      <mesh position={[0, 0, 0.15]}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial
          color={lit ? '#f6e2b4' : '#2f3742'}
          emissive={lit ? '#ffd98a' : '#0d1218'}
          emissiveIntensity={lit ? 0.85 : 0.12}
          roughness={0.25}
          metalness={0.35}
        />
      </mesh>
      {/* Glazing bars, so a window is not one flat pane. */}
      <mesh position={[0, 0, 0.17]}>
        <boxGeometry args={[0.07, height, 0.03]} />
        <meshStandardMaterial color="#3d444d" roughness={0.6} />
      </mesh>
      <mesh position={[0, height * 0.18, 0.17]}>
        <boxGeometry args={[width, 0.07, 0.03]} />
        <meshStandardMaterial color="#3d444d" roughness={0.6} />
      </mesh>
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

  // The row of small gables along the front, one every other bay, skipping the
  // centre where the two big ones meet.
  const flankGables = useMemo(() => {
    const out: number[] = []
    for (let i = 1; i < BAYS - 1; i += 3) {
      const x = -halfW + bay * (i + 0.5)
      if (Math.abs(x) < bay * 1.6) continue
      out.push(x)
    }
    return out
  }, [halfW, bay])

  return (
    <group position={building.position}>
      {/* The plinth at pavement level, with its row of small square basement
          lights. Rendered the same colour as the wall above rather than a grey
          band: the real plinth is not a different material, it is the same
          render carried down, and only the cream sill course at its head marks
          where the semi-basement ends. */}
      <mesh position={[0, PLINTH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width + 0.3, PLINTH, depth + 0.3]} />
        <meshStandardMaterial color={PLINTH_COLOUR} roughness={0.95} />
      </mesh>
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
            <mesh position={[0, top + (height - top) / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[OPENING_HALF_W * 2, height - top, PORCH_DEPTH]} />
              <meshStandardMaterial color={RENDER_COLOUR} roughness={0.92} />
            </mesh>
          </group>
        )
      })()}

      {/* The entrance. The same doorway every other building has — steps, a
          surround and a lobby you can see into — because the collider already
          leaves the opening here and without it the main building had a hole
          in its facade with nothing drawn in it at all. */}
      <Entrance depth={depth} trim={DRESSING} accent={RENDER_COLOUR} />

      {/* String course between the plinth and the first floor, and a cornice
          under the roofline. Both run right round. */}
      {[PLINTH + 0.1, height - 0.5].map((y, i) => (
        <mesh key={i} position={[0, y, 0]} castShadow>
          <boxGeometry args={[width + 0.5, i === 0 ? 0.28 : 0.5, depth + 0.5]} />
          <meshStandardMaterial color={DRESSING} roughness={0.88} />
        </mesh>
      ))}

      {/* Windows, bay by bay and floor by floor. */}
      {Array.from({ length: FLOORS }, (_, floor) => {
        const y = PLINTH + floorHeight * (floor + 0.55)
        const tall = floorHeight * 0.52
        return Array.from({ length: BAYS }, (_, i) => {
          const x = -halfW + bay * (i + 0.5)
          const overDoor = Math.abs(x) < OPENING_HALF_W + 0.8
          if (overDoor && floor === 0) return null
          return (
            <DressedWindow
              key={`${floor}-${i}`}
              width={bay * 0.52}
              height={tall}
              position={[x, y, halfD + 0.02]}
              lit={isLit(i, floor)}
            />
          )
        })
      })}

      {/* And down both returns, so the building does not read as a flat. */}
      {[-1, 1].map((side) =>
        Array.from({ length: FLOORS }, (_, floor) => {
          const y = PLINTH + floorHeight * (floor + 0.55)
          return [-0.28, 0.1].map((t, j) => (
            <DressedWindow
              key={`${side}-${floor}-${j}`}
              width={bay * 0.46}
              height={floorHeight * 0.52}
              position={[side * (halfW + 0.02), y, depth * t]}
              rotation={side * Math.PI / 2}
              lit={isLit(j + 3, floor)}
            />
          ))
        }),
      )}

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
            <mesh position={[side * 0.85, 1.35, 0]} rotation={[0, 0, -side * 0.5]}>
              <planeGeometry args={[1.5, 0.95]} />
              <meshStandardMaterial map={flag} side={THREE.DoubleSide} roughness={0.8} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}
