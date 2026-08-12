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

const RENDER_COLOUR = '#c6c6cf'
const DRESSING = '#ded2b8'
const ROOF_TILE = '#7e463a'

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
      <mesh geometry={coping} position={[0, -0.17, -0.34]} castShadow>
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
 */
function DressedWindow({
  width,
  height,
  position,
  rotation = 0,
  arched = false,
  lit = false,
}: {
  width: number
  height: number
  position: [number, number, number]
  rotation?: number
  arched?: boolean
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
      {arched && (
        <mesh position={[0, height / 2, 0.15]}>
          <circleGeometry args={[width / 2, 16, 0, Math.PI]} />
          <meshStandardMaterial
            color={lit ? '#f6e2b4' : '#2f3742'}
            emissive={lit ? '#ffd98a' : '#0d1218'}
            emissiveIntensity={lit ? 0.85 : 0.12}
            roughness={0.25}
            metalness={0.35}
          />
        </mesh>
      )}
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
    for (let i = 1; i < BAYS - 1; i += 2) {
      const x = -halfW + bay * (i + 0.5)
      if (Math.abs(x) < bay * 1.6) continue
      out.push(x)
    }
    return out
  }, [halfW, bay])

  return (
    <group position={building.position}>
      {/* The plinth: a darker band at pavement level with square basement
          lights, which is how the building meets the street. */}
      <mesh position={[0, PLINTH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width + 0.3, PLINTH, depth + 0.3]} />
        <meshStandardMaterial color="#8d8d96" roughness={0.95} />
      </mesh>
      {Array.from({ length: BAYS }, (_, i) => {
        const x = -halfW + bay * (i + 0.5)
        // Not across the doorway.
        if (Math.abs(x) < OPENING_HALF_W + 0.8) return null
        return (
          <mesh key={`b${i}`} position={[x, PLINTH * 0.55, halfD + 0.2]}>
            <planeGeometry args={[0.8, 0.7]} />
            <meshStandardMaterial color="#22282f" roughness={0.5} />
          </mesh>
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
              width={bay * 0.44}
              height={tall}
              position={[x, y, halfD + 0.02]}
              arched={floor === FLOORS - 1}
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
              width={bay * 0.4}
              height={floorHeight * 0.52}
              position={[side * (halfW + 0.02), y, depth * t]}
              rotation={side * Math.PI / 2}
              arched={floor === FLOORS - 1}
              lit={isLit(j + 3, floor)}
            />
          ))
        }),
      )}

      {/* The roof behind the gables. Shallow, and only just visible from the
          street, which is exactly how much of it you see in life. */}
      <mesh position={[0, height + 1.1, -0.4]} rotation={[-0.42, 0, 0]} castShadow>
        <boxGeometry args={[width - 1, 0.3, depth * 0.62]} />
        <meshStandardMaterial color={ROOF_TILE} roughness={0.95} />
      </mesh>

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
