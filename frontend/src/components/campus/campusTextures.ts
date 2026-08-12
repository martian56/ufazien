import * as THREE from 'three'

/**
 * Procedural textures, drawn on a canvas at runtime.
 *
 * The campus previously used flat `meshStandardMaterial` colours, which is why
 * it read as cardboard: a lawn and a road lit by the same sun look identical
 * apart from hue when neither has any surface detail. Painting them here costs
 * one canvas each at startup and nothing afterwards, and — unlike image files —
 * adds nothing to the bundle and cannot 404.
 *
 * Every generator is memoised by its arguments, so a texture is drawn once no
 * matter how many materials ask for it, and repeated re-renders reuse the same
 * GPU upload.
 */

const cache = new Map<string, THREE.Texture>()

/**
 * jsdom has no 2D context and neither do some locked-down browsers. Callers
 * fall back to a plain colour rather than crashing the whole canvas.
 */
function draw(
  size: number,
  paint: (ctx: CanvasRenderingContext2D, size: number) => void,
): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  paint(ctx, size)
  return canvas
}

function build(
  key: string,
  size: number,
  repeat: number,
  paint: (ctx: CanvasRenderingContext2D, size: number) => void,
): THREE.Texture | null {
  const hit = cache.get(key)
  if (hit) return hit

  const canvas = draw(size, paint)
  if (!canvas) return null

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(repeat, repeat)
  texture.colorSpace = THREE.SRGBColorSpace
  // Grazing angles are most of what you see on a ground plane; without this
  // the paths blur into mush ten metres ahead of you.
  texture.anisotropy = 8
  cache.set(key, texture)
  return texture
}

/** Deterministic value noise, so a texture is identical between reloads. */
function noise(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function speckle(
  ctx: CanvasRenderingContext2D,
  size: number,
  count: number,
  colors: string[],
  seed: number,
  radius = 2,
) {
  const random = noise(seed)
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colors[Math.floor(random() * colors.length)]
    ctx.beginPath()
    ctx.arc(random() * size, random() * size, random() * radius + 0.4, 0, Math.PI * 2)
    ctx.fill()
  }
}

/** Mown grass: a base green broken up by lighter blades and dry patches. */
export function grassTexture() {
  return build('grass', 256, 80, (ctx, size) => {
    ctx.fillStyle = '#4a7a3f'
    ctx.fillRect(0, 0, size, size)
    speckle(ctx, size, 2600, ['#578c48', '#3f6b36', '#628f4d', '#456f3b'], 12, 2.4)
    // Longer strokes read as blades rather than as static.
    const random = noise(77)
    ctx.lineWidth = 1
    for (let i = 0; i < 900; i++) {
      const x = random() * size
      const y = random() * size
      ctx.strokeStyle = random() > 0.5 ? '#6a9a56' : '#3b6633'
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + random() * 3 - 1.5, y - random() * 4)
      ctx.stroke()
    }
  })
}

/** Worn asphalt for Nizami Street. */
export function asphaltTexture() {
  return build('asphalt', 256, 40, (ctx, size) => {
    ctx.fillStyle = '#3a3d42'
    ctx.fillRect(0, 0, size, size)
    speckle(ctx, size, 3000, ['#45484e', '#313438', '#4e5259', '#2b2e32'], 31, 2)
  })
}

/** Baku pavement: large stone slabs with visible joints. */
export function stoneTexture() {
  return build('stone', 256, 24, (ctx, size) => {
    const slab = size / 4
    ctx.fillStyle = '#8f8778'
    ctx.fillRect(0, 0, size, size)
    const random = noise(5)
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        // Slight per-slab variation, or the grid reads as printed-on.
        const shade = 138 + Math.floor(random() * 26)
        ctx.fillStyle = `rgb(${shade}, ${shade - 6}, ${shade - 20})`
        ctx.fillRect(col * slab + 1.5, row * slab + 1.5, slab - 3, slab - 3)
      }
    }
    speckle(ctx, size, 1400, ['#9c9384', '#7d7566', '#a49b8b'], 9, 1.4)
  })
}

/** Compacted gravel for the campus paths. */
export function pathTexture() {
  return build('path', 256, 30, (ctx, size) => {
    ctx.fillStyle = '#b4a88f'
    ctx.fillRect(0, 0, size, size)
    speckle(ctx, size, 4200, ['#c2b69c', '#a1957c', '#cabfa6', '#988c74'], 21, 1.8)
  })
}

/** Outdoor sport court acrylic. */
export function courtTexture() {
  return build('court', 128, 8, (ctx, size) => {
    ctx.fillStyle = '#1f6f5c'
    ctx.fillRect(0, 0, size, size)
    speckle(ctx, size, 1800, ['#247864', '#1b6353', '#2a8570'], 44, 1.2)
  })
}

/**
 * A facade.
 *
 * `heritage` gets the horizontal rustication of a Baku oil-boom limestone
 * front, `brick` gets courses, and the rest get a fine render. The base colour
 * is passed in so every building can share one generator without sharing a hue.
 */
export function facadeTexture(base: string, style: 'heritage' | 'brick' | 'modern' | 'glass') {
  return build(`facade:${style}:${base}`, 256, 1, (ctx, size) => {
    ctx.fillStyle = base
    ctx.fillRect(0, 0, size, size)

    if (style === 'heritage') {
      // Ashlar courses: a light top edge and a dark joint below each band.
      const band = size / 8
      for (let i = 0; i <= 8; i++) {
        const y = i * band
        ctx.fillStyle = 'rgba(255,255,255,0.16)'
        ctx.fillRect(0, y, size, 1.5)
        ctx.fillStyle = 'rgba(0,0,0,0.18)'
        ctx.fillRect(0, y + 1.5, size, 2)
      }
      speckle(ctx, size, 900, ['rgba(255,255,255,0.10)', 'rgba(0,0,0,0.08)'], 61, 2.2)
    } else if (style === 'brick') {
      const course = size / 16
      const random = noise(101)
      for (let row = 0; row < 16; row++) {
        const offset = row % 2 ? course : 0
        for (let col = -1; col < 8; col++) {
          const shade = 0.06 + random() * 0.1
          ctx.fillStyle = `rgba(0,0,0,${shade.toFixed(3)})`
          ctx.fillRect(col * course * 2 + offset + 1, row * course + 1, course * 2 - 2, course - 2)
        }
      }
    } else {
      speckle(ctx, size, 1600, ['rgba(255,255,255,0.06)', 'rgba(0,0,0,0.06)'], 83, 1.6)
    }
  })
}

/**
 * A window, painted rather than modelled.
 *
 * Each window is one instanced quad carrying this texture: frame, reveal,
 * glass, glazing bars and a hint of reflected sky all come from the canvas, so
 * a hundred-window facade is still a single draw call. Modelling the same
 * detail in geometry would be thousands of triangles per building for
 * something you mostly see from twenty metres away.
 *
 * `wall` is the colour of the surrounding masonry, painted into the margins so
 * the quad blends into the facade instead of showing its own edges.
 */
export function windowTexture(kind: 'arched' | 'square' | 'strip', wall: string) {
  return build(`window:${kind}:${wall}`, 128, 1, (ctx, size) => {
    ctx.fillStyle = wall
    ctx.fillRect(0, 0, size, size)

    const inset = kind === 'strip' ? 6 : 14
    const top = kind === 'arched' ? size * 0.34 : inset
    const glass = ctx.createLinearGradient(0, 0, 0, size)
    glass.addColorStop(0, '#9fc6e8')
    glass.addColorStop(0.45, '#5d7f9e')
    glass.addColorStop(1, '#33475c')

    const paintOpening = (style: string | CanvasGradient) => {
      ctx.fillStyle = style
      ctx.beginPath()
      if (kind === 'arched') {
        const radius = (size - inset * 2) / 2
        ctx.moveTo(inset, size - inset)
        ctx.lineTo(inset, top)
        ctx.arc(size / 2, top, radius, Math.PI, 0)
        ctx.lineTo(size - inset, size - inset)
        ctx.closePath()
      } else {
        ctx.rect(inset, top, size - inset * 2, size - top - inset)
      }
      ctx.fill()
    }

    // Reveal: the shadowed thickness of the wall around the opening.
    ctx.save()
    ctx.translate(2, 3)
    paintOpening('rgba(0,0,0,0.35)')
    ctx.restore()

    paintOpening(glass)

    // Glazing bars.
    ctx.strokeStyle = kind === 'strip' ? '#5a6470' : '#e8e4d8'
    ctx.lineWidth = kind === 'strip' ? 3 : 5
    ctx.beginPath()
    ctx.moveTo(size / 2, top)
    ctx.lineTo(size / 2, size - inset)
    ctx.moveTo(inset, size * 0.62)
    ctx.lineTo(size - inset, size * 0.62)
    ctx.stroke()

    // A diagonal band of reflected sky, which is what actually sells glass.
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.fillStyle = 'rgba(190,220,255,0.20)'
    ctx.beginPath()
    ctx.moveTo(inset, size * 0.72)
    ctx.lineTo(size * 0.66, top)
    ctx.lineTo(size - inset, top)
    ctx.lineTo(inset, size - inset)
    ctx.closePath()
    ctx.fill()
    ctx.restore()

    if (kind !== 'strip') {
      // Sill.
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.fillRect(inset - 5, size - inset, size - inset * 2 + 10, 6)
      ctx.fillStyle = 'rgba(0,0,0,0.22)'
      ctx.fillRect(inset - 5, size - inset + 6, size - inset * 2 + 10, 3)
    }
  })
}

/**
 * The two flags that fly over UFAZ.
 *
 * The university is a joint project of the University of Strasbourg and the
 * Azerbaijan State Oil and Industry University, so the pair of flags over the
 * door is not decoration — it is the thing the building is.
 */
export function flagTexture(country: 'az' | 'fr') {
  const key = `flag:${country}`
  const hit = cache.get(key)
  if (hit) return hit
  if (typeof document === 'undefined') return null

  const canvas = document.createElement('canvas')
  canvas.width = 300
  canvas.height = 150
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  if (country === 'fr') {
    const bands = ['#000091', '#ffffff', '#e1000f']
    bands.forEach((color, i) => {
      ctx.fillStyle = color
      ctx.fillRect(i * 100, 0, 100, 150)
    })
  } else {
    const bands = ['#00b5e2', '#ef3340', '#509e2f']
    bands.forEach((color, i) => {
      ctx.fillStyle = color
      ctx.fillRect(0, i * 50, 300, 50)
    })

    // Crescent: a white disc with an offset red disc punched out of it.
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(132, 75, 22, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#ef3340'
    ctx.beginPath()
    ctx.arc(141, 75, 18, 0, Math.PI * 2)
    ctx.fill()

    // The eight-pointed star.
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    for (let i = 0; i < 16; i++) {
      const radius = i % 2 === 0 ? 15 : 6
      const angle = (i / 16) * Math.PI * 2 - Math.PI / 2
      const x = 176 + Math.cos(angle) * radius
      const y = 75 + Math.sin(angle) * radius
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.fill()
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  cache.set(key, texture)
  return texture
}

/** Carved lettering for the parapet of the main building. */
export function lettersTexture(text: string, color = '#6b5b40') {
  const key = `letters:${text}:${color}`
  const hit = cache.get(key)
  if (hit) return hit
  if (typeof document === 'undefined') return null

  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 192
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.clearRect(0, 0, 1024, 192)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  let fontSize = 120
  do {
    ctx.font = `600 ${fontSize}px Georgia, "Times New Roman", serif`
    fontSize -= 4
  } while (fontSize > 24 && ctx.measureText(text).width > 960)

  // Incised, not painted: a dark letter with a light lower edge reads as cut
  // into stone under a high sun.
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.fillText(text, 512, 100)
  ctx.fillStyle = color
  ctx.fillText(text, 512, 96)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  cache.set(key, texture)
  return texture
}

/**
 * A face, drawn on a transparent canvas and mapped onto a small plane in front
 * of the head.
 *
 * Modelling eyes as geometry is four more meshes per student, and at twenty
 * students that is eighty draw calls spent on something two metres of distance
 * makes illegible anyway. One plane carries the whole expression, and because
 * it is a texture the expression can vary per person for free.
 */
/**
 * A colour moved towards black, or towards a tint.
 *
 * Used to keep every feature legible against whatever skin it is drawn on:
 * brows, creases and lips are all the wearer's own colour darkened, so they
 * have the same contrast on every student rather than disappearing on some.
 */
function shade(hex: string, factor: number, towards = '#000000'): string {
  const from = parseHex(hex)
  const to = parseHex(towards)
  const mix = (a: number, b: number) => Math.round(a * factor + b * (1 - factor))
  return `rgb(${mix(from[0], to[0])},${mix(from[1], to[1])},${mix(from[2], to[2])})`
}

function withAlpha(rgb: string, alpha: number): string {
  return rgb.replace('rgb(', 'rgba(').replace(')', `,${alpha})`)
}

function parseHex(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean
  const value = Number.parseInt(full, 16)
  if (!Number.isFinite(value)) return [0, 0, 0]
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

/**
 * What a face is doing.
 *
 * Separate from the activity enum on purpose: several activities share one
 * expression — clapping and waving are both pleased — and the face has to be
 * able to change without the pose changing, which is what talking is.
 */
export type Expression = 'neutral' | 'smile' | 'talk' | 'focus' | 'surprise'

const EXPRESSIONS: readonly Expression[] = ['neutral', 'smile', 'talk', 'focus', 'surprise']

/** Narrowed rather than cast, so an unknown string is a face and not a crash. */
export function toExpression(value: unknown): Expression {
  return EXPRESSIONS.includes(value as Expression) ? (value as Expression) : 'neutral'
}

/**
 * A face, drawn rather than modelled.
 *
 * Three features do almost all of the work and the old face had one and a half
 * of them: eyes with a highlight so they are not flat discs, brows, which
 * carry more expression than anything else on a face, and a nose, whose
 * absence is most of why the first version read as a balloon with dots on it.
 *
 * `variant` is which face this student has — it stays with them. `expression`
 * is what they are doing at this moment, so one student has five faces and the
 * cache holds fifteen textures rather than three.
 */
export function faceTexture(
  variant: 0 | 1 | 2,
  expression: Expression = 'neutral',
  skin = '#c98b62',
  hair = '#2f2118',
) {
  const key = `face:${variant}:${expression}:${skin}:${hair}`
  const hit = cache.get(key)
  if (hit) return hit
  if (typeof document === 'undefined') return null

  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.clearRect(0, 0, 128, 128)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // Features are drawn relative to the face they sit on. A fixed brown brow is
  // invisible on dark skin — which is exactly what happened: half the campus
  // had no eyebrows at all, and a face without brows reads as a mask.
  //
  // The brows follow the hair rather than the skin, which is both what brows
  // do and the only thing that guarantees contrast: darkening the skin cannot
  // stand out against the skin it came from.
  const brow = shade(hair, 0.82)
  const crease = shade(skin, 0.62)
  const lip = shade(skin, 0.55)

  const wide = expression === 'surprise'
  const narrowed = expression === 'focus'
  const eyeY = 54
  const eyeRx = 11
  const eyeRy = wide ? 11 : narrowed ? 5 : variant === 2 ? 7.5 : 9

  for (const [i, x] of [44, 84].entries()) {
    // The socket: a hair of shadow under the brow, which is what stops the
    // eye reading as a sticker laid on a sphere.
    ctx.fillStyle = withAlpha(crease, 0.3)
    ctx.beginPath()
    ctx.ellipse(x, eyeY - 1, eyeRx + 3, eyeRy + 3.5, 0, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#fbfbfa'
    ctx.beginPath()
    ctx.ellipse(x, eyeY, eyeRx, eyeRy, 0, 0, Math.PI * 2)
    ctx.fill()

    // The iris, off-centre towards the nose, which is where eyes rest.
    const gaze = i === 0 ? 1.5 : -1.5
    ctx.fillStyle = '#3a2b1f'
    ctx.beginPath()
    ctx.arc(x + gaze, eyeY, Math.min(5.4, eyeRy + 0.6), 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#12100e'
    ctx.beginPath()
    ctx.arc(x + gaze, eyeY, Math.min(2.6, eyeRy * 0.5), 0, Math.PI * 2)
    ctx.fill()
    // The highlight. One white dot is the difference between an eye and a
    // hole, and it costs a single arc.
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.beginPath()
    ctx.arc(x + gaze - 2, eyeY - 2.6, 1.8, 0, Math.PI * 2)
    ctx.fill()

    // A lash line along the top lid, heavier than the lid itself.
    ctx.strokeStyle = withAlpha(brow, 0.6)
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.ellipse(x, eyeY, eyeRx, eyeRy, 0, Math.PI * 1.05, Math.PI * 1.95)
    ctx.stroke()
  }

  // Brows. Height and tilt are where the expression actually lives.
  const browLift = wide ? 8 : expression === 'smile' ? 3 : 0
  const browTilt = narrowed ? 5 : expression === 'smile' ? -3 : variant === 2 ? 4 : -2
  ctx.strokeStyle = brow
  ctx.lineWidth = 5.5
  for (const [x, tilt] of [
    [44, browTilt],
    [84, -browTilt],
  ] as [number, number][]) {
    ctx.beginPath()
    ctx.moveTo(x - 11, eyeY - 17 - browLift + tilt)
    ctx.quadraticCurveTo(x, eyeY - 21 - browLift, x + 11, eyeY - 17 - browLift - tilt)
    ctx.stroke()
  }

  // The nose. Two strokes: the bridge shadow and the base. Its absence is
  // most of why the old face read as a balloon with dots drawn on it.
  ctx.strokeStyle = withAlpha(crease, 0.65)
  ctx.lineWidth = 3.5
  ctx.beginPath()
  ctx.moveTo(63, eyeY + 4)
  ctx.lineTo(61, eyeY + 17)
  ctx.quadraticCurveTo(64, eyeY + 21, 68, eyeY + 17)
  ctx.stroke()

  // Mouth.
  const mouthY = 88
  ctx.strokeStyle = lip
  ctx.lineWidth = 5
  ctx.beginPath()
  if (expression === 'talk') {
    // Open, and filled, because a talking mouth is a hole rather than a line.
    ctx.fillStyle = shade(skin, 0.34)
    ctx.ellipse(64, mouthY, 9, 7.5, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  } else if (expression === 'surprise') {
    ctx.fillStyle = shade(skin, 0.34)
    ctx.ellipse(64, mouthY, 7, 9.5, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  } else if (expression === 'smile' || variant === 1) {
    ctx.arc(64, mouthY - 6, 15, 0.2 * Math.PI, 0.8 * Math.PI)
    ctx.stroke()
  } else if (expression === 'focus') {
    ctx.moveTo(55, mouthY)
    ctx.lineTo(73, mouthY - 1)
    ctx.stroke()
  } else if (variant === 2) {
    ctx.moveTo(54, mouthY)
    ctx.lineTo(74, mouthY)
    ctx.stroke()
  } else {
    ctx.arc(64, mouthY - 4, 12, 0.15 * Math.PI, 0.85 * Math.PI)
    ctx.stroke()
  }

  // A little warmth on the cheeks, which reads as skin rather than plastic.
  ctx.fillStyle = withAlpha(shade(skin, 0.8, '#e08a6a'), 0.3)
  for (const x of [36, 92]) {
    ctx.beginPath()
    ctx.ellipse(x, 74, 10, 7, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  cache.set(key, texture)
  return texture
}

/** The board over a building's door. */
export function buildingSignTexture(name: string, icon: string) {
  const key = `sign:${name}:${icon}`
  const hit = cache.get(key)
  if (hit) return hit
  if (typeof document === 'undefined') return null

  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const backing = ctx.createLinearGradient(0, 0, 0, 256)
  backing.addColorStop(0, '#1d2632')
  backing.addColorStop(1, '#121820')
  ctx.fillStyle = backing
  ctx.fillRect(0, 0, 1024, 256)

  ctx.strokeStyle = '#c9a227'
  ctx.lineWidth = 8
  ctx.strokeRect(14, 14, 996, 228)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '64px system-ui, -apple-system, "Segoe UI Emoji", sans-serif'
  ctx.fillText(icon, 110, 132)

  ctx.fillStyle = '#f4ead5'
  // Shrink to fit rather than overflow: "Laboratory Building" is long.
  let fontSize = 84
  do {
    ctx.font = `600 ${fontSize}px system-ui, -apple-system, "Segoe UI", sans-serif`
    fontSize -= 4
  } while (fontSize > 30 && ctx.measureText(name).width > 760)
  ctx.fillText(name, 570, 132)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  cache.set(key, texture)
  return texture
}

/** Polished stone for the main building's floor. */
export function marbleTexture() {
  return build('marble', 256, 10, (ctx, size) => {
    ctx.fillStyle = '#ded5c4'
    ctx.fillRect(0, 0, size, size)
    const random = noise(303)
    ctx.lineWidth = 1.2
    for (let i = 0; i < 22; i++) {
      ctx.strokeStyle = `rgba(163,154,138,${(0.06 + random() * 0.12).toFixed(2)})`
      ctx.beginPath()
      let x = random() * size
      let y = random() * size
      ctx.moveTo(x, y)
      for (let step = 0; step < 8; step++) {
        x += random() * 40 - 20
        y += random() * 40 - 20
        ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
    // Slab joints, so the floor has a scale you can read while walking.
    ctx.strokeStyle = 'rgba(120,110,96,0.5)'
    ctx.lineWidth = 2
    ctx.strokeRect(0, 0, size, size)
  })
}

/** Parquet for the library and the sports hall. */
export function woodTexture() {
  return build('wood', 256, 18, (ctx, size) => {
    const plank = size / 6
    const random = noise(404)
    for (let i = 0; i < 6; i++) {
      const shade = 128 + Math.floor(random() * 34)
      ctx.fillStyle = `rgb(${shade}, ${Math.floor(shade * 0.72)}, ${Math.floor(shade * 0.46)})`
      ctx.fillRect(0, i * plank, size, plank - 1)
      // Grain.
      for (let g = 0; g < 22; g++) {
        ctx.strokeStyle = `rgba(80,55,30,${(0.06 + random() * 0.12).toFixed(2)})`
        const y = i * plank + random() * plank
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.bezierCurveTo(size / 3, y + random() * 3 - 1.5, (size * 2) / 3, y + random() * 3 - 1.5, size, y)
        ctx.stroke()
      }
    }
  })
}

/** Chequered vinyl tile, for the cafeteria and the lab. */
export function tileTexture(a = '#d9d5cc', b = '#a8a49a') {
  return build(`tile:${a}:${b}`, 128, 30, (ctx, size) => {
    const half = size / 2
    ctx.fillStyle = a
    ctx.fillRect(0, 0, size, size)
    ctx.fillStyle = b
    ctx.fillRect(0, 0, half, half)
    ctx.fillRect(half, half, half, half)
    // Grout.
    ctx.strokeStyle = 'rgba(90,88,82,0.4)'
    ctx.lineWidth = 2
    ctx.strokeRect(0, 0, half, half)
    ctx.strokeRect(half, 0, half, half)
    ctx.strokeRect(0, half, half, half)
    ctx.strokeRect(half, half, half, half)
    speckle(ctx, size, 700, ['rgba(255,255,255,0.08)', 'rgba(0,0,0,0.06)'], 71, 1.2)
  })
}

/** Institutional carpet tile for the student centre. */
export function carpetTexture() {
  return build('carpet', 128, 26, (ctx, size) => {
    ctx.fillStyle = '#6b7385'
    ctx.fillRect(0, 0, size, size)
    speckle(ctx, size, 2600, ['#7a8294', '#5e6678', '#828a9c'], 55, 1.2)
  })
}

/** Acoustic ceiling tile, which is what every teaching room in the world has. */
export function ceilingTexture() {
  return build('ceiling', 128, 14, (ctx, size) => {
    ctx.fillStyle = '#e6e3da'
    ctx.fillRect(0, 0, size, size)
    ctx.strokeStyle = 'rgba(120,120,110,0.45)'
    ctx.lineWidth = 2
    ctx.strokeRect(1, 1, size - 2, size - 2)
    speckle(ctx, size, 900, ['rgba(0,0,0,0.05)'], 66, 1.1)
  })
}

/**
 * A player's name, drawn once into a texture for a sprite.
 *
 * Name tags used to be drei `Html`, which is a real DOM node per player that
 * the browser lays out and transforms every single frame. At twenty players in
 * a lobby that is twenty elements fighting the compositor for the whole
 * session. A sprite is one quad, drawn by the GPU, and it cannot be scrolled
 * over or clicked through by accident.
 */
/**
 * How many name tags to keep.
 *
 * Unlike every other generator here, this one is keyed on data that arrives
 * over the socket, so its cache grows with the number of distinct people seen
 * rather than with the fixed campus. A lobby caps at twenty; this leaves room
 * for churn and then evicts the oldest, disposing the GPU texture with it.
 */
const MAX_NAME_TAGS = 64
const nameTags = new Map<string, THREE.Texture>()

export function nameTagTexture(name: string, accent = '#8fd0ff'): THREE.Texture | null {
  // Not built through `build`: a tag is a wide strip, not a tiling square, and
  // repeat-wrapping one would smear the text across the edges of the sprite.
  const label = name.length > 22 ? `${name.slice(0, 21)}…` : name
  const key = `nametag:${label}:${accent}`
  const hit = nameTags.get(key)
  if (hit) {
    // Re-insert so the most recently used tag is the last to be evicted.
    nameTags.delete(key)
    nameTags.set(key, hit)
    return hit
  }

  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.clearRect(0, 0, 512, 128)
  const font = '600 52px system-ui, -apple-system, "Segoe UI", sans-serif'
  ctx.font = font
  const width = Math.min(492, ctx.measureText(label).width + 48)
  const x = (512 - width) / 2

  ctx.fillStyle = 'rgba(8,12,20,0.74)'
  roundRect(ctx, x, 26, width, 76, 18)
  ctx.fill()
  ctx.strokeStyle = accent
  ctx.lineWidth = 3
  roundRect(ctx, x, 26, width, 76, 18)
  ctx.stroke()

  ctx.font = font
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, 256, 66, width - 32)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4

  if (nameTags.size >= MAX_NAME_TAGS) {
    const oldest = nameTags.keys().next().value
    if (oldest !== undefined) {
      nameTags.get(oldest)?.dispose()
      nameTags.delete(oldest)
    }
  }
  nameTags.set(key, texture)
  return texture
}

/* ------------------------------------------------------------------ */

const MAX_BUBBLES = 32
const bubbles = new Map<string, THREE.Texture>()

/**
 * A speech bubble, wrapped to fit.
 *
 * Bounded and least-recently-used like the name tags: a busy lobby generates a
 * new texture per message, and an unbounded cache is a canvas leak that grows
 * for as long as anyone keeps talking.
 */
export function chatBubbleTexture(text: string): THREE.Texture | null {
  const key = `bubble:${text}`
  const hit = bubbles.get(key)
  if (hit) {
    bubbles.delete(key)
    bubbles.set(key, hit)
    return hit
  }

  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const font = '500 38px system-ui, -apple-system, "Segoe UI", sans-serif'
  ctx.font = font
  const lines = wrapText(ctx, text, 440)
  const lineHeight = 46
  const boxHeight = lines.length * lineHeight + 34
  const boxTop = 246 - boxHeight - 18

  ctx.clearRect(0, 0, 512, 256)
  ctx.fillStyle = 'rgba(12,16,24,0.86)'
  roundRect(ctx, 24, boxTop, 464, boxHeight, 20)
  ctx.fill()
  ctx.strokeStyle = 'rgba(160,200,255,0.55)'
  ctx.lineWidth = 3
  roundRect(ctx, 24, boxTop, 464, boxHeight, 20)
  ctx.stroke()

  // The tail, so it reads as speech rather than as a label.
  ctx.fillStyle = 'rgba(12,16,24,0.86)'
  ctx.beginPath()
  ctx.moveTo(240, boxTop + boxHeight - 1)
  ctx.lineTo(256, boxTop + boxHeight + 22)
  ctx.lineTo(272, boxTop + boxHeight - 1)
  ctx.closePath()
  ctx.fill()

  ctx.font = font
  ctx.fillStyle = '#eef4ff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  lines.forEach((line, i) => {
    ctx.fillText(line, 256, boxTop + 24 + i * lineHeight, 440)
  })

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4

  if (bubbles.size >= MAX_BUBBLES) {
    const oldest = bubbles.keys().next().value
    if (oldest !== undefined) {
      bubbles.get(oldest)?.dispose()
      bubbles.delete(oldest)
    }
  }
  bubbles.set(key, texture)
  return texture
}

/** Greedy wrap, capped at three lines so a bubble cannot fill the sky. */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line)
      line = word
      if (lines.length === 3) break
    } else {
      line = candidate
    }
  }
  if (lines.length < 3 && line) lines.push(line)
  return lines.length ? lines : ['…']
}

/* ------------------------------------------------------------------ */

const MAX_BOARDS = 8
const boards = new Map<string, THREE.Texture>()

/**
 * A board with real text on it: today's timetable, or the latest posts.
 *
 * Cached on the content, so a board that has not changed is not redrawn, and
 * bounded like the other canvas caches — the schedule refetches on a timer and
 * an unbounded map would keep every version of it ever rendered.
 */
export function boardTexture(
  title: string,
  lines: { primary: string; secondary?: string; trailing?: string }[],
  accent = '#8fd0ff',
): THREE.Texture | null {
  const key = `board:${title}:${accent}:${lines
    .map((l) => `${l.primary}|${l.secondary ?? ''}|${l.trailing ?? ''}`)
    .join('~')}`
  const hit = boards.get(key)
  if (hit) {
    boards.delete(key)
    boards.set(key, hit)
    return hit
  }

  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 512
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.fillStyle = '#141a22'
  ctx.fillRect(0, 0, 1024, 512)

  ctx.fillStyle = accent
  ctx.fillRect(0, 0, 1024, 8)

  ctx.font = '700 46px system-ui, -apple-system, "Segoe UI", sans-serif'
  ctx.fillStyle = accent
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(title.toUpperCase(), 48, 92)

  ctx.strokeStyle = 'rgba(255,255,255,0.12)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(48, 118)
  ctx.lineTo(976, 118)
  ctx.stroke()

  lines.slice(0, 6).forEach((line, i) => {
    const y = 176 + i * 58
    ctx.font = '600 34px system-ui, -apple-system, "Segoe UI", sans-serif'
    ctx.fillStyle = '#eef4ff'
    ctx.textAlign = 'left'
    ctx.fillText(line.primary, 48, y, 640)

    if (line.secondary) {
      ctx.font = '400 25px system-ui, -apple-system, "Segoe UI", sans-serif'
      ctx.fillStyle = 'rgba(200,214,232,0.7)'
      ctx.fillText(line.secondary, 48, y + 26, 640)
    }

    if (line.trailing) {
      ctx.font = '600 32px system-ui, -apple-system, "Segoe UI", sans-serif'
      ctx.fillStyle = accent
      ctx.textAlign = 'right'
      ctx.fillText(line.trailing, 976, y)
    }
  })

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4

  if (boards.size >= MAX_BOARDS) {
    const oldest = boards.keys().next().value
    if (oldest !== undefined) {
      boards.get(oldest)?.dispose()
      boards.delete(oldest)
    }
  }
  boards.set(key, texture)
  return texture
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
