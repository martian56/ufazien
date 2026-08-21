import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows } from '@react-three/drei'
import { Check, Loader2, User } from 'lucide-react'
import * as THREE from 'three'

import { GltfCharacter } from '../../components/campus/GltfCharacter'
import {
  AVATAR_CATALOGUE,
  UNCHOSEN,
  characterFor,
  type CampusCharacter,
} from '../../components/campus/avatarCatalogue'
import { api } from '../../lib/api/client'

/**
 * Who you are in the campus, and how to change it.
 *
 * The body was always derived from the player's user id and never shown
 * anywhere: you found out what you looked like by walking into a room. This
 * puts it on the menu you pass through on the way in, which is the one moment
 * you are thinking about it and not about where you are going.
 */

/**
 * The angle the character is first seen from.
 *
 * Three-quarters rather than square on, which is what makes a figure read as a
 * solid thing rather than as a picture of one — and it is the angle a person
 * would turn a model to if you handed it to them.
 */
const OPENING_ANGLE = -0.55

/**
 * Turned by hand, not on its own.
 *
 * It used to rotate continuously. A figure that never stops turning is one you
 * cannot actually look at: the side you want is always about to leave, and
 * choosing between six of them means waiting for each to come round. Now it
 * holds still and the player turns it, which is also the only way to look at
 * the back of one on purpose.
 */
function TurnByHand({ children }: { children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null)
  // Which finger is turning them, by id. A second one landing on the canvas
  // would otherwise take over mid-drag and the character would jump to wherever
  // it happened to touch down — and lifting it would end a drag the first
  // finger is still making.
  const turning = useRef<number | null>(null)
  const lastX = useRef(0)
  const { gl } = useThree()

  useEffect(() => {
    const canvas = gl.domElement

    const down = (e: PointerEvent) => {
      if (turning.current !== null) return
      turning.current = e.pointerId
      lastX.current = e.clientX
      canvas.setPointerCapture?.(e.pointerId)
    }
    const move = (e: PointerEvent) => {
      if (e.pointerId !== turning.current || !group.current) return
      // A drag across the full width turns them most of the way round, which
      // is the rate that feels like a hand on a shoulder rather than a dial.
      group.current.rotation.y += ((e.clientX - lastX.current) / canvas.clientWidth) * Math.PI * 2
      lastX.current = e.clientX
    }
    const up = (e: PointerEvent) => {
      if (e.pointerId !== turning.current) return
      turning.current = null
      canvas.releasePointerCapture?.(e.pointerId)
    }

    canvas.addEventListener('pointerdown', down)
    canvas.addEventListener('pointermove', move)
    canvas.addEventListener('pointerup', up)
    canvas.addEventListener('pointercancel', up)
    canvas.addEventListener('pointerleave', up)
    return () => {
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerup', up)
      canvas.removeEventListener('pointercancel', up)
      canvas.removeEventListener('pointerleave', up)
    }
  }, [gl])

  return (
    <group ref={group} rotation={[0, OPENING_ANGLE, 0]}>
      {children}
    </group>
  )
}

/** Where the character stands. Their feet are at the origin of this group. */
const FLOOR = -0.86

function Stage({ file, seed }: { file: string; seed: number | string }) {
  return (
    <>
      {/* Three-point-ish, and no environment map anywhere in this project — so
          nothing here is allowed to be shiny. See the note in CLAUDE.md.
          The rim from behind is what separates the shoulders from the
          background, and it is most of why this reads as three-dimensional. */}
      <hemisphereLight args={['#dce6f2', '#4a4a55', 1.2]} />
      <directionalLight position={[3, 6, 4]} intensity={2.1} />
      <directionalLight position={[-4, 3, -3]} intensity={0.7} color="#cfe0ff" />
      <directionalLight position={[0, 4, -6]} intensity={1.1} color="#ffffff" />

      <Suspense fallback={null}>
        <TurnByHand>
          {/* Keyed on the file: swapping the mesh means a new skeleton, and
              reusing the component across that swap leaves the old bones bound. */}
          <group key={file} position={[0, FLOOR, 0]}>
            <GltfCharacter variant={seed} character={fileToId(file)} activity="standing" />
          </group>
        </TurnByHand>

        {/* Standing on something. A figure floating on a flat panel is the
            single thing that makes a 3D preview look like a cut-out; a shadow
            under the feet costs one draw and fixes it. */}
        <ContactShadows
          position={[0, FLOOR + 0.002, 0]}
          scale={4}
          blur={2.4}
          opacity={0.5}
          far={2}
          resolution={512}
          color="#1e293b"
        />
      </Suspense>
    </>
  )
}

/** The catalogue is keyed by id; the preview is chosen by file. */
function fileToId(file: string): string {
  return AVATAR_CATALOGUE.find((entry) => entry.file === file)?.id ?? UNCHOSEN
}

export interface CharacterPickerProps {
  /** The signed-in player, whose id is the fallback body. */
  userId: number | string
  /** What they have chosen, or '' if they never have. */
  chosen: string
  onChosen: (id: string) => void
  /**
   * Where this is being shown.
   *
   * `sidebar` is the narrow column beside the lobby list on a wide screen:
   * everything stacks. `sheet` is the panel a phone opens over the page, where
   * there is width to put the choices beside the preview and the height is
   * what is scarce. Same component either way — the difference is which axis
   * is short, and that is not worth a second implementation.
   */
  layout?: 'sidebar' | 'sheet'
}

export default function CharacterPicker({
  userId,
  chosen,
  onChosen,
  layout = 'sidebar',
}: CharacterPickerProps) {
  // What the preview shows: follows the saved value, but moves the instant you
  // click so the turntable does not wait on a round trip.
  const [previewing, setPreviewing] = useState<CampusCharacter>(() =>
    characterFor(chosen, userId),
  )
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setPreviewing(characterFor(chosen, userId))
  }, [chosen, userId])

  // Whether this is a choice or just what their id gave them, which the copy
  // under the preview says out loud — otherwise "you are wearing this" is a
  // claim the player never made.
  const isChoice = useMemo(
    () => AVATAR_CATALOGUE.some((entry) => entry.id === chosen),
    [chosen],
  )

  async function choose(entry: CampusCharacter) {
    setPreviewing(entry)
    setError(null)
    setSaving(entry.id)
    try {
      // The profile endpoint, because this is a profile attribute — it follows
      // the player between lobbies rather than belonging to one.
      await api.patch('/auth/user/', { campus_character: entry.id })
      onChosen(entry.id)
    } catch {
      setError('Could not save that. Your character is unchanged.')
      setPreviewing(characterFor(chosen, userId))
    } finally {
      setSaving(null)
    }
  }

  const stacked = layout === 'sidebar'

  return (
    <div>
      <div className={stacked ? 'flex flex-col gap-3' : 'flex flex-row gap-4'}>
        <div
          className={`relative overflow-hidden rounded-xl border border-gray-200 bg-gradient-to-b from-slate-50 via-slate-100 to-slate-300 shrink-0 ${
            stacked ? 'w-full h-80' : 'w-44 h-60 sm:w-56 sm:h-72'
          }`}
        >
          <Canvas
            // Framed to hold the whole figure with air over the head: the
            // characters are 1.72 m, and 32° from 2.5 m sees 1.43 m of them —
            // which cuts them off at the neck. Slightly above eye level and
            // looking very slightly down, the way you would hold a figure up.
            camera={{ position: [0, 0.1, 3.15], fov: 38 }}
            dpr={[1, 2]}
            // The menu is not the campus: one figure does not need a frame
            // budget, and a menu that spins a fan is a bad first impression of
            // a 3D feature. It stays on so the idle animation breathes — a
            // character standing perfectly frozen is the other way to look flat.
            frameloop="always"
            // The drag turns the character; it must not also scroll the page
            // out from under the finger doing it.
            style={{ touchAction: 'none', cursor: 'grab' }}
          >
            <Stage file={previewing.file} seed={userId} />
          </Canvas>

          {/* Said once, quietly. Nothing about a still figure suggests it can
              be turned, and the whole point of stopping the spin is that the
              player decides which way it faces. */}
          {/* Off the figure rather than across its feet, and on something, so
              it is legible against whatever is behind it. */}
          <p className="pointer-events-none absolute right-2 top-2 rounded-full bg-slate-900/50 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
            Drag to turn
          </p>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm text-gray-500 mb-3">
            {isChoice
              ? 'This is the character you picked. Everyone in a lobby sees it.'
              : 'You have not picked one, so the campus gives you this. Choose to keep it or change it.'}
          </p>

          {/* Grouped, because with six of them an ungrouped row has two
              "Casual" and two "Suit" in it and the only thing telling them
              apart is the preview you have not hovered yet. */}
          <div className="space-y-3" role="radiogroup" aria-label="Campus character">
            {(['men', 'women'] as const).map((group) => {
              const entries = AVATAR_CATALOGUE.filter((entry) => entry.group === group)
              if (entries.length === 0) return null
              return (
                <div key={group}>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                    {group === 'men' ? 'Men' : 'Women'}
                  </p>
                  <div className={`gap-2 ${stacked ? 'grid grid-cols-2' : 'flex flex-wrap'}`}>
                    {entries.map((entry) => {
                      const selected = entry.id === chosen
                      return (
                        <button
                          key={entry.id}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          aria-label={`${group === 'men' ? 'Man' : 'Woman'}, ${entry.label}`}
                          disabled={saving !== null}
                          onMouseEnter={() => setPreviewing(entry)}
                          onFocus={() => setPreviewing(entry)}
                          onMouseLeave={() => setPreviewing(characterFor(chosen, userId))}
                          onBlur={() => setPreviewing(characterFor(chosen, userId))}
                          onClick={() => choose(entry)}
                          className={`flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60 ${
                            selected
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <span>{entry.label}</span>
                          {saving === entry.id ? (
                            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                          ) : selected ? (
                            <Check className="w-4 h-4 shrink-0" />
                          ) : null}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
        </div>
      </div>
    </div>
  )
}
