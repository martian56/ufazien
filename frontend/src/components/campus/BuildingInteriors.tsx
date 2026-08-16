import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

import type { InteriorKind, Vec3 } from './campusLayout'
import { mulberry32 } from './campusLayout'
import {
  BLEACHER_TIERS,
  CAFE_BINS,
  CAFE_HEAT_LAMP_Y,
  FUME_CUPBOARDS,
  LAB_AISLE,
  LAB_BENCH_HALF,
  LAB_BENCH_ROWS,
  LIBRARY_DESK_HALF,
  LIBRARY_DESK_X,
  LOUNGE_CLUSTERS,
  LOUNGE_SOFA_OFFSET,
  SCOREBOARD_Y,
  STACK_ROWS,
  TABLE_FOOTBALL,
  UFAZ_BENCH_Z,
  UFAZ_DESK_X,
  UFAZ_FLAGS,
  UFAZ_LIFTS,
  UFAZ_TURNSTILES,
  UFAZ_TURNSTILE_Z,
  UFAZ_STAIR,
  VENDING_MACHINES,
  libraryAisleHalf,
} from './interiorPhysics'
import { NoticeBoard, ScheduleBoard, SitesBoard } from './CampusBoards'
import { ARCADE_PIERS, CORRIDOR_DOORS } from './verticalCirculation'
import { INTERIOR_SPECS, type FloorKind, type InteriorSpec } from './interiorSpecs'
import { LECTURE_ROWS, LECTURE_SEATING } from './lectureSeating'
import {
  carpetTexture,
  ceilingTexture,
  marbleTexture,
  encausticTexture,
  tileTexture,
  woodTexture,
} from './campusTextures'

/**
 * Interiors.
 *
 * Every building used to open into the same room: one 40×40 box with a lecture
 * board and four rows of identical desks, whatever door you had walked through.
 * Entering the library and the cafeteria produced pixel-identical views, which
 * made the whole idea of going inside pointless.
 *
 * Now each building has its own: its own size, floor, ceiling height, lighting
 * temperature and furniture. What they share is the shell — walls, ceiling,
 * skirting, a light rig — because that part genuinely is the same everywhere,
 * and a shared shell is what keeps the projector, the entry camera and the
 * player's boundary clamp working the same way in all of them.
 */

const dummy = new THREE.Object3D()
const color = new THREE.Color()

function floorMaterial(kind: FloorKind) {
  switch (kind) {
    case 'marble':
      return { texture: marbleTexture(), color: '#ded5c4', roughness: 0.22, metalness: 0.06 }
    case 'wood':
      return { texture: woodTexture(), color: '#8a6742', roughness: 0.55, metalness: 0 }
    case 'carpet':
      return { texture: carpetTexture(), color: '#3f4a5c', roughness: 1, metalness: 0 }
    case 'tile':
      return { texture: tileTexture(), color: '#d9d5cc', roughness: 0.35, metalness: 0 }
    case 'encaustic':
      return { texture: encausticTexture(), color: '#ffffff', roughness: 0.34, metalness: 0.02 }
    case 'court':
      return { texture: woodTexture(), color: '#c19a5f', roughness: 0.4, metalness: 0 }
    case 'epoxy':
    default:
      // Poured resin: pale and slightly reflective, not the pitch green the
      // outdoor court texture gave it.
      return { texture: tileTexture('#b9c6c9', '#a9b7bb'), color: '#b9c6c9', roughness: 0.28, metalness: 0.06 }
  }
}

/** The clear opening of an interior door, matching the collider gap. */
const INNER_DOOR_HALF_W = 1.7
const INNER_DOOR_HEIGHT = 4.4

/**
 * The way out, as a hole in the wall.
 *
 * The interior door used to be two leaves hanging in mid-air a metre and a
 * half in front of an unbroken wall — attached to nothing, opening onto
 * nothing, and in the library standing in the issue desk. The wall it belongs
 * in is built here in four pieces around the opening, with a reveal showing
 * the thickness and daylight beyond it, so that the leaves have something to
 * hang in and the way out is somewhere you can see from across the room.
 */
function InteriorDoorway({ spec }: { spec: InteriorSpec }) {
  const z = spec.halfExtent
  const half = INNER_DOOR_HALF_W
  const pier = spec.halfExtent - half

  return (
    <group position={[0, 0, z]} rotation={[0, Math.PI, 0]}>
      {/* The wall, in pieces: two piers and a head. */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[(side * (half + pier / 2)), spec.ceiling / 2, 0]} receiveShadow>
          <planeGeometry args={[pier, spec.ceiling]} />
          <meshStandardMaterial color={spec.wall} roughness={0.95} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <mesh
        position={[0, INNER_DOOR_HEIGHT + (spec.ceiling - INNER_DOOR_HEIGHT) / 2, 0]}
        receiveShadow
      >
        <planeGeometry args={[half * 2, spec.ceiling - INNER_DOOR_HEIGHT]} />
        <meshStandardMaterial color={spec.wall} roughness={0.95} side={THREE.DoubleSide} />
      </mesh>

      {/* Skirting and picture rail, carried across the piers so the doorway
          does not break the line the rest of the room runs at. */}
      {[-1, 1].map((side) => (
        <group key={`t${side}`}>
          <mesh position={[side * (half + pier / 2), 0.2, 0]}>
            <boxGeometry args={[pier, 0.4, 0.3]} />
            <meshStandardMaterial color={spec.accent} roughness={0.8} />
          </mesh>
          <mesh position={[side * (half + pier / 2), spec.ceiling - 0.35, 0]}>
            <boxGeometry args={[pier, 0.3, 0.35]} />
            <meshStandardMaterial color={spec.accent} roughness={0.8} />
          </mesh>
        </group>
      ))}

      {/* The frame, which is what makes it read as a door rather than a gap. */}
      {[-1, 1].map((side) => (
        <mesh key={`f${side}`} position={[side * (half + 0.22), INNER_DOOR_HEIGHT / 2, 0.12]} castShadow>
          <boxGeometry args={[0.44, INNER_DOOR_HEIGHT + 0.44, 0.36]} />
          <meshStandardMaterial color={spec.accent} roughness={0.7} />
        </mesh>
      ))}
      <mesh position={[0, INNER_DOOR_HEIGHT + 0.22, 0.12]} castShadow>
        <boxGeometry args={[half * 2 + 0.88, 0.44, 0.36]} />
        <meshStandardMaterial color={spec.accent} roughness={0.7} />
      </mesh>

      {/* The reveal: the thickness of the wall, seen from inside. */}
      {[-1, 1].map((side) => (
        <mesh key={`r${side}`} position={[side * half, INNER_DOOR_HEIGHT / 2, -0.45]} rotation={[0, side * Math.PI / 2, 0]}>
          <planeGeometry args={[0.9, INNER_DOOR_HEIGHT]} />
          <meshStandardMaterial color="#cfc8bb" roughness={0.9} side={THREE.DoubleSide} />
        </mesh>
      ))}

      {/* Daylight beyond. Not the campus itself — that is a whole scene, and
          the point of the interiors being their own scene is that it is not
          resident here. A bright panel at the end of the reveal reads as
          outside, which is all the doorway has to say. */}
      <mesh position={[0, INNER_DOOR_HEIGHT / 2, -0.9]}>
        <planeGeometry args={[half * 2, INNER_DOOR_HEIGHT]} />
        <meshStandardMaterial
          color="#b9cfe4"
          emissive="#9fc0dd"
          emissiveIntensity={0.65}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* An exit sign over it, so the way out is findable with the lights off. */}
      <mesh position={[0, INNER_DOOR_HEIGHT + 0.7, 0.2]}>
        <planeGeometry args={[1.1, 0.34]} />
        <meshStandardMaterial
          color="#0f2a17"
          emissive="#57e08a"
          emissiveIntensity={1.6}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

/**
 * Walls, floor, ceiling, skirting and the light rig.
 *
 * The ceiling is a real surface with a texture rather than a flat plane, and
 * the lights are placed as a grid rather than as one bulb at the centre, which
 * is what made every old interior look like a cave with a torch in it.
 */
/**
 * A flat coffered ceiling: a dark grid over white panels, with linear tubes.
 *
 * The conference hall's ceiling is a deep rectangular lattice of dark bars with
 * white infill and strip lights running in some of the bays. It is the most
 * recognisable thing in the room after the arched windows, and for a while it
 * was the library's trussed roof, which is a different room in the same
 * building.
 */
function CofferedCeiling({ size, ceiling }: { size: number; ceiling: number }) {
  const bays = 6
  const pitch = size / bays
  const lines = Array.from({ length: bays + 1 }, (_, i) => -size / 2 + i * pitch)

  return (
    <group>
      {/* The white panels the grid sits under. */}
      <mesh position={[0, ceiling, 0]} rotation={[Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial color="#f4f5f6" roughness={1} side={THREE.DoubleSide} />
      </mesh>

      {/* The grid, hanging below the panels so the coffers have depth. A flat
          painted lattice reads as wallpaper; the shadow in the reveal is the
          whole effect. */}
      {lines.map((t) => (
        <group key={t}>
          <mesh position={[t, ceiling - 0.22, 0]} castShadow>
            <boxGeometry args={[0.18, 0.44, size]} />
            <meshStandardMaterial color="#2a2d31" roughness={0.7} />
          </mesh>
          <mesh position={[0, ceiling - 0.22, t]} castShadow>
            <boxGeometry args={[size, 0.44, 0.18]} />
            <meshStandardMaterial color="#2a2d31" roughness={0.7} />
          </mesh>
        </group>
      ))}

      {/* Strip lights, one run down every other bay. */}
      {lines.slice(0, -1).map((t, i) =>
        i % 2 === 0 ? null : (
          <mesh key={`l${t}`} position={[t + pitch / 2, ceiling - 0.08, 0]}>
            <boxGeometry args={[0.34, 0.06, size * 0.82]} />
            <meshStandardMaterial
              color="#ffffff"
              emissive="#ffffff"
              emissiveIntensity={1.5}
              toneMapped={false}
            />
          </mesh>
        ),
      )}
    </group>
  )
}

/**
 * A pitched roof on exposed trusses, seen from inside.
 *
 * The library is in the attic and the roof is most of the room: a steep pitch,
 * white boarding between dark steel rafters, collars and king posts, and
 * conical pendants on long cables hanging between them. The conference hall has
 * the same structure over its raked seating.
 *
 * The eaves start well down the wall, which is what makes an attic an attic —
 * a pitch that begins at ceiling height reads as a lid on a normal room.
 */
function TrussedRoof({ size, ceiling }: { size: number; ceiling: number }) {
  const half = size / 2
  const eaves = ceiling * 0.42
  const rise = ceiling - eaves
  const slope = Math.hypot(half, rise)
  const pitch = Math.atan2(rise, half)
  // A truss every few metres down the length of the room.
  const frames = Array.from({ length: Math.round(size / 5) }, (_, i) => -half + (i + 0.5) * (size / Math.round(size / 5)))

  return (
    <group>
      {/* The two slopes of boarding.
          A group carries the pitch and the mesh inside it is laid flat, because
          composing "lie down" and "tilt" into one Euler triple depends on the
          rotation order and the first attempt got a flat grey lid: the angle
          was computed and then never applied. Laying the plane down with a
          quarter turn about X points its normal at the floor, which is the
          side of it anybody is going to see. */}
      {[-1, 1].map((side) => (
        <group
          key={side}
          position={[(side * half) / 2, eaves + rise / 2, 0]}
          rotation={[0, 0, -side * pitch]}
        >
          <mesh rotation={[Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[slope, size]} />
            <meshStandardMaterial color="#eceff2" roughness={0.95} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
      {/* Gable ends, so the roof does not open onto nothing. */}
      {[-1, 1].map((side) => (
        <mesh key={`g${side}`} position={[0, eaves, side * half]} rotation={[0, side > 0 ? 0 : Math.PI, 0]}>
          <shapeGeometry args={[gableEnd(half, rise)]} />
          <meshStandardMaterial color="#eceff2" roughness={0.95} side={THREE.DoubleSide} />
        </mesh>
      ))}

      {frames.map((z) => (
        <group key={z} position={[0, 0, z]}>
          {/* Rafters. */}
          {[-1, 1].map((side) => (
            <mesh
              key={side}
              position={[(side * half) / 2, eaves + rise / 2, 0]}
              rotation={[0, 0, -side * pitch]}
              castShadow
            >
              <boxGeometry args={[slope, 0.26, 0.26]} />
              <meshStandardMaterial color="#5a6067" roughness={0.6} metalness={0.25} />
            </mesh>
          ))}
          {/* Collar tie and king post, which is what makes it read as a truss
              rather than as two sticks leaning together. */}
          <mesh position={[0, eaves + rise * 0.45, 0]} castShadow>
            <boxGeometry args={[half * 1.05, 0.22, 0.22]} />
            <meshStandardMaterial color="#5a6067" roughness={0.6} metalness={0.25} />
          </mesh>
          <mesh position={[0, eaves + rise * 0.72, 0]} castShadow>
            <boxGeometry args={[0.2, rise * 0.55, 0.2]} />
            <meshStandardMaterial color="#5a6067" roughness={0.6} metalness={0.25} />
          </mesh>
        </group>
      ))}

      {/* Conical pendants on long cables, with the copper collar they have. */}
      {frames.flatMap((z) =>
        [-half * 0.55, 0, half * 0.55].map((x) => (
          <group key={`${z}-${x}`} position={[x, 0, z]}>
            <mesh position={[0, ceiling * 0.86, 0]}>
              <cylinderGeometry args={[0.012, 0.012, ceiling * 0.28, 4]} />
              <meshStandardMaterial color="#23262a" />
            </mesh>
            <mesh position={[0, ceiling * 0.71, 0]}>
              <cylinderGeometry args={[0.09, 0.09, 0.12, 10]} />
              <meshStandardMaterial color="#b06a3c" roughness={0.4} metalness={0.6} />
            </mesh>
            <mesh position={[0, ceiling * 0.66, 0]} castShadow>
              <coneGeometry args={[0.42, 0.5, 14, 1, true]} />
              <meshStandardMaterial color="#8d949b" roughness={0.6} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0, ceiling * 0.62, 0]}>
              <sphereGeometry args={[0.14, 8, 6]} />
              <meshStandardMaterial color="#fff4d8" emissive="#ffe9b8" emissiveIntensity={1.1} />
            </mesh>
          </group>
        )),
      )}
    </group>
  )
}

/** The triangle that closes each end of a pitched roof. */
function gableEnd(half: number, rise: number): THREE.Shape {
  const shape = new THREE.Shape()
  shape.moveTo(-half, 0)
  shape.lineTo(half, 0)
  shape.lineTo(0, rise)
  shape.closePath()
  return shape
}

function RoomShell({
  spec,
  lit = true,
  children,
}: {
  spec: InteriorSpec
  /**
   * Whether the lights are on.
   *
   * Off is dim rather than black: a room nobody can see is a room nobody can
   * walk out of, and the emissive fittings staying faintly visible is what
   * tells you where the switch you just used was.
   */
  lit?: boolean
  children?: React.ReactNode
}) {
  const size = spec.halfExtent * 2
  // One factor, applied to every light in the room, so the switch cannot leave
  // a fitting burning that nothing turned off.
  const level = lit ? spec.lightIntensity : spec.lightIntensity * 0.12
  const floor = floorMaterial(spec.floor)
  const ceiling = ceilingTexture()

  // Scale texture repeats with the room, so a big hall does not get giant tiles.
  const floorMap = useMemo(() => {
    if (!floor.texture) return null
    const clone = floor.texture.clone()
    clone.needsUpdate = true
    clone.repeat.set((size / 100) * floor.texture.repeat.x, (size / 100) * floor.texture.repeat.y)
    return clone
  }, [floor.texture, size])

  useLayoutEffect(() => () => floorMap?.dispose(), [floorMap])

  // Every wall but the one with the door in it, which is built in pieces
  // around the opening below.
  const walls: [number, number, number, number][] = [
    [0, spec.ceiling / 2, -spec.halfExtent, 0],
    [-spec.halfExtent, spec.ceiling / 2, 0, Math.PI / 2],
    [spec.halfExtent, spec.ceiling / 2, 0, -Math.PI / 2],
  ]

  // A grid of downlights. Three by three is enough to light a room evenly
  // without paying for a light per square metre.
  const lights = useMemo(() => {
    const spread = spec.halfExtent * 0.55
    // A small room does not need nine fill lights. Each one is another term in
    // the fragment shader of every lit surface in the room, and the emissive
    // fittings below already carry most of the look.
    const axis = spec.halfExtent > 22 ? [-spread, 0, spread] : [-spread * 0.8, spread * 0.8]
    const items: [number, number][] = []
    for (const x of axis) {
      for (const z of axis) items.push([x, z])
    }
    return items
  }, [spec.halfExtent])

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial
          map={floorMap ?? undefined}
          color={spec.floorTint ?? (floorMap ? '#ffffff' : floor.color)}
          roughness={floor.roughness}
          metalness={floor.metalness}
        />
      </mesh>

      {walls.map(([x, y, z, ry], i) => (
        <group key={i}>
          <mesh position={[x, y, z]} rotation={[0, ry, 0]} receiveShadow>
            <planeGeometry args={[size, spec.ceiling]} />
            <meshStandardMaterial color={spec.wall} roughness={0.95} side={THREE.DoubleSide} />
          </mesh>
          {/* Skirting and a picture rail: two thin boxes that give the wall a
              scale, without which a room reads as an infinite grey field. */}
          <mesh position={[x, 0.2, z]} rotation={[0, ry, 0]}>
            <boxGeometry args={[size, 0.4, 0.3]} />
            <meshStandardMaterial color={spec.accent} roughness={0.8} />
          </mesh>
          <mesh position={[x, spec.ceiling - 0.35, z]} rotation={[0, ry, 0]}>
            <boxGeometry args={[size, 0.3, 0.35]} />
            <meshStandardMaterial color={spec.accent} roughness={0.8} />
          </mesh>
        </group>
      ))}

      {/* Beams across the boarding. A flat brown plane reads as a brown
          ceiling; what the photographs show is boards running one way with
          joists crossing them, and the shadow lines between are the whole
          reason the ceiling is the first thing you notice in that building. */}
      {spec.ceilingKind === 'timber' &&
        Array.from({ length: Math.round(size / 2.6) }, (_, i) => (
          <mesh
            key={i}
            position={[0, spec.ceiling - 0.22, -size / 2 + (i + 0.5) * 2.6]}
            castShadow
          >
            <boxGeometry args={[size, 0.34, 0.3]} />
            <meshStandardMaterial color="#6b4526" roughness={0.9} />
          </mesh>
        ))}

      {spec.ceilingKind === 'truss' && <TrussedRoof size={size} ceiling={spec.ceiling} />}
      {spec.ceilingKind === 'coffered' && <CofferedCeiling size={size} ceiling={spec.ceiling} />}

      {spec.ceilingKind !== 'truss' && spec.ceilingKind !== 'coffered' && (
      <mesh position={[0, spec.ceiling, 0]} rotation={[Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[size, size]} />
        {spec.ceilingKind === 'deck' ? (
          <meshStandardMaterial color="#6f7681" roughness={0.85} metalness={0.2} side={THREE.DoubleSide} />
        ) : spec.ceilingKind === 'plaster' ? (
          <meshStandardMaterial color="#f2ece0" roughness={1} side={THREE.DoubleSide} />
        ) : spec.ceilingKind === 'timber' ? (
          <meshStandardMaterial color="#c98b4b" roughness={0.85} side={THREE.DoubleSide} />
        ) : (
          <meshStandardMaterial
            map={ceiling ?? undefined}
            color={ceiling ? '#ffffff' : '#e8e3d8'}
            roughness={1}
            side={THREE.DoubleSide}
          />
        )}
      </mesh>
      )}

      <ambientLight
        intensity={(lit ? 0.55 : 0.28) * level}
        color={lit ? spec.lightColor : '#8fa6c8'}
      />
      {/* One shadow-casting light, so furniture is grounded, and a ring of
          cheap ones for fill. Nine shadow maps would cost more than the whole
          rest of the scene. */}
      <pointLight
        position={[0, spec.ceiling - 1.2, 0]}
        intensity={70 * level}
        distance={spec.halfExtent * 3}
        color={spec.lightColor}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.001}
      />
      {lights.map(([x, z], i) => (
        <group key={i}>
          <pointLight
            position={[x, spec.ceiling - 1.2, z]}
            intensity={22 * level}
            distance={spec.halfExtent * 1.6}
            color={spec.lightColor}
          />
          {/* The fitting the light comes out of. */}
          <mesh position={[x, spec.ceiling - 0.25, z]}>
            <boxGeometry args={[2.4, 0.12, 0.7]} />
            <meshStandardMaterial
              color={lit ? '#ffffff' : '#3b4048'}
              emissive={spec.lightColor}
              // A fitting that still glows with the lights off is the one
              // thing that gives away that they are off rather than broken.
              emissiveIntensity={lit ? 1.6 : 0.08}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}

      <InteriorDoorway spec={spec} />

      {children}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Shared furniture                                                     */
/* ------------------------------------------------------------------ */

function Table({
  position,
  size = [3.4, 0.12, 1.4],
  legColor = '#4a4f57',
  topColor = '#8a6742',
}: {
  position: Vec3
  size?: Vec3
  legColor?: string
  topColor?: string
}) {
  const [w, , d] = size
  return (
    <group position={position}>
      <mesh castShadow receiveShadow position={[0, 0.75, 0]}>
        <boxGeometry args={size} />
        <meshStandardMaterial color={topColor} roughness={0.7} />
      </mesh>
      {([[-1, -1], [1, -1], [-1, 1], [1, 1]] as [number, number][]).map(([sx, sz], i) => (
        <mesh key={i} castShadow position={[sx * (w / 2 - 0.2), 0.38, sz * (d / 2 - 0.2)]}>
          <cylinderGeometry args={[0.06, 0.06, 0.75, 6]} />
          <meshStandardMaterial color={legColor} roughness={0.6} metalness={0.35} />
        </mesh>
      ))}
    </group>
  )
}

function Chair({ position, rotation = 0, seat = '#3f5b7a' }: { position: Vec3; rotation?: number; seat?: string }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh castShadow position={[0, 0.45, 0]}>
        <boxGeometry args={[0.62, 0.08, 0.62]} />
        <meshStandardMaterial color={seat} roughness={0.85} />
      </mesh>
      <mesh castShadow position={[0, 0.78, -0.28]}>
        <boxGeometry args={[0.62, 0.66, 0.08]} />
        <meshStandardMaterial color={seat} roughness={0.85} />
      </mesh>
      {([[-1, -1], [1, -1], [-1, 1], [1, 1]] as [number, number][]).map(([sx, sz], i) => (
        <mesh key={i} castShadow position={[sx * 0.25, 0.22, sz * 0.25]}>
          <cylinderGeometry args={[0.035, 0.035, 0.44, 6]} />
          <meshStandardMaterial color="#3a4048" roughness={0.6} metalness={0.3} />
        </mesh>
      ))}
    </group>
  )
}

/** A wall poster or noticeboard. Flat, but it breaks up a blank wall. */
function WallPanel({
  position,
  rotation = 0,
  size = [3, 2],
  panelColor = '#f2ede2',
  frame = '#4a4f57',
}: {
  position: Vec3
  rotation?: number
  size?: [number, number]
  panelColor?: string
  frame?: string
}) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh castShadow>
        <boxGeometry args={[size[0] + 0.2, size[1] + 0.2, 0.12]} />
        <meshStandardMaterial color={frame} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0, 0.08]}>
        <planeGeometry args={size} />
        <meshStandardMaterial color={panelColor} roughness={0.9} />
      </mesh>
    </group>
  )
}

/** A potted plant, the universal interior filler. */
function Plant({ position, scale = 1 }: { position: Vec3; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh castShadow receiveShadow position={[0, 0.35, 0]}>
        <cylinderGeometry args={[0.35, 0.28, 0.7, 12]} />
        <meshStandardMaterial color="#8a5c42" roughness={0.9} />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => {
        const angle = (i / 5) * Math.PI * 2
        return (
          <mesh
            key={i}
            castShadow
            position={[Math.cos(angle) * 0.3, 1.15, Math.sin(angle) * 0.3]}
            rotation={[Math.cos(angle) * 0.45, 0, Math.sin(angle) * -0.45]}
          >
            <coneGeometry args={[0.32, 1.4, 5]} />
            <meshStandardMaterial color="#2f7a3c" roughness={0.9} flatShading />
          </mesh>
        )
      })}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* UFAZ main building: the entrance hall                                */
/* ------------------------------------------------------------------ */

/**
 * The window wall of the landmark, seen from inside.
 *
 * The hall had no windows at all. A restored 1900s building on a street in
 * central Baku, lit entirely by downlights, with four blank walls — the one
 * thing you cannot mistake about the real building is that it is full of tall
 * openings, and standing inside a sealed box directly contradicted the facade
 * the player had just walked past.
 *
 * The rhythm here is the facade's, not an invention: square-headed openings in
 * two tiers on the floor heights the exterior uses, in deep reveals, with the
 * same cream dressings around them. Drawn in front of the wall rather than cut
 * through it — the room's shell is a plane and the daylight behind these is a
 * panel, so nothing has to be booleaned and the wall stays one draw call.
 */
function HeritageWindows({ spec }: { spec: InteriorSpec }) {
  const half = spec.halfExtent
  const bays = [-16.5, -11, -5.5, 5.5, 11, 16.5]
  // Two tiers on the exterior's floor heights, so a player looking out of an
  // upstairs window is looking out of one that exists on the outside too.
  const tiers = [1.6, 7.4]

  return (
    <group>
      {[-1, 1].map((side) =>
        bays.map((along) =>
          tiers.map((sill) => (
            <group
              key={`${side}-${along}-${sill}`}
              position={[side * (half - 0.15), sill + 2.1, along]}
              rotation={[0, side * -Math.PI / 2, 0]}
            >
              {/* The reveal: the opening is set into a wall two feet thick, and
                  the depth of it is most of what you read at this scale. Far
                  enough back that its front face is behind the glass — at half
                  this depth it stood in front of the daylight and the window
                  went dark again, one layer further in than the architrave did. */}
              <mesh position={[0, 0, -0.5]}>
                <boxGeometry args={[3.3, 5, 0.6]} />
                <meshStandardMaterial color="#cdc3ac" roughness={0.9} />
              </mesh>
              {/* Cream architrave, as every opening on the outside has. Four
                  members around the opening rather than one panel across it: a
                  solid box here covers the glass completely, which is exactly
                  what the first pass did — six blank cream slabs a side, in a
                  wall that was supposed to have just been given windows. */}
              {[
                [0, 2.5, 3.7, 0.4],
                [0, -2.5, 3.7, 0.4],
                [-1.65, 0, 0.4, 5.4],
                [1.65, 0, 0.4, 5.4],
              ].map(([mx, my, mw, mh]) => (
                <mesh key={`${mx}-${my}`} position={[mx, my, -0.06]}>
                  <boxGeometry args={[mw, mh, 0.2]} />
                  <meshStandardMaterial color="#e0d5bd" roughness={0.86} />
                </mesh>
              ))}
              {/* Daylight. Emissive rather than a light: six windows a side
                  with real lights in them is twenty-four shadow maps, and the
                  room already has its own lighting. */}
              <mesh position={[0, 0, -0.16]}>
                <planeGeometry args={[2.9, 4.6]} />
                <meshStandardMaterial
                  color="#eaf3fb"
                  emissive="#dcebf9"
                  emissiveIntensity={1.6}
                  roughness={0.15}
                  metalness={0.2}
                />
              </mesh>
              {/* Glazing bars and a transom, so the opening is not one pane. */}
              <mesh position={[0, 0, -0.13]}>
                <boxGeometry args={[0.09, 4.6, 0.04]} />
                <meshStandardMaterial color="#6c6252" roughness={0.7} />
              </mesh>
              <mesh position={[0, 1.1, -0.13]}>
                <boxGeometry args={[2.9, 0.09, 0.04]} />
                <meshStandardMaterial color="#6c6252" roughness={0.7} />
              </mesh>
              {/* Sill, and the panel radiator that sits under every window in
                  a building heated through a Baku winter. */}
              <mesh position={[0, -2.5, 0.16]}>
                <boxGeometry args={[3.9, 0.2, 0.5]} />
                <meshStandardMaterial color="#e0d5bd" roughness={0.86} />
              </mesh>
              {sill < 4 && (
                <mesh position={[0, -3.3, 0.2]}>
                  <boxGeometry args={[2.6, 0.9, 0.16]} />
                  <meshStandardMaterial color="#f2f0ea" roughness={0.6} metalness={0.1} />
                </mesh>
              )}
            </group>
          )),
        ),
      )}
    </group>
  )
}


/**
 * The speed gates across the entrance.
 *
 * Four of them in a line, stainless, with a card reader on the top face. You
 * walk between them rather than round them: they are narrow and there is a
 * person's width in each gap, which is the whole point of the arrangement and
 * the reason their colliders are that shape too.
 */
function Turnstiles() {
  return (
    <group>
      {UFAZ_TURNSTILES.map((x) => (
        <group key={x} position={[x, 0, UFAZ_TURNSTILE_Z]}>
          <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.44, 1, 1.2]} />
            {/* Brushed steel, not mirror steel. At metalness 0.85 with no
                environment map to reflect there is nothing for the metal to
                pick up and the gates came out black. */}
            <meshStandardMaterial color="#c9d0d6" roughness={0.42} metalness={0.35} />
          </mesh>
          <mesh position={[0, 1.02, 0]} castShadow>
            <boxGeometry args={[0.5, 0.06, 1.28]} />
            <meshStandardMaterial color="#e6eaee" roughness={0.35} metalness={0.3} />
          </mesh>
          {/* The reader, which is the one bit of colour on them. */}
          <mesh position={[0, 1.07, 0.34]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.22, 0.3]} />
            <meshStandardMaterial color="#2f6f4f" emissive="#2f6f4f" emissiveIntensity={0.5} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/**
 * The lift core: two cars side by side in a glazed shaft.
 *
 * Straight ahead of the entrance, which is how you read the building walking
 * in — cross the hall and this is what you are looking at, with the stair
 * beside it and the corridor running off to the left.
 *
 * The glass is a single transparent box rather than framed panels. A real
 * curtain wall here is a dozen mullions and four sheets of glass per face, and
 * this room has already been the most expensive thing in the scene once.
 */
function LiftCore({ ceiling }: { ceiling: number }) {
  const { x, z, halfW, halfD } = UFAZ_LIFTS
  const shaft = Math.min(ceiling - 0.6, 8.2)

  return (
    <group position={[x, 0, z]}>
      {/* The shaft. Drawn last-ish and transparent, so the steel inside reads
          through it. */}
      <mesh position={[0, shaft / 2, 0]}>
        <boxGeometry args={[halfW * 2, shaft, halfD * 2]} />
        <meshStandardMaterial
          color="#8ea3ad"
          transparent
          opacity={0.28}
          roughness={0.08}
          metalness={0.5}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Steel frame at the corners and the head. */}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * halfW, shaft / 2, sz * halfD]} castShadow>
            <boxGeometry args={[0.16, shaft, 0.16]} />
            <meshStandardMaterial color="#6d7a83" roughness={0.5} metalness={0.6} />
          </mesh>
        )),
      )}
      <mesh position={[0, shaft, 0]} castShadow>
        <boxGeometry args={[halfW * 2 + 0.2, 0.2, halfD * 2 + 0.2]} />
        <meshStandardMaterial color="#6d7a83" roughness={0.5} metalness={0.6} />
      </mesh>

      {/* The two cars, doors facing the hall. */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 2.1, 0, halfD]}>
          <mesh position={[0, 1.2, 0.02]} castShadow>
            <boxGeometry args={[1.8, 2.4, 0.12]} />
            <meshStandardMaterial color="#c3cad0" roughness={0.28} metalness={0.9} />
          </mesh>
          {/* The joint down the middle, which is what makes it read as doors. */}
          <mesh position={[0, 1.2, 0.09]}>
            <boxGeometry args={[0.05, 2.4, 0.03]} />
            <meshStandardMaterial color="#8f979e" roughness={0.4} metalness={0.7} />
          </mesh>
          <mesh position={[0, 2.62, 0.06]}>
            <planeGeometry args={[0.34, 0.14]} />
            <meshStandardMaterial color="#c0392b" emissive="#c0392b" emissiveIntensity={0.7} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/**
 * The arcade along the west corridor.
 *
 * A run of round-headed openings in a pier wall, which is what the corridor
 * photographs show and what stops that side of the hall being twenty metres of
 * blank plaster. Built as piers with a filled spandrel over each opening rather
 * than as an arch cut out of a wall: the hole is the shape between the piers,
 * so there is nothing to boolean.
 */
function Arcade({ half, ceiling }: { half: number; ceiling: number }) {
  const head = 4.2
  // The shared list, so what is drawn and what is solid cannot disagree — they
  // did, and one of the piers stood in a classroom doorway.
  const bays = ARCADE_PIERS
  const pier = 1.1

  return (
    <group position={[-half + 7, 0, 0]}>
      {bays.map((z) => (
        <mesh key={z} position={[0, head / 2, z]} castShadow receiveShadow>
          <boxGeometry args={[0.9, head, pier]} />
          <meshStandardMaterial color="#e9ebee" roughness={0.94} />
        </mesh>
      ))}
      {/* The wall above the openings, carried on the piers. */}
      <mesh position={[0, head + (ceiling - head) / 2, 2]} castShadow receiveShadow>
        <boxGeometry args={[0.9, ceiling - head, 32]} />
        <meshStandardMaterial color="#e9ebee" roughness={0.94} />
      </mesh>
      {/* Spandrels: the curve of each head, as a half disc between two piers.
          Proud of the wall above rather than on its centre line — the wall is
          0.9 thick and these sat inside it, so every opening came out square
          and the arcade was a row of rectangular holes. */}
      {bays.slice(0, -1).map((z, i) => (
        <mesh
          key={`s${z}`}
          position={[0.46, head, (z + bays[i + 1]) / 2]}
          rotation={[0, Math.PI / 2, 0]}
        >
          <circleGeometry args={[(bays[i + 1] - z) / 2 - 0.45, 18, 0, Math.PI]} />
          <meshStandardMaterial color="#e9ebee" roughness={0.94} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  )
}

/**
 * An upper floor: the corridor, repeated.
 *
 * The same arcade, the same window bays, the same stair and lift in the same
 * corners as the entrance hall — which is what the building does. What changes
 * per floor is the doors along the arcade and what is behind them, and those
 * come from `verticalCirculation`.
 */
/**
 * The classroom doors along the arcade.
 *
 * Drawn on every floor in the same places, including the ground floor — which
 * did not draw them at all, so the conference hall was reached by walking into
 * a blank stretch of wall and being teleported. A door portal with no door is
 * indistinguishable from a bug.
 */
/**
 * Suspended square light rings.
 *
 * A hollow square of light on two thin drops. Built from four bars rather than
 * a ring geometry so the corners are mitred squares rather than a rounded
 * lozenge, which is what the difference between this fitting and a generic
 * circular pendant comes down to.
 *
 * Turned a few degrees off the room's axes and hung at two heights, because in
 * the photographs they are: a grid of them square to the walls reads as a
 * suspended ceiling with the tiles left out.
 */
function LightRings({ ceiling }: { ceiling: number }) {
  const rings: { x: number; z: number; size: number; drop: number; spin: number }[] = [
    { x: -6, z: 12, size: 2.6, drop: 2.2, spin: 0.18 },
    { x: 4, z: 8, size: 3.4, drop: 3.0, spin: -0.12 },
    { x: -2, z: 0, size: 2.9, drop: 2.4, spin: 0.26 },
    { x: 8, z: -4, size: 2.4, drop: 3.2, spin: -0.2 },
    { x: -9, z: -8, size: 3.1, drop: 2.6, spin: 0.1 },
    { x: 2, z: -14, size: 2.7, drop: 3.0, spin: -0.24 },
  ]

  return (
    <group>
      {rings.map((ring, i) => {
        const y = ceiling - ring.drop
        const half = ring.size / 2
        return (
          <group key={i} position={[ring.x, y, ring.z]} rotation={[0, ring.spin, 0]}>
            {/* The four bars. Two run the full width, two fill between them, so
                the corners close without overlapping and double-brightening. */}
            {([
              [0, -half, ring.size, 0.12],
              [0, half, ring.size, 0.12],
              [-half, 0, 0.12, ring.size - 0.24],
              [half, 0, 0.12, ring.size - 0.24],
            ] as [number, number, number, number][]).map(([bx, bz, bw, bd]) => (
              <mesh key={`${bx}-${bz}`} position={[bx, 0, bz]}>
                <boxGeometry args={[bw, 0.09, bd]} />
                <meshStandardMaterial
                  color="#ffffff"
                  emissive="#ffffff"
                  emissiveIntensity={1.6}
                  toneMapped={false}
                />
              </mesh>
            ))}
            {/* The drops, which are what makes it read as suspended rather than
                as a shape painted on the ceiling. */}
            {[-half * 0.6, half * 0.6].map((t) => (
              <mesh key={t} position={[t, ring.drop / 2, 0]}>
                <cylinderGeometry args={[0.012, 0.012, ring.drop, 4]} />
                <meshStandardMaterial color="#9aa0a6" />
              </mesh>
            ))}
            <pointLight intensity={9} distance={16} decay={2} color="#f4f8ff" />
          </group>
        )
      })}
    </group>
  )
}

/**
 * The main flight: granite treads, iron balusters, a timber handrail.
 *
 * One component for the entrance hall and every corridor above it, matching
 * `mainStair` in `interiorPhysics` — they are the same stair in the same place
 * on every floor, and drawing two different ones was how the upper floors ended
 * up with steps that nothing could stand on. Every dimension below is read from
 * `UFAZ_STAIR`, so reprofiling the flight moves what you see and what you stand
 * on together.
 *
 * Open-riser, because that is what the balusters imply and what the collision
 * layer now agrees with: there is nothing between the treads, and above head
 * height you walk underneath.
 */
function MainStair() {
  const { steps, rise, going, halfW } = UFAZ_STAIR
  /** Horizontal run from the first tread to the last. */
  const run = (steps - 1) * going
  /** And the climb over that run, which together give the pitch. */
  const climb = (steps - 1) * rise
  const pitch = Math.atan2(climb, run)
  /** Length of a member following the slope. */
  const rake = Math.hypot(run, climb)
  const treadThickness = 0.07

  return (
      <group position={[UFAZ_STAIR.x, 0, UFAZ_STAIR.z]}>
        {Array.from({ length: steps }, (_, i) => (
          /* Grey stone treads. They were cream with a red carpet runner up
             the middle, which is a country house; the stair in the building
             is granite with a black iron balustrade and a timber rail.
             `treadTop` is the walking surface, so the slab hangs below it. */
          <mesh
            key={i}
            castShadow
            receiveShadow
            position={[0, (i + 1) * rise - treadThickness / 2, -i * going]}
          >
            <boxGeometry args={[halfW * 2, treadThickness, going]} />
            <meshStandardMaterial color="#9a9a99" roughness={0.6} />
          </mesh>
        ))}

        {/* The strings the treads sit on. Two raking beams rather than a solid
            mass under the flight, so the stair reads as the open one it is. */}
        {[-1, 1].map((side) => (
          <mesh
            key={side}
            castShadow
            receiveShadow
            position={[side * (halfW - 0.18), (rise + climb + rise) / 2 - 0.28, -run / 2]}
            rotation={[pitch, 0, 0]}
          >
            <boxGeometry args={[0.28, 0.4, rake]} />
            <meshStandardMaterial color="#8d8d8c" roughness={0.7} />
          </mesh>
        ))}

        {/* Height derived from the landing's own top rather than written out
            again: the drawn stair and the one you stand on are the same stair,
            and a second copy of a number here is how they stop being. */}
        <mesh
          castShadow
          receiveShadow
          position={[0, UFAZ_STAIR.landing.top - 0.2, UFAZ_STAIR.landing.z - UFAZ_STAIR.z]}
        >
          <boxGeometry args={[UFAZ_STAIR.landing.halfW * 2, 0.4, UFAZ_STAIR.landing.halfD * 2]} />
          <meshStandardMaterial color="#9a9a99" roughness={0.6} />
        </mesh>

        {/* Balustrade. An iron baluster rather than a solid stepped parapet,
            which is what the photographs show — you can see the hall through
            the stair.

            One baluster every other tread, and the handrail as a single raking
            member per side instead of one short segment per tread. At 175 mm
            risers there are twenty-five treads rather than fourteen, and a
            baluster plus a rail segment on each of them would be a hundred
            meshes for a staircase; this is twenty-eight, fewer than the old
            flight drew, and a continuous rail is what a handrail is. */}
        {[-halfW, halfW].map((x) => (
          <group key={x}>
            {Array.from({ length: Math.ceil(steps / 2) }, (_, n) => {
              const i = n * 2
              return (
                <mesh key={i} castShadow position={[x, (i + 1) * rise + 0.5, -i * going]}>
                  <boxGeometry args={[0.05, 1.0, 0.05]} />
                  <meshStandardMaterial color="#1c1f23" roughness={0.55} metalness={0.4} />
                </mesh>
              )
            })}
            {/* Timber handrail, which is the one warm thing on it. */}
            <mesh
              castShadow
              position={[x, (rise + climb + rise) / 2 + 1.0, -run / 2]}
              rotation={[pitch, 0, 0]}
            >
              <boxGeometry args={[0.1, 0.09, rake]} />
              <meshStandardMaterial color="#6b4227" roughness={0.6} />
            </mesh>
          </group>
        ))}

        {/* Newel posts at the foot of the flight */}
        {[-halfW, halfW].map((x) => (
          <mesh key={x} castShadow position={[x, 0.8, 0.7]}>
            <cylinderGeometry args={[0.07, 0.09, 1.6, 8]} />
            <meshStandardMaterial color="#1c1f23" roughness={0.55} metalness={0.4} />
          </mesh>
        ))}
      </group>
  )
}

function ClassroomDoors({ half }: { half: number }) {
  return (
    <group>
      {CORRIDOR_DOORS.map((z) => (
        <group key={z} position={[-half + 7.4, 0, z]}>
          <mesh position={[0, 1.6, 0]} castShadow>
            <boxGeometry args={[0.12, 3.2, 2.2]} />
            <meshStandardMaterial color="#5a3b25" roughness={0.6} />
          </mesh>
          {/* Architrave behind the leaf, not in front of it. Drawn proud it
              is a blank panel the size of the opening and the door disappears
              behind it — which is the third time this has bitten in this
              codebase, after the gable coping and the window surrounds. */}
          <mesh position={[-0.06, 1.7, 0]}>
            <boxGeometry args={[0.1, 3.5, 2.6]} />
            <meshStandardMaterial color="#dcdfe3" roughness={0.9} />
          </mesh>
          <mesh position={[0.08, 1.1, 0.85]}>
            <sphereGeometry args={[0.07, 8, 6]} />
            <meshStandardMaterial color="#b8a25c" roughness={0.4} metalness={0.7} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function UfazFloor({ spec }: { spec: InteriorSpec }) {
  const half = spec.halfExtent

  return (
    <group>
      <HeritageWindows spec={spec} />
      <Arcade half={half} ceiling={spec.ceiling} />
      <LiftCore ceiling={spec.ceiling} />

      <ClassroomDoors half={half} />

      {/* Corridor benches in the window bays. Forward of the stairwell — see
          the note on their colliders. */}
      {[-2, 4, 10].map((z) => (
        <group key={z} position={[19.4, 0, z]}>
          <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.1, 0.12, 3.2]} />
            <meshStandardMaterial color="#5a4433" roughness={0.7} />
          </mesh>
          {[-1.3, 1.3].map((t) => (
            <mesh key={t} position={[0, 0.22, t]} castShadow>
              <boxGeometry args={[0.9, 0.44, 0.12]} />
              <meshStandardMaterial color="#2b2e33" roughness={0.6} metalness={0.3} />
            </mesh>
          ))}
        </group>
      ))}

      {/* The same flight the hall has, in the same place — which is what
          "the corridors repeat" means, and what the physics now agrees with.
          It was six decorative steps descending through the floor with no
          platforms under them: scenery you walked through, and no way up. */}
      <MainStair />
    </group>
  )
}

function UfazHall({ spec }: { spec: InteriorSpec }) {
  const half = spec.halfExtent

  return (
    <group>
      <HeritageWindows spec={spec} />
      <Turnstiles />
      <LiftCore ceiling={spec.ceiling} />
      <Arcade half={half} ceiling={spec.ceiling} />
      <ClassroomDoors half={half} />

      {/* The corridor floor west of the arcade: dark boards, not the tile of
          the entrance hall. The two surfaces meeting at the arcade is the
          clearest thing in the corridor photographs. */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[-half + 3.2, 0.02, 2]}
        receiveShadow
      >
        <planeGeometry args={[7.6, 32]} />
        <meshStandardMaterial color="#4a3f39" roughness={0.55} />
      </mesh>

      {/*
        Framed photographs along the walls, hung in a line at head height.

        There used to be a colonnade here — five columns a side with capitals
        and bases, on the reasoning that a hall of this period has one. The
        Ministry of Education's photographs of the building show no columns
        anywhere: the circulation is plain yellow wall, a boarded ceiling, and a
        run of framed pictures down one side. The colonnade was the single thing
        making this room read as a marble palace rather than as the restored
        townhouse it is, so it has gone and the pictures have taken its place.
      */}
      {[-1, 1].map((side) =>
        [-15, -9, -3, 3, 9, 15].map((z, i) => (
          <group
            key={`${side}-${z}`}
            position={[side * (half - 1.45), 4.2, z]}
            rotation={[0, side * -Math.PI / 2, 0]}
          >
            <mesh castShadow>
              <boxGeometry args={[i % 2 ? 1.5 : 1.1, i % 2 ? 1.1 : 1.5, 0.09]} />
              <meshStandardMaterial color="#2a2724" roughness={0.6} />
            </mesh>
            <mesh position={[0, 0, 0.06]}>
              <planeGeometry args={[i % 2 ? 1.28 : 0.9, i % 2 ? 0.9 : 1.28]} />
              <meshStandardMaterial color="#e8e2d4" roughness={0.85} />
            </mesh>
          </group>
        )),
      )}

      <MainStair />

      {/* Reception desk. The worktop was near-black, which in a cream marble
          hall read as a monolith rather than a counter. */}
      <group position={[UFAZ_DESK_X, 0, 8]}>
        <mesh castShadow receiveShadow position={[0, 0.55, 0]}>
          <boxGeometry args={[5.5, 1.1, 1.4]} />
          <meshStandardMaterial color="#6d5334" roughness={0.6} />
        </mesh>
        <mesh castShadow position={[0, 1.16, 0]}>
          <boxGeometry args={[6, 0.12, 1.8]} />
          <meshStandardMaterial color="#cbbfa6" roughness={0.3} metalness={0.1} />
        </mesh>
        {/* A monitor on the counter, so somebody works here */}
        <mesh castShadow position={[1.6, 1.55, 0]} rotation={[0, -0.4, 0]}>
          <boxGeometry args={[0.9, 0.6, 0.05]} />
          <meshStandardMaterial color="#1c1f24" emissive="#3f6fa0" emissiveIntensity={0.5} />
        </mesh>
      </group>

      {/* The light rings.

          Thin squares of light on hairline drops, hung at angles across the
          hall — which is the fitting the building uses and the only thing on
          that ceiling. A tiered brass chandelier stood here before, which is a
          hotel lobby; the room is white and modern above the cornice line and
          the lighting is the clearest statement of that. */}
      <LightRings ceiling={spec.ceiling} />

      {/* Flags on stands, as they stand in the real lobby */}
      {([[UFAZ_FLAGS[0], '#00b5e2'], [UFAZ_FLAGS[1], '#000091']] as [number, string][]).map(([x, flagColor]) => (
        <group key={x} position={[x, 0, -half + 15]}>
          <mesh castShadow position={[0, 1.7, 0]}>
            <cylinderGeometry args={[0.05, 0.07, 3.4, 8]} />
            <meshStandardMaterial color="#c9c4bb" roughness={0.4} metalness={0.5} />
          </mesh>
          <mesh castShadow position={[0.55, 2.7, 0]}>
            <planeGeometry args={[1.1, 0.7]} />
            <meshStandardMaterial color={flagColor} side={THREE.DoubleSide} roughness={0.85} />
          </mesh>
          <mesh position={[0, 0.06, 0]}>
            <cylinderGeometry args={[0.4, 0.45, 0.12, 12]} />
            <meshStandardMaterial color="#2f3640" roughness={0.5} metalness={0.4} />
          </mesh>
        </group>
      ))}

      {/* Seating for people waiting, and greenery */}
      {UFAZ_BENCH_Z.map((z) => (
        <group key={z} position={[-half + 8, 0, z]}>
          <mesh castShadow receiveShadow position={[0, 0.45, 0]}>
            <boxGeometry args={[1.6, 0.25, 4.4]} />
            <meshStandardMaterial color="#6d5a45" roughness={0.75} />
          </mesh>
        </group>
      ))}
      {/* The inlaid medallion that used to be here has gone with the marble.
          It existed so an unbroken sheet of stone had something in it; the
          floor is patterned tile now and a dark ring stamped across the pattern
          is one motif too many. */}

      <Plant position={[-half + 3, 0, half - 4]} scale={1.5} />
      <Plant position={[half - 3, 0, half - 4]} scale={1.5} />
      <Plant position={[-half + 3, 0, -half + 6]} scale={1.3} />
      <Plant position={[half - 3, 0, -half + 6]} scale={1.3} />

      {/* Honours boards on the side walls */}
      <WallPanel position={[-half + 0.4, 5, -6]} rotation={Math.PI / 2} size={[5, 3]} panelColor="#e8dcc0" frame={spec.accent} />
      <WallPanel position={[-half + 0.4, 5, 6]} rotation={Math.PI / 2} size={[5, 3]} panelColor="#e8dcc0" frame={spec.accent} />
      <WallPanel position={[half - 0.4, 5, 0]} rotation={-Math.PI / 2} size={[6, 3.4]} panelColor="#dfe8f0" frame={spec.accent} />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Library                                                              */
/* ------------------------------------------------------------------ */

/**
 * Books, instanced.
 *
 * Every shelf on both sides of every stack — around two thousand spines — in a
 * single draw call with a per-instance colour. Modelling them as meshes would
 * be two thousand objects for the renderer to sort, and the spine width is kept
 * wide enough that the shadow pass is not walking six thousand instances.
 */
function Books({ count, layout }: { count: number; layout: { x: number; y: number; z: number; ry: number; w: number }[] }) {
  const mesh = useRef<THREE.InstancedMesh>(null)

  useLayoutEffect(() => {
    const target = mesh.current
    if (!target) return
    const random = mulberry32(90210)
    const palette = ['#8c3b32', '#2f5d7c', '#3f6b47', '#7a5c2e', '#5b3a63', '#2f3f4f', '#96682f']
    layout.forEach((book, i) => {
      dummy.position.set(book.x, book.y, book.z)
      dummy.rotation.set(0, book.ry, 0)
      dummy.scale.set(book.w, 0.9 + random() * 0.28, 1)
      dummy.updateMatrix()
      target.setMatrixAt(i, dummy.matrix)
      color.set(palette[Math.floor(random() * palette.length)])
      // A little shade variation per spine, or the palette reads as stripes.
      color.multiplyScalar(0.82 + random() * 0.36)
      target.setColorAt(i, color)
    })
    target.instanceMatrix.needsUpdate = true
    if (target.instanceColor) target.instanceColor.needsUpdate = true
    target.computeBoundingSphere()
  }, [layout])

  if (!count) return null

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]} castShadow receiveShadow>
      <boxGeometry args={[1, 0.32, 0.24]} />
      <meshStandardMaterial roughness={0.85} />
    </instancedMesh>
  )
}

function LibraryInterior({ spec }: { spec: InteriorSpec }) {
  const half = spec.halfExtent

  const books = useMemo(() => {
    const random = mulberry32(1337)
    const items: { x: number; y: number; z: number; ry: number; w: number }[] = []
    for (const z of STACK_ROWS) {
      // Books follow the shelves, which are now two runs either side of the
      // sightline wedge. Generated across the full width they floated in the
      // aisle with no shelf under them — and stood in the very gap the layout
      // exists to keep clear.
      const aisle = libraryAisleHalf(z)
      const runHalf = ((half - 4) - aisle) / 2
      if (runHalf <= 0.5) continue

      for (let shelf = 0; shelf < 5; shelf++) {
        const y = 0.75 + shelf * 1.05
        for (const run of [-1, 1]) {
        for (const side of [-1, 1]) {
          const runStart = run < 0 ? -(aisle + runHalf * 2) : aisle
          let x = runStart
          while (x < runStart + runHalf * 2) {
            const w = 0.28 + random() * 0.22
            // Leave the occasional gap: a shelf packed edge to edge looks
            // painted on, and someone always has a book out.
            if (random() > 0.08) {
              items.push({ x: x + w / 2, y: y + 0.2, z: z + side * 0.42, ry: 0, w })
            }
            x += w + 0.02
          }
        }
        }
      }
    }
    return items
  }, [half])

  return (
    <group>
      {/* Stacks, in two runs either side of a wedge-shaped aisle aimed at the
          board. See `libraryAisleHalf`: the stacks used to run the full width
          of the room and no reader could see the screen past them. */}
      {STACK_ROWS.map((z) => {
        const aisle = libraryAisleHalf(z)
        const runHalf = ((half - 4) - aisle) / 2
        if (runHalf <= 0.5) return null
        return [-1, 1].map((run) => (
          <group key={`${z}-${run}`} position={[run * (aisle + runHalf), 0, z]}>
            {/* White shelving. The stacks were dark oak, which with the green
                lamps made this a nineteenth-century reading room; the library
                in the roof at Nizami Street is white units, white desks and
                laptops. The books keep their colours — they are the only thing
                in the room that has any. */}
            <mesh castShadow receiveShadow position={[0, 2.9, 0]}>
              <boxGeometry args={[runHalf * 2, 5.8, 0.7]} />
              <meshStandardMaterial color="#e7eaec" roughness={0.75} />
            </mesh>
            {/* Shelf boards, both faces */}
            {[0, 1, 2, 3, 4].map((shelf) =>
              [-1, 1].map((side) => (
                <mesh
                  key={`${shelf}-${side}`}
                  castShadow
                  receiveShadow
                  position={[0, 0.7 + shelf * 1.05, side * 0.5]}
                >
                  <boxGeometry args={[runHalf * 2, 0.09, 0.35]} />
                  <meshStandardMaterial color="#d8dcdf" roughness={0.75} />
                </mesh>
              )),
            )}
          </group>
        ))
      })}

      <Books count={books.length} layout={books} />

      {/* Reading tables under the windows, with green lamps */}
      {[10, 15, 20].map((z) => (
        <group key={z}>
          {[-9, 9].map((x) => (
            <group key={x} position={[x, 0, z]}>
              <Table position={[0, 0, 0]} size={[5, 0.12, 2]} topColor="#eef0f1" />
              <Chair position={[-1.3, 0, 1.5]} rotation={Math.PI} seat="#3b3f45" />
              <Chair position={[1.3, 0, 1.5]} rotation={Math.PI} seat="#3b3f45" />
              <Chair position={[-1.3, 0, -1.5]} seat="#3b3f45" />
              <Chair position={[1.3, 0, -1.5]} seat="#3b3f45" />
              {/* The low screen down the middle of each desk, which is what
                  divides a long table into study places. */}
              <mesh castShadow position={[0, 1.02, 0]}>
                <boxGeometry args={[4.8, 0.42, 0.06]} />
                <meshStandardMaterial color="#f2f4f5" roughness={0.85} />
              </mesh>
              {/* A laptop at each place. */}
              {([[-1.3, 1], [1.3, 1], [-1.3, -1], [1.3, -1]] as [number, number][]).map(
                ([lx, side]) => (
                  <group key={`${lx}-${side}`} position={[lx, 0.83, side * 0.55]}>
                    <mesh castShadow rotation={[-Math.PI / 2, 0, 0]}>
                      <boxGeometry args={[0.42, 0.3, 0.02]} />
                      <meshStandardMaterial color="#c9ced2" roughness={0.5} metalness={0.3} />
                    </mesh>
                    <mesh position={[0, 0.14, -side * 0.15]} rotation={[side * 0.28, 0, 0]}>
                      <boxGeometry args={[0.42, 0.28, 0.015]} />
                      <meshStandardMaterial
                        color="#1b2027"
                        emissive="#3f5f7f"
                        emissiveIntensity={0.35}
                        roughness={0.3}
                      />
                    </mesh>
                  </group>
                ),
              )}
            </group>
          ))}
        </group>
      ))}

      {/* Issue desk, in two runs either side of the doorway. One counter on
          the centre line put the way out of the library through the desk. */}
      {LIBRARY_DESK_X.map((x) => (
        <group key={x} position={[x, 0, half - 4]}>
          <mesh castShadow receiveShadow position={[0, 0.6, 0]}>
            <boxGeometry args={[LIBRARY_DESK_HALF * 2, 1.2, 1.5]} />
            <meshStandardMaterial color="#e7eaec" roughness={0.75} />
          </mesh>
          <mesh castShadow position={[0, 1.26, 0]}>
            <boxGeometry args={[LIBRARY_DESK_HALF * 2 + 0.4, 0.12, 1.9]} />
            <meshStandardMaterial color="#b8bec3" roughness={0.5} />
          </mesh>
        </group>
      ))}

      <Plant position={[-half + 2.5, 0, half - 3]} scale={1.3} />
      <Plant position={[half - 2.5, 0, half - 3]} scale={1.3} />
      <WallPanel position={[half - 0.4, 5, 0]} rotation={-Math.PI / 2} size={[6, 3]} panelColor="#efe6d0" frame={spec.accent} />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Laboratory                                                           */
/* ------------------------------------------------------------------ */

function LabInterior({ spec }: { spec: InteriorSpec }) {
  const half = spec.halfExtent

  return (
    <group>
      {/* Island benches with sinks and taps, in two runs with a walkway down
          the middle: a single twenty-two-metre bench walled the room in two. */}
      {LAB_BENCH_ROWS.flatMap((z) =>
        [-1, 1].map((run) => (
        <group key={`${z}-${run}`} position={[run * (LAB_AISLE + LAB_BENCH_HALF), 0, z]}>
          <mesh castShadow receiveShadow position={[0, 0.45, 0]}>
            <boxGeometry args={[LAB_BENCH_HALF * 2, 0.9, 2.2]} />
            <meshStandardMaterial color="#e6e9ec" roughness={0.6} />
          </mesh>
          <mesh castShadow receiveShadow position={[0, 0.95, 0]}>
            <boxGeometry args={[LAB_BENCH_HALF * 2 + 0.4, 0.14, 2.5]} />
            <meshStandardMaterial color="#33393f" roughness={0.35} metalness={0.15} />
          </mesh>
          {/* Reagent shelf down the spine of the bench */}
          <mesh castShadow position={[0, 1.55, 0]}>
            <boxGeometry args={[LAB_BENCH_HALF * 2, 0.08, 0.6]} />
            <meshStandardMaterial color="#c3ccd3" roughness={0.5} />
          </mesh>
          {[-3, 0, 3].map((x, i) => (
            <group key={x}>
              {/* Tap */}
              <mesh castShadow position={[x, 1.3, 0.7]}>
                <cylinderGeometry args={[0.045, 0.045, 0.65, 8]} />
                <meshStandardMaterial color="#8d959c" roughness={0.25} metalness={0.85} />
              </mesh>
              {/* Sink */}
              <mesh position={[x + 1.2, 1.0, 0.7]}>
                <boxGeometry args={[0.8, 0.06, 0.6]} />
                <meshStandardMaterial color="#5c646b" roughness={0.3} metalness={0.6} />
              </mesh>
              {/* Bottles on the shelf */}
              <mesh castShadow position={[x + 0.4, 1.85, 0]}>
                <cylinderGeometry args={[0.13, 0.13, 0.5, 10]} />
                <meshStandardMaterial
                  color={i % 2 === 0 ? '#7fd4a8' : '#d4a87f'}
                  transparent
                  opacity={0.8}
                  roughness={0.15}
                />
              </mesh>
            </group>
          ))}
        </group>
        )),
      )}

      {/* Fume cupboards along the back wall, moved out to leave the middle of
          the screen wall clear */}
      {FUME_CUPBOARDS.map((x) => (
        <group key={x} position={[x, 0, -half + 1.4]}>
          <mesh castShadow receiveShadow position={[0, 1.9, 0]}>
            <boxGeometry args={[7.6, 3.8, 2.2]} />
            <meshStandardMaterial color="#cfd6dc" roughness={0.6} />
          </mesh>
          {/* Sash: the glass front, raised */}
          <mesh position={[0, 2.4, 1.16]}>
            <boxGeometry args={[6.8, 1.9, 0.08]} />
            <meshStandardMaterial
              color="#a8d8f0"
              transparent
              opacity={0.42}
              roughness={0.06}
              metalness={0.3}
            />
          </mesh>
          <mesh position={[0, 1.2, 1.15]}>
            <boxGeometry args={[6.8, 0.1, 0.5]} />
            <meshStandardMaterial color="#4c5560" roughness={0.4} metalness={0.5} />
          </mesh>
          {/* Interior strip light, so the cabinet glows */}
          <mesh position={[0, 3.5, 0]}>
            <boxGeometry args={[6.4, 0.08, 0.4]} />
            <meshStandardMaterial color="#ffffff" emissive="#dff2ff" emissiveIntensity={2} toneMapped={false} />
          </mesh>
        </group>
      ))}

      {/* Eyewash and safety shower in the corner */}
      <group position={[half - 2.5, 0, half - 3]}>
        <mesh castShadow position={[0, 2.2, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 4.4, 8]} />
          <meshStandardMaterial color="#c8ccd0" roughness={0.3} metalness={0.7} />
        </mesh>
        <mesh castShadow position={[0, 4.3, 0]}>
          <cylinderGeometry args={[0.55, 0.35, 0.18, 14]} />
          <meshStandardMaterial color="#2f9b4f" roughness={0.5} />
        </mesh>
      </group>

      {/* Periodic table and safety notices */}
      <WallPanel position={[-half + 0.4, 4.6, 0]} rotation={Math.PI / 2} size={[9, 4.5]} panelColor="#e9f1f6" frame="#39424b" />
      <WallPanel position={[half - 0.4, 4.6, -6]} rotation={-Math.PI / 2} size={[3.4, 2.4]} panelColor="#ffe066" frame="#39424b" />
      <WallPanel position={[half - 0.4, 4.6, 2]} rotation={-Math.PI / 2} size={[3.4, 2.4]} panelColor="#8fd0ff" frame="#39424b" />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Amphitheatre                                                         */
/* ------------------------------------------------------------------ */

/**
 * Full-height curtains either side of each window.
 *
 * The conference hall's windows are hung with long grey-brown curtains from a
 * rail near the ceiling to the floor, and they are half of what the wall looks
 * like — the arched openings read as openings partly because of the vertical
 * dark bands framing them.
 *
 * A gathered curtain is a lathe of folds; these are a shallow scallop of four
 * boxes, which at the distance anybody stands from them is the same picture.
 */
function Curtains({ half, ceiling, at }: { half: number; ceiling: number; at: number[] }) {
  const top = ceiling - 0.9
  return (
    <group>
      {[-1, 1].map((wall) =>
        at.map((z) => (
          <group key={`${wall}-${z}`} position={[wall * (half - 0.35), 0, z]}>
            {/* Rail. */}
            <mesh position={[0, top + 0.2, 0]}>
              <boxGeometry args={[0.1, 0.08, 5.4]} />
              <meshStandardMaterial color="#b9a98c" roughness={0.6} metalness={0.3} />
            </mesh>
            {[-1, 1].map((side) =>
              [0, 1, 2, 3].map((fold) => (
                <mesh
                  key={`${side}-${fold}`}
                  position={[
                    -wall * (0.06 + (fold % 2) * 0.07),
                    top / 2,
                    side * (1.9 + fold * 0.26),
                  ]}
                  castShadow
                >
                  <boxGeometry args={[0.16, top, 0.26]} />
                  <meshStandardMaterial color="#6f6a60" roughness={0.98} />
                </mesh>
              )),
            )}
          </group>
        )),
      )}
    </group>
  )
}

function LectureInterior({ spec, whiteboard }: { spec: InteriorSpec; whiteboard?: React.ReactNode }) {
  const half = spec.halfExtent

  return (
    <group>
      {/* Raked seating: each row on its own step, rising towards the back.
          The old room put flat desks on a flat floor, which is not what an
          amphitheatre is. */}
      <Curtains half={half} ceiling={spec.ceiling} at={[-8, 0, 8]} />

      {LECTURE_ROWS.map((row) => {
        const z = LECTURE_SEATING.frontZ + row * LECTURE_SEATING.rowDepth
        const y = row * LECTURE_SEATING.riser
        return (
          <group key={row} position={[0, y, z]}>
            {/* The step itself */}
            <mesh castShadow receiveShadow position={[0, -LECTURE_SEATING.riser / 2, 0]}>
              <boxGeometry args={[half * 1.85, LECTURE_SEATING.riser, LECTURE_SEATING.rowDepth]} />
              <meshStandardMaterial color="#8f8a7c" roughness={0.95} />
            </mesh>
            {/* Continuous desk */}
            {/* A dark timber shelf on a dark metal frame, which is what the
                rows are: a mid-oak desk with a matching modesty panel made the
                hall read as a school. */}
            <mesh castShadow receiveShadow position={[0, 0.75, -1.5]}>
              <boxGeometry args={[half * 1.7, 0.1, 1.3]} />
              <meshStandardMaterial color="#6a4a30" roughness={0.6} />
            </mesh>
            <mesh castShadow position={[0, 0.4, -2.1]}>
              <boxGeometry args={[half * 1.7, 0.7, 0.06]} />
              <meshStandardMaterial color="#26292d" roughness={0.7} metalness={0.25} />
            </mesh>
            {/* Tip-up seats */}
            {Array.from({ length: 9 }, (_, i) => {
              const x = -half * 0.78 + i * ((half * 1.56) / 8)
              return (
                <group key={i} position={[x, 0, 0.4]}>
                  {/* Upholstered, in the taupe the hall is seated in, on a
                      dark frame. Padded rather than flat boards: a tip-up seat
                      is mostly the cushion. */}
                  <mesh castShadow position={[0, 0.46, 0]}>
                    <boxGeometry args={[0.66, 0.16, 0.62]} />
                    <meshStandardMaterial color="#8b8579" roughness={0.95} />
                  </mesh>
                  <mesh castShadow position={[0, 0.86, 0.3]}>
                    <boxGeometry args={[0.66, 0.8, 0.16]} />
                    <meshStandardMaterial color="#8b8579" roughness={0.95} />
                  </mesh>
                  <mesh castShadow position={[0, 0.2, 0.28]}>
                    <boxGeometry args={[0.1, 0.4, 0.1]} />
                    <meshStandardMaterial color="#26292d" roughness={0.7} metalness={0.3} />
                  </mesh>
                </group>
              )
            })}
          </group>
        )
      })}

      {/* Lectern down at the front */}
      <group position={[-7, 0, -half + 6]}>
        <mesh castShadow position={[0, 0.6, 0]}>
          <boxGeometry args={[1.5, 1.2, 0.9]} />
          <meshStandardMaterial color="#6b4f34" roughness={0.8} />
        </mesh>
        <mesh castShadow position={[0, 1.24, 0]} rotation={[-0.3, 0, 0]}>
          <boxGeometry args={[1.7, 0.08, 0.95]} />
          <meshStandardMaterial color="#7d5c3d" roughness={0.75} />
        </mesh>
        <mesh position={[0, 1.35, 0.1]} rotation={[-0.3, 0, 0]}>
          <boxGeometry args={[0.7, 0.02, 0.45]} />
          <meshStandardMaterial color="#1c1f24" emissive="#3f6fa0" emissiveIntensity={0.6} />
        </mesh>
      </group>

      {/* A whiteboard one side, today's real timetable the other. The board
          used to be a second blank rectangle. */}
      {whiteboard ?? (
        <mesh castShadow position={[-13, 4.4, -half + 0.5]}>
          <boxGeometry args={[7.5, 4, 0.2]} />
          <meshStandardMaterial color="#f4f6f4" roughness={0.25} />
        </mesh>
      )}
      <ScheduleBoard position={[13, 4.4, -half + 0.65]} />

      {/* A dark band behind the screen, so a projected image has contrast */}
      <mesh position={[0, 5.6, -half + 0.42]} receiveShadow>
        <boxGeometry args={[19, 9, 0.3]} />
        <meshStandardMaterial color="#1f2733" roughness={0.7} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Student centre                                                       */
/* ------------------------------------------------------------------ */

function Sofa({ position, rotation = 0, fabric = '#3f8f7f' }: { position: Vec3; rotation?: number; fabric?: string }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh castShadow receiveShadow position={[0, 0.4, 0]}>
        <boxGeometry args={[3.2, 0.55, 1.3]} />
        <meshStandardMaterial color={fabric} roughness={0.95} />
      </mesh>
      <mesh castShadow position={[0, 0.95, -0.58]}>
        <boxGeometry args={[3.2, 0.95, 0.28]} />
        <meshStandardMaterial color={fabric} roughness={0.95} />
      </mesh>
      {[-1.6, 1.6].map((x) => (
        <mesh key={x} castShadow position={[x, 0.75, 0]}>
          <boxGeometry args={[0.26, 0.85, 1.3]} />
          <meshStandardMaterial color={fabric} roughness={0.95} />
        </mesh>
      ))}
      {/* Feet. Without them the whole thing hovered a hand's width off the floor. */}
      {([[-1.4, -0.5], [1.4, -0.5], [-1.4, 0.5], [1.4, 0.5]] as [number, number][]).map(([x, z], i) => (
        <mesh key={i} castShadow position={[x, 0.07, z]}>
          <cylinderGeometry args={[0.07, 0.07, 0.14, 6]} />
          <meshStandardMaterial color="#2f2a26" roughness={0.7} />
        </mesh>
      ))}
    </group>
  )
}

function StudentCentreInterior({ spec }: { spec: InteriorSpec }) {
  const half = spec.halfExtent

  return (
    <group>
      {/* Lounge clusters */}
      {LOUNGE_CLUSTERS.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <Sofa position={[0, 0, LOUNGE_SOFA_OFFSET]} rotation={Math.PI} fabric={i === 1 ? '#8a5f7f' : '#3f8f7f'} />
          <Sofa position={[0, 0, -LOUNGE_SOFA_OFFSET]} fabric={i === 1 ? '#8a5f7f' : '#3f8f7f'} />
          <Table position={[0, 0, 0]} size={[2.2, 0.1, 1.1]} topColor="#4a4038" legColor="#2f3640" />
        </group>
      ))}

      {/* Table football, which is what a student centre is actually for */}
      <group position={[TABLE_FOOTBALL[0], 0, TABLE_FOOTBALL[1]]}>
        <mesh castShadow receiveShadow position={[0, 0.5, 0]}>
          <boxGeometry args={[4.2, 1, 2.4]} />
          <meshStandardMaterial color="#2f4a3f" roughness={0.7} />
        </mesh>
        <mesh position={[0, 1.02, 0]}>
          <boxGeometry args={[3.9, 0.05, 2.1]} />
          <meshStandardMaterial color="#2f7a4a" roughness={0.9} />
        </mesh>
        {[-1.5, -0.5, 0.5, 1.5].map((x) => (
          <group key={x}>
            <mesh castShadow position={[x, 1.25, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.05, 0.05, 3.2, 8]} />
              <meshStandardMaterial color="#b9c0c7" roughness={0.3} metalness={0.8} />
            </mesh>
            {[-0.7, 0, 0.7].map((z) => (
              <mesh key={z} castShadow position={[x, 1.25, z]}>
                <boxGeometry args={[0.18, 0.42, 0.16]} />
                <meshStandardMaterial color={x < 0 ? '#d94f4f' : '#3f7fd9'} roughness={0.6} />
              </mesh>
            ))}
          </group>
        ))}
      </group>

      {/* Vending machines, off the centre of the back wall so they are not
          standing in front of the screen */}
      {VENDING_MACHINES.map((x) => (
        <group key={x} position={[x, 0, -half + 1.2]}>
          <mesh castShadow receiveShadow position={[0, 1.5, 0]}>
            <boxGeometry args={[2.4, 3, 1.1]} />
            <meshStandardMaterial color="#26303c" roughness={0.6} metalness={0.2} />
          </mesh>
          <mesh position={[0, 1.8, 0.58]}>
            <planeGeometry args={[1.9, 2]} />
            <meshStandardMaterial
              color="#8fd0ff"
              emissive="#8fd0ff"
              emissiveIntensity={0.9}
              transparent
              opacity={0.75}
            />
          </mesh>
        </group>
      ))}

      {/* Coffee bar along the side wall */}
      <group position={[-half + 2.6, 0, -12]} rotation={[0, Math.PI / 2, 0]}>
        <mesh castShadow receiveShadow position={[0, 0.6, 0]}>
          <boxGeometry args={[10, 1.2, 1.6]} />
          <meshStandardMaterial color="#4a3a2c" roughness={0.7} />
        </mesh>
        <mesh castShadow position={[0, 1.27, 0]}>
          <boxGeometry args={[10.4, 0.14, 2]} />
          <meshStandardMaterial color="#22272d" roughness={0.3} metalness={0.3} />
        </mesh>
        <mesh castShadow position={[-2, 1.75, 0]}>
          <boxGeometry args={[1.4, 0.85, 0.9]} />
          <meshStandardMaterial color="#8d959c" roughness={0.25} metalness={0.8} />
        </mesh>
      </group>

      {/* Ping-pong table, because there is always one */}
      <group position={[-9, 0, 16]}>
        <mesh castShadow receiveShadow position={[0, 0.74, 0]}>
          <boxGeometry args={[4.6, 0.08, 2.6]} />
          <meshStandardMaterial color="#1f4f8f" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.9, 0]}>
          <boxGeometry args={[0.04, 0.3, 2.8]} />
          <meshStandardMaterial color="#e8ebee" roughness={0.9} transparent opacity={0.85} />
        </mesh>
        {([[-2.1, -1.1], [2.1, -1.1], [-2.1, 1.1], [2.1, 1.1]] as [number, number][]).map(([x, z], i) => (
          <mesh key={i} castShadow position={[x, 0.36, z]}>
            <boxGeometry args={[0.1, 0.72, 0.1]} />
            <meshStandardMaterial color="#2f3640" roughness={0.6} metalness={0.3} />
          </mesh>
        ))}
      </group>

      {/* Booths along the far corner, so the back of the room is not dead space */}
      {[-16, -10.5].map((z) => (
        <group key={z} position={[15, 0, z]}>
          <mesh castShadow receiveShadow position={[0, 0.75, 0]}>
            <boxGeometry args={[2.6, 0.1, 1.3]} />
            <meshStandardMaterial color="#7a5c3d" roughness={0.75} />
          </mesh>
          {[-1, 1].map((side) => (
            <mesh key={side} castShadow position={[0, 0.7, side * 1.1]}>
              <boxGeometry args={[2.6, 1.4, 0.4]} />
              <meshStandardMaterial color="#3f8f7f" roughness={0.95} />
            </mesh>
          ))}
        </group>
      ))}

      <Plant position={[half - 3, 0, half - 4]} scale={1.6} />
      <Plant position={[-half + 3, 0, half - 4]} scale={1.4} />
      <Plant position={[half - 3, 0, -half + 5]} scale={1.2} />
      <Plant position={[-half + 3, 0, -half + 5]} scale={1.3} />
      <Plant position={[-half + 3, 0, 4]} scale={1.1} />

      {/* The latest posts from the blog, rather than another blank panel. */}
      <NoticeBoard position={[half - 0.55, 4.6, 6]} rotation={-Math.PI / 2} />
      {/* And the sites students have actually published, opposite. The blank
          panel that used to hang here was the last decoration in the room
          standing in for something the platform already knows. */}
      <SitesBoard position={[-half + 0.55, 4.6, 12]} rotation={Math.PI / 2} />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Cafeteria                                                            */
/* ------------------------------------------------------------------ */

function CafeteriaInterior({ spec }: { spec: InteriorSpec }) {
  const half = spec.halfExtent

  return (
    <group>
      {/* Servery along the back wall: counter, sneeze guard, hot trays */}
      <group position={[0, 0, -half + 3]}>
        <mesh castShadow receiveShadow position={[0, 0.55, 0]}>
          <boxGeometry args={[26, 1.1, 2.2]} />
          <meshStandardMaterial color="#b5b9bd" roughness={0.45} metalness={0.35} />
        </mesh>
        <mesh castShadow position={[0, 1.16, 0]}>
          <boxGeometry args={[26.4, 0.12, 2.6]} />
          <meshStandardMaterial color="#8d959c" roughness={0.25} metalness={0.75} />
        </mesh>
        {/* Glass guard */}
        <mesh position={[0, 1.85, 0.9]}>
          <boxGeometry args={[26, 1.2, 0.06]} />
          <meshStandardMaterial color="#cfe8f5" transparent opacity={0.32} roughness={0.05} metalness={0.2} />
        </mesh>
        {/* Gastronorm trays of food */}
        {[-10, -7, -4, -1, 2, 5, 8, 11].map((x, i) => (
          <mesh key={x} position={[x, 1.24, 0]} receiveShadow>
            <boxGeometry args={[2.4, 0.14, 1.5]} />
            <meshStandardMaterial
              color={['#c2703f', '#d9b44a', '#7f9c4a', '#b04a3a'][i % 4]}
              roughness={0.7}
            />
          </mesh>
        ))}
        {/* Heat lamps */}
        {/* Heat lamps, hung below the bottom of the projector screen rather
            than across it */}
        {[-8, -2, 4, 10].map((x) => (
          <mesh key={x} position={[x, CAFE_HEAT_LAMP_Y, 0]}>
            <boxGeometry args={[3, 0.12, 0.8]} />
            <meshStandardMaterial color="#ffb066" emissive="#ff9a3c" emissiveIntensity={1.8} toneMapped={false} />
          </mesh>
        ))}
      </group>

      {/* Tray rail */}
      <mesh castShadow position={[0, 0.95, -half + 4.6]}>
        <boxGeometry args={[26, 0.08, 0.5]} />
        <meshStandardMaterial color="#8d959c" roughness={0.3} metalness={0.8} />
      </mesh>

      {/* Dining tables */}
      {[-8, -1, 6, 13].map((z) =>
        [-11, -3.5, 4, 11.5].map((x) => (
          <group key={`${x}-${z}`} position={[x, 0, z]}>
            <Table position={[0, 0, 0]} size={[3, 0.1, 1.5]} topColor="#c8a27a" legColor="#5c646b" />
            <Chair position={[-0.8, 0, 1.4]} rotation={Math.PI} seat="#c2703f" />
            <Chair position={[0.8, 0, 1.4]} rotation={Math.PI} seat="#c2703f" />
            <Chair position={[-0.8, 0, -1.4]} seat="#c2703f" />
            <Chair position={[0.8, 0, -1.4]} seat="#c2703f" />
          </group>
        )),
      )}

      {/* Menu boards over the servery */}
      {[-9, 0, 9].map((x) => (
        <WallPanel
          key={x}
          position={[x, 5.4, -half + 0.4]}
          size={[6, 2.4]}
          panelColor="#1f2733"
          frame="#0f141a"
        />
      ))}

      {/* Bins and a water station beside the door, not across it. */}
      {CAFE_BINS.map((x) => (
        <mesh key={x} castShadow receiveShadow position={[x, 0.6, half - 2.5]}>
          <boxGeometry args={[1, 1.2, 1]} />
          <meshStandardMaterial color={x === 0 ? '#3f7f4a' : x < 0 ? '#3f6f9f' : '#7f6f3f'} roughness={0.8} />
        </mesh>
      ))}

      <Plant position={[half - 2.5, 0, half - 3]} scale={1.3} />
      <Plant position={[-half + 2.5, 0, half - 3]} scale={1.3} />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Sports hall                                                          */
/* ------------------------------------------------------------------ */

function SportsInterior({ spec }: { spec: InteriorSpec }) {
  const half = spec.halfExtent
  const line = { color: '#e8e2d2', roughness: 0.6 }

  return (
    <group>
      {/* Court markings, painted on the boards just above the floor */}
      <group position={[0, 0.02, 0]}>
        {([
          [0, -half + 3, (half - 3) * 2, 0.22],
          [0, half - 3, (half - 3) * 2, 0.22],
          [-(half - 3), 0, 0.22, (half - 3) * 2],
          [half - 3, 0, 0.22, (half - 3) * 2],
          [0, 0, (half - 3) * 2, 0.22],
        ] as [number, number, number, number][]).map(([x, z, w, d], i) => (
          <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0, z]}>
            <planeGeometry args={[w, d]} />
            <meshStandardMaterial {...line} />
          </mesh>
        ))}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[3.4, 3.62, 48]} />
          <meshStandardMaterial {...line} />
        </mesh>
        {/* Keys at both ends */}
        {[-1, 1].map((side) => (
          <mesh key={side} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, side * (half - 6.5)]}>
            <ringGeometry args={[5.6, 5.82, 48, 1, 0, Math.PI]} />
            <meshStandardMaterial {...line} />
          </mesh>
        ))}
      </group>

      {/* Bleachers down one side */}
      {Array.from({ length: BLEACHER_TIERS }, (_, tier) => (
        <group key={tier} position={[-half + 2.6 + tier * 1.4, tier * 0.7, 0]}>
          <mesh castShadow receiveShadow position={[0, 0.35, 0]}>
            <boxGeometry args={[1.4, 0.7, half * 1.5]} />
            <meshStandardMaterial color="#9aa2ab" roughness={0.9} />
          </mesh>
          <mesh castShadow position={[0, 0.74, 0]}>
            <boxGeometry args={[1.3, 0.1, half * 1.5]} />
            <meshStandardMaterial color={spec.accent} roughness={0.8} />
          </mesh>
        </group>
      ))}

      {/* Wall bars on the far side */}
      {Array.from({ length: 10 }, (_, i) => (
        <mesh key={i} castShadow position={[half - 0.7, 1.2 + i * 0.55, 6]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.07, 0.07, 5, 8]} />
          <meshStandardMaterial color="#c2954f" roughness={0.7} />
        </mesh>
      ))}

      {/* Scoreboard */}
      {/* Scoreboard, raised clear of the projector screen below it */}
      <group position={[0, SCOREBOARD_Y, -half + 0.6]}>
        <mesh castShadow>
          <boxGeometry args={[9, 3.4, 0.4]} />
          <meshStandardMaterial color="#171c22" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0, 0.22]}>
          <planeGeometry args={[8.2, 2.6]} />
          <meshStandardMaterial color="#0d1116" roughness={0.8} />
        </mesh>
        {/* Segments, so it reads as a scoreboard rather than a lit panel */}
        {[-2.6, -1.6, 1.6, 2.6].map((x) => (
          <mesh key={x} position={[x, -0.2, 0.25]}>
            <planeGeometry args={[0.7, 1.2]} />
            <meshStandardMaterial
              color="#ff7a3c"
              emissive="#ff7a3c"
              emissiveIntensity={1.5}
              toneMapped={false}
            />
          </mesh>
        ))}
        <mesh position={[0, -0.2, 0.25]}>
          <planeGeometry args={[0.9, 0.9]} />
          <meshStandardMaterial color="#ffd166" emissive="#ffd166" emissiveIntensity={1.2} toneMapped={false} />
        </mesh>
      </group>

      {/* Roof trusses, which is what you actually look at in a sports hall */}
      {[-14, -7, 0, 7, 14].map((z) => (
        <mesh key={z} castShadow position={[0, spec.ceiling - 1.2, z]}>
          <boxGeometry args={[half * 2 - 1, 0.5, 0.4]} />
          <meshStandardMaterial color="#8d959c" roughness={0.5} metalness={0.5} />
        </mesh>
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ */

interface InteriorProps {
  spec: InteriorSpec
  /** The shared whiteboard, for the room that has one. */
  whiteboard?: React.ReactNode
}

const CONTENTS: Record<InteriorKind, (props: InteriorProps) => React.ReactElement> = {
  ufaz: UfazHall,
  'ufaz-floor': UfazFloor,
  library: LibraryInterior,
  lab: LabInterior,
  lecture: LectureInterior,
  'student-center': StudentCentreInterior,
  cafeteria: CafeteriaInterior,
  sports: SportsInterior,
}

/**
 * The interior of one building.
 *
 * `children` is whatever the page wants to mount inside — the projector screen,
 * and a mini-game station where the building has one.
 */
export function BuildingInterior({
  kind = 'lecture',
  lit = true,
  children,
  whiteboard,
}: {
  kind?: InteriorKind
  /** Whether the room's lights are on, which everybody in it shares. */
  lit?: boolean
  children?: React.ReactNode
  /** Mounted by the page, which owns the socket the strokes travel over. */
  whiteboard?: React.ReactNode
}) {
  const spec = INTERIOR_SPECS[kind] ?? INTERIOR_SPECS.lecture
  const Contents = CONTENTS[kind] ?? LectureInterior

  return (
    <RoomShell spec={spec} lit={lit}>
      <Contents spec={spec} whiteboard={whiteboard} />
      {children}
    </RoomShell>
  )
}

