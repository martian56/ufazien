/**
 * Turns Quaternius's CC0 prop packs into the static meshes the campus loads.
 *
 * The sibling of `build-avatars.mjs`, and the same bargain: the inputs are tens
 * of megabytes and are not committed, the outputs are small and are, and
 * running this is a deliberate act rather than part of a build.
 *
 *     node scripts/build-props.mjs <in.obj>... --out public/props \
 *                                  --manifest src/assets/props.json
 *
 * ## Why it reads OBJ rather than glTF
 *
 * Ultimate Nature Pack (2019) ships OBJ, FBX and Blend, and no glTF. That is
 * the pack worth having: its materials are flat `Kd` colours with no texture
 * maps at all, which is exactly what the rest of the campus looks like.
 *
 * The newer Ultimate Stylized Nature *does* ship glTF, and it is textured —
 * bark normals, leaf alpha, a megabyte of PNG per species. Dropping that into a
 * scene of untextured procedural buildings is the thing CLAUDE.md warns about:
 * it would read as though it had arrived from another game, and it would bring
 * its texture budget with it.
 *
 * So this parses OBJ. The subset needed is small — positions, normals, faces,
 * and a material per face group — because these models have no UVs and no maps.
 * That is also why there is no dependency here: `obj2gltf` would handle far more
 * of the format than this pack uses, and would put a tree of packages into a
 * repository whose only other asset script has none.
 *
 * ## What it does
 *
 * - Triangulates. The pack is quads; glTF is triangles.
 * - Merges by material, so a two-colour tree is two primitives and not two
 *   hundred. With instancing that is two draw calls for a whole wood.
 * - Drops anything with no faces, and fails loudly on a file it cannot parse
 *   rather than writing an empty mesh that renders as nothing.
 * - Writes a manifest of what came from where, which is what makes the credits
 *   panel maintainable rather than a guess.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'

/** glTF component and target constants, so the numbers below have names. */
const FLOAT = 5126
const UNSIGNED_SHORT = 5123
const UNSIGNED_INT = 5125
const ARRAY_BUFFER = 34962
const ELEMENT_ARRAY_BUFFER = 34963

/**
 * Parses the subset of OBJ this pack uses.
 *
 * Returns one group per material, each with its own vertices and indices.
 * OBJ indexes positions and normals separately and glTF cannot, so every
 * distinct `v//vn` pair becomes one vertex — which is why a 1450-position tree
 * comes out with rather more than 1450 vertices.
 */
export function parseObj(text) {
  const positions = []
  const normals = []
  const groups = new Map()
  let current = 'default'

  const vertexIndex = new Map()
  const groupFor = (name) => {
    if (!groups.has(name)) {
      groups.set(name, { material: name, positions: [], normals: [], indices: [] })
    }
    return groups.get(name)
  }

  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (line === '' || line.startsWith('#')) continue
    const [keyword, ...rest] = line.split(/\s+/)

    if (keyword === 'v') {
      positions.push(rest.slice(0, 3).map(Number))
    } else if (keyword === 'vn') {
      normals.push(rest.slice(0, 3).map(Number))
    } else if (keyword === 'usemtl') {
      current = rest[0] ?? 'default'
      vertexIndex.clear()
    } else if (keyword === 'f') {
      const group = groupFor(current)
      const corners = rest.map((token) => {
        const key = token
        const seen = vertexIndex.get(key)
        if (seen !== undefined) return seen

        // `v`, `v/vt`, `v//vn` or `v/vt/vn`, all 1-indexed, and negative means
        // "counting back from the end".
        const [vRaw, , vnRaw] = token.split('/')
        const resolve = (value, list) => {
          const n = Number(value)
          return n < 0 ? list.length + n : n - 1
        }
        const position = positions[resolve(vRaw, positions)]
        if (!position) throw new Error(`face refers to missing vertex: ${token}`)
        const normal = vnRaw ? normals[resolve(vnRaw, normals)] : null

        const index = group.positions.length / 3
        group.positions.push(...position)
        group.normals.push(...(normal ?? [0, 1, 0]))
        vertexIndex.set(key, index)
        return index
      })

      // Fan triangulation. Sound for the convex quads this pack is made of, and
      // the only thing an OBJ face is guaranteed to be is planar and convex.
      for (let i = 1; i + 1 < corners.length; i += 1) {
        group.indices.push(corners[0], corners[i], corners[i + 1])
      }
    }
  }

  return [...groups.values()].filter((group) => group.indices.length > 0)
}

/** Reads `Kd` per material out of the companion .mtl, if there is one. */
export function parseMtl(path) {
  const colours = new Map()
  if (!existsSync(path)) return colours
  let current = null
  for (const raw of readFileSync(path, 'utf8').split('\n')) {
    const line = raw.trim()
    const [keyword, ...rest] = line.split(/\s+/)
    if (keyword === 'newmtl') current = rest[0]
    else if (keyword === 'Kd' && current) colours.set(current, rest.slice(0, 3).map(Number))
  }
  return colours
}

/** Smallest and largest corner, which glTF requires on the POSITION accessor. */
function bounds(values) {
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < values.length; i += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], values[i + axis])
      max[axis] = Math.max(max[axis], values[i + axis])
    }
  }
  return { min, max }
}

/** Packs the parsed groups into a single-buffer GLB. */
export function toGlb(groups, colours, name) {
  const json = {
    asset: { version: '2.0', generator: 'ufazien build-props' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name, mesh: 0 }],
    meshes: [{ name, primitives: [] }],
    materials: [],
    accessors: [],
    bufferViews: [],
    buffers: [],
  }

  const chunks = []
  let offset = 0
  const addView = (typed, target) => {
    const bytes = Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength)
    // Every accessor's offset must be a multiple of its component size; four
    // covers both the floats and the indices here.
    const padding = (4 - (offset % 4)) % 4
    if (padding > 0) {
      chunks.push(Buffer.alloc(padding))
      offset += padding
    }
    json.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length, target })
    chunks.push(bytes)
    offset += bytes.length
    return json.bufferViews.length - 1
  }

  for (const group of groups) {
    const positions = new Float32Array(group.positions)
    const normals = new Float32Array(group.normals)
    // Sixteen-bit where it fits, which for a low-poly prop it always does —
    // these are a few thousand vertices, not a few million. Halves the index
    // buffer, and every renderer takes it.
    const vertexCount = group.positions.length / 3
    const narrow = vertexCount < 65536
    const indices = narrow
      ? new Uint16Array(group.indices)
      : new Uint32Array(group.indices)
    const { min, max } = bounds(group.positions)

    const positionView = addView(positions, ARRAY_BUFFER)
    const normalView = addView(normals, ARRAY_BUFFER)
    const indexView = addView(indices, ELEMENT_ARRAY_BUFFER)

    json.accessors.push(
      { bufferView: positionView, componentType: FLOAT, count: positions.length / 3, type: 'VEC3', min, max },
      { bufferView: normalView, componentType: FLOAT, count: normals.length / 3, type: 'VEC3' },
      {
        bufferView: indexView,
        componentType: narrow ? UNSIGNED_SHORT : UNSIGNED_INT,
        count: indices.length,
        type: 'SCALAR',
      },
    )

    const [r, g, b] = colours.get(group.material) ?? [0.8, 0.8, 0.8]
    json.materials.push({
      name: group.material,
      pbrMetallicRoughness: {
        baseColorFactor: [r, g, b, 1],
        // Flat and unshiny, and metalness stays at zero: this project has no
        // environment map, and metal without one renders black. CLAUDE.md.
        metallicFactor: 0,
        roughnessFactor: 0.9,
      },
    })

    const base = json.accessors.length - 3
    json.meshes[0].primitives.push({
      attributes: { POSITION: base, NORMAL: base + 1 },
      indices: base + 2,
      material: json.materials.length - 1,
    })
  }

  const binary = Buffer.concat(chunks)
  json.buffers.push({ byteLength: binary.length })

  const jsonText = Buffer.from(JSON.stringify(json), 'utf8')
  const jsonPadded = Buffer.concat([
    jsonText,
    Buffer.alloc((4 - (jsonText.length % 4)) % 4, 0x20),
  ])
  const binPadded = Buffer.concat([binary, Buffer.alloc((4 - (binary.length % 4)) % 4, 0)])

  const header = Buffer.alloc(12)
  header.writeUInt32LE(0x46546c67, 0)
  header.writeUInt32LE(2, 4)
  header.writeUInt32LE(12 + 8 + jsonPadded.length + 8 + binPadded.length, 8)

  const jsonHeader = Buffer.alloc(8)
  jsonHeader.writeUInt32LE(jsonPadded.length, 0)
  jsonHeader.writeUInt32LE(0x4e4f534a, 4)

  const binHeader = Buffer.alloc(8)
  binHeader.writeUInt32LE(binPadded.length, 0)
  binHeader.writeUInt32LE(0x004e4942, 4)

  return Buffer.concat([header, jsonHeader, jsonPadded, binHeader, binPadded])
}

function main() {
  const args = process.argv.slice(2)
  const outAt = args.indexOf('--out')
  if (outAt < 0) throw new Error('need --out <dir>')
  const outDir = args[outAt + 1]

  const manifestAt = args.indexOf('--manifest')
  const manifestPath = manifestAt >= 0 ? args[manifestAt + 1] : null

  const packAt = args.indexOf('--pack')
  const pack = packAt >= 0 ? args[packAt + 1] : 'Unknown pack'

  const inputs = args.filter(
    (arg, i) =>
      !arg.startsWith('--') &&
      args[i - 1] !== '--out' &&
      args[i - 1] !== '--manifest' &&
      args[i - 1] !== '--pack',
  )
  if (inputs.length === 0) throw new Error('need at least one .obj')

  mkdirSync(outDir, { recursive: true })
  const manifest = []

  for (const input of inputs) {
    const name = basename(input).replace(/\.obj$/i, '')
    const groups = parseObj(readFileSync(input, 'utf8'))
    if (groups.length === 0) throw new Error(`${name}: no faces — refusing to write an empty mesh`)

    const colours = parseMtl(join(dirname(input), `${name}.mtl`))
    const glb = toGlb(groups, colours, name)
    writeFileSync(join(outDir, `${name}.glb`), glb)

    const triangles = groups.reduce((total, group) => total + group.indices.length / 3, 0)
    const sourceBytes = readFileSync(input).length
    manifest.push({
      name,
      file: `${basename(outDir)}/${name}.glb`,
      pack,
      licence: 'CC0-1.0',
      source: basename(input),
      triangles,
      materials: groups.length,
      bytes: glb.length,
    })
    console.log(
      `${name.padEnd(26)} ${(sourceBytes / 1024).toFixed(0).padStart(5)}KB -> ` +
        `${(glb.length / 1024).toFixed(0).padStart(5)}KB  ${String(triangles).padStart(5)} tris  ` +
        `${groups.length} material${groups.length === 1 ? '' : 's'}`,
    )
  }

  if (manifestPath) {
    mkdirSync(dirname(manifestPath), { recursive: true })
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
    console.log(`\nmanifest: ${manifestPath} (${manifest.length} models)`)
  }
}

// Only when run, so the parser can be imported and tested. `import.meta.main`
// is not in Node yet; comparing argv[1] to this file is the portable form.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main()
}
