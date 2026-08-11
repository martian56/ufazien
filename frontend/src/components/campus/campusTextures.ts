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
  ctx.letterSpacing = '0px'

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
export function nameTagTexture(name: string, accent = '#8fd0ff'): THREE.Texture | null {
  // Not built through `build`: a tag is a wide strip, not a tiling square, and
  // repeat-wrapping one would smear the text across the edges of the sprite.
  const label = name.length > 22 ? `${name.slice(0, 21)}…` : name
  const key = `nametag:${label}:${accent}`
  const hit = cache.get(key)
  if (hit) return hit

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
  cache.set(key, texture)
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
