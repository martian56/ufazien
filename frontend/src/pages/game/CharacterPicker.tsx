import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
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

/** Slowly turning, so the character reads in the round rather than as a photo. */
function Turntable({ children }: { children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null)
  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.55
  })
  return <group ref={group}>{children}</group>
}

function Stage({ file, seed }: { file: string; seed: number | string }) {
  return (
    <>
      {/* Three-point-ish, and no environment map anywhere in this project — so
          nothing here is allowed to be shiny. See the note in CLAUDE.md. */}
      <hemisphereLight args={['#dce6f2', '#4a4a55', 1.5]} />
      <directionalLight position={[3, 6, 4]} intensity={2.2} />
      <directionalLight position={[-4, 3, -3]} intensity={0.7} color="#cfe0ff" />
      <Suspense fallback={null}>
        <Turntable>
          {/* Keyed on the file: swapping the mesh means a new skeleton, and
              reusing the component across that swap leaves the old bones bound. */}
          <group key={file} position={[0, -0.86, 0]}>
            <GltfCharacter variant={seed} character={fileToId(file)} activity="standing" />
          </group>
        </Turntable>
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
}

export default function CharacterPicker({ userId, chosen, onChosen }: CharacterPickerProps) {
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

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-3">
        <User className="w-5 h-5 text-blue-500 shrink-0" />
        <h2 className="text-lg font-semibold text-gray-900">Your character</h2>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="w-full sm:w-44 h-56 rounded-lg bg-gradient-to-b from-slate-100 to-slate-200 border border-gray-200 overflow-hidden shrink-0">
          <Canvas
            // Framed to hold the whole figure with air over the head: the
            // characters are 1.72 m, and 32° from 2.5 m sees 1.43 m of them —
            // which cuts them off at the neck.
            camera={{ position: [0, 0.05, 3.1], fov: 40 }}
            dpr={[1, 2]}
            // The menu is not the campus: one turning figure does not need a
            // frame budget, and a menu that spins a fan is a bad first
            // impression of a 3D feature.
            frameloop="always"
          >
            <Stage file={previewing.file} seed={userId} />
          </Canvas>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm text-gray-500 mb-3">
            {isChoice
              ? 'This is the character you picked. Everyone in a lobby sees it.'
              : 'You have not picked one, so the campus gives you this. Choose to keep it or change it.'}
          </p>

          <div
            className="flex flex-wrap gap-2 max-w-md"
            role="radiogroup"
            aria-label="Campus character"
          >
            {AVATAR_CATALOGUE.map((entry) => {
              const selected = entry.id === chosen
              return (
                <button
                  key={entry.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={saving !== null}
                  onMouseEnter={() => setPreviewing(entry)}
                  onFocus={() => setPreviewing(entry)}
                  onMouseLeave={() => setPreviewing(characterFor(chosen, userId))}
                  onBlur={() => setPreviewing(characterFor(chosen, userId))}
                  onClick={() => choose(entry)}
                  className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60 ${
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

          {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
        </div>
      </div>
    </div>
  )
}
