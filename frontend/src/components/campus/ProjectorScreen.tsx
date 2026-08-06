import { useEffect, useMemo, useState } from "react"
import * as THREE from "three"

/**
 * A projector screen that lives in the room.
 *
 * The shared screen used to be a drei `Html` panel, which is a DOM node the
 * browser draws on top of the canvas: it ignored the room's geometry, never
 * went behind anything, and read as a window pasted over the game rather than
 * something in it. Here the video is a texture on real geometry, so it takes
 * perspective, is occluded by whatever stands in front of it, and you have to
 * walk up to it to read small text, the way a projector actually behaves.
 */

const MAX_WIDTH = 16
const MAX_HEIGHT = 8.4

/** Screen size that fits the video's aspect inside the wall's budget. */
function fitScreen(aspect: number): [number, number] {
  const width = Math.min(MAX_WIDTH, MAX_HEIGHT * aspect)
  return [width, width / aspect]
}

/**
 * The light between lens and screen, as a rectangular pyramid rather than a
 * cone: a projector throws the shape of its image, and a cone gives away that
 * the beam is a prop.
 */
function useBeamGeometry(width: number, height: number, apex: [number, number, number]) {
  return useMemo(() => {
    const halfWidth = width / 2
    const halfHeight = height / 2
    // Lands just short of the screen. Ending exactly on it puts the base edges
    // at the same depth as the picture, which shimmers along the border.
    const z = 0.03
    const corners = [
      [-halfWidth, -halfHeight, z],
      [halfWidth, -halfHeight, z],
      [halfWidth, halfHeight, z],
      [-halfWidth, halfHeight, z],
    ]

    const positions = []
    for (let i = 0; i < corners.length; i++) {
      positions.push(...apex, ...corners[i], ...corners[(i + 1) % corners.length])
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3))
    geometry.computeVertexNormals()
    return geometry
  }, [width, height, apex])
}

/** Reads the real aspect ratio, which is only known once the video has arrived. */
function useVideoAspect(video: HTMLVideoElement | null) {
  const [aspect, setAspect] = useState(16 / 9)

  useEffect(() => {
    if (!video) return
    const read = () => {
      if (video.videoWidth && video.videoHeight) {
        setAspect(video.videoWidth / video.videoHeight)
      }
    }
    read()
    video.addEventListener("loadedmetadata", read)
    video.addEventListener("resize", read)
    return () => {
      video.removeEventListener("loadedmetadata", read)
      video.removeEventListener("resize", read)
    }
  }, [video])

  return aspect
}

function useVideoTexture(video: HTMLVideoElement | null) {
  const texture = useMemo(() => {
    if (!video) return null
    const created = new THREE.VideoTexture(video)
    created.colorSpace = THREE.SRGBColorSpace
    created.minFilter = THREE.LinearFilter
    created.magFilter = THREE.LinearFilter
    created.generateMipmaps = false
    return created
  }, [video])

  useEffect(() => () => texture?.dispose(), [texture])
  return texture
}

// Hangs clear of the lecture board rather than right against it. The board's
// face is at z -19.45, and sitting on top of it left no depth to separate the
// screen from its own frame, which is what made the picture flicker.
interface ProjectorScreenProps {
  video: HTMLVideoElement | null
  position?: [number, number, number]
}

export default function ProjectorScreen({ video, position = [0, 5.2, -19.15] }: ProjectorScreenProps) {
  const aspect = useVideoAspect(video)
  const texture = useVideoTexture(video)
  const [width, height] = fitScreen(aspect)

  // Ceiling mount, in front of and above the screen.
  const lens = useMemo<[number, number, number]>(
    () => [0, 8.7 - position[1], -7 - position[2]],
    [position],
  )
  const beam = useBeamGeometry(width, height, lens)

  return (
    <group position={position}>
      {/* Casing the screen rolls down from, so it is not a floating rectangle */}
      <mesh position={[0, height / 2 + 0.35, 0.08]} castShadow>
        <boxGeometry args={[width + 0.9, 0.5, 0.42]} />
        <meshStandardMaterial color="#20262f" roughness={0.7} metalness={0.2} />
      </mesh>

      {/* Border. Its front face must stay behind the picture, not level with
          it: coplanar surfaces tie in the depth buffer, and because this one is
          larger than the screen it won the tie often enough to blink the whole
          image out. */}
      <mesh position={[0, 0, -0.14]}>
        <boxGeometry args={[width + 0.36, height + 0.36, 0.18]} />
        <meshStandardMaterial color="#12161c" roughness={0.85} />
      </mesh>

      {video && texture ? (
        // Unlit: a projected image gives off light, it does not receive it.
        // Under meshStandardMaterial the room's lamps would tint the slides.
        <mesh>
          <planeGeometry args={[width, height]} />
          <meshBasicMaterial map={texture} toneMapped={false} />
        </mesh>
      ) : (
        <mesh receiveShadow>
          <planeGeometry args={[width, height]} />
          <meshStandardMaterial color="#d9d6cd" roughness={0.96} />
        </mesh>
      )}

      {/* Projector body, aimed back at the screen */}
      <group position={lens}>
        <mesh castShadow>
          <boxGeometry args={[1.3, 0.42, 0.95]} />
          <meshStandardMaterial color="#2b3038" roughness={0.5} metalness={0.35} />
        </mesh>
        <mesh position={[0, 0, -0.55]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.15, 0.17, 0.22, 16]} />
          <meshStandardMaterial
            color={video ? "#cfe4ff" : "#171b21"}
            emissive={video ? "#8fc0ff" : "#000000"}
            emissiveIntensity={video ? 1.4 : 0}
            roughness={0.35}
          />
        </mesh>
        {/* Ceiling arm */}
        <mesh position={[0, 0.55, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 0.7, 8]} />
          <meshStandardMaterial color="#3a4049" roughness={0.6} metalness={0.4} />
        </mesh>
      </group>

      {video && (
        <>
          <mesh geometry={beam}>
            <meshBasicMaterial
              color="#bcd8ff"
              transparent
              opacity={0.055}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>

          {/* Spill onto the desks, so the room reacts to the screen being on */}
          <pointLight position={[0, 0, 3.2]} intensity={26} distance={20} color="#9fc4ff" />
        </>
      )}
    </group>
  )
}
