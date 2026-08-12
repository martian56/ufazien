/**
 * Turns Quaternius's CC0 character glTFs into the avatar assets the campus
 * ships.
 *
 * The players were built out of primitives — cones for a torso, spheres for a
 * skull, a sphere with a wedge cut out of it for hair. That got a long way, but
 * it was always going to top out short of a person, and it cost a component of
 * six hundred lines to stay there.
 *
 * These are rigged characters: one skeleton of sixty-two joints, twenty-four
 * baked animations, and flat-colour materials with no textures at all, which is
 * why they sit next to this campus's untextured buildings without looking like
 * they were pasted in from somewhere else.
 *
 * ## What it does
 *
 * The packs ship as .gltf — JSON with the whole buffer inlined as base64, which
 * is a third larger than the bytes it encodes, and carrying every animation in
 * the set. Most of those are for a game this is not: `Gun_Shoot`, `Sword_Slash`,
 * `Death`, `Kick_Left`. So this
 *
 * 1. keeps only the clips the campus actually plays,
 * 2. drops every accessor and buffer view nothing references any more,
 * 3. and writes a .glb, where the buffer is bytes rather than base64.
 *
 * Together that takes each character from about 3 MB to well under half of it.
 *
 * ## Running it
 *
 *     node scripts/build-avatars.mjs <in.gltf>... --out public/avatars
 *
 * The output is committed. The inputs are not: they are a 30 MB Google Drive
 * folder, and re-running this is a deliberate act, not part of a build.
 *
 * ## Provenance
 *
 * Ultimate Modular Characters by Quaternius (https://quaternius.com), released
 * under CC0 1.0 Universal — public domain dedication, no attribution required.
 * We credit them anyway, in the campus settings panel, because it is free work
 * that this project is better for.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { basename } from 'node:path'

/**
 * The clips the campus plays.
 *
 * `Idle_Neutral` is the standing pose, `Idle` the more animated one used when
 * a player is doing nothing but is not idle-idle. `Interact` covers reaching
 * for a switch or picking something up, and `Wave` is the emote. Everything
 * else in the pack is combat.
 */
const KEEP = ['Idle', 'Idle_Neutral', 'Walk', 'Run', 'Wave', 'Interact']

/**
 * Props the packs ship that this campus has no business drawing.
 *
 * The Suit character comes holding a pistol, parented to its right hand. That
 * is fine for the shooter these were made for and is not going anywhere near a
 * university. Stripped here rather than hidden at runtime: an asset that does
 * not contain a gun cannot accidentally show one, and dropping the node's mesh
 * makes its vertex data unreachable, so the prune below deletes it for free.
 */
const STRIP = [/pistol/i, /gun/i, /rifle/i, /sword/i, /knife/i, /weapon/i]

function main() {
  const args = process.argv.slice(2)
  const outAt = args.indexOf('--out')
  if (outAt < 0) throw new Error('need --out <dir>')
  const outDir = args[outAt + 1]
  const inputs = args.slice(0, outAt)
  if (!inputs.length) throw new Error('need at least one .gltf')

  mkdirSync(outDir, { recursive: true })

  for (const input of inputs) {
    const gltf = JSON.parse(readFileSync(input, 'utf8'))
    const bin = decodeBuffer(gltf)
    const { json, buffer, stripped } = prune(gltf, bin)
    const name = basename(input).replace(/\.gltf$/i, '.glb')
    const glb = pack(json, buffer)
    writeFileSync(`${outDir}/${name}`, glb)
    const before = readFileSync(input).length
    process.stdout.write(
      `${name.padEnd(18)} ${(before / 1024 / 1024).toFixed(2)}MB -> ${(glb.length / 1024 / 1024).toFixed(2)}MB  ` +
        `${json.animations.length}/${gltf.animations?.length ?? 0} clips` +
        `${stripped ? `  stripped ${stripped} prop(s)` : ''}\n`,
    )
  }
}

/** The single buffer, which these packs inline as a base64 data URI. */
function decodeBuffer(gltf) {
  if (gltf.buffers?.length !== 1) throw new Error('expected exactly one buffer')
  const uri = gltf.buffers[0].uri
  if (!uri?.startsWith('data:')) throw new Error('expected an inlined buffer')
  return Buffer.from(uri.slice(uri.indexOf(',') + 1), 'base64')
}

/**
 * Drops the clips we do not play, then everything only they referenced.
 *
 * Accessors and buffer views are referenced by index, so removing any means
 * renumbering every reference to the ones that survive. Getting that wrong does
 * not throw — it silently points a vertex attribute at an animation's keyframes
 * and the character renders as an explosion.
 */
function prune(gltf, bin) {
  const json = structuredClone(gltf)

  json.animations = (json.animations ?? []).filter((a) => KEEP.includes(a.name))
  const missing = KEEP.filter((k) => !json.animations.some((a) => a.name === k))
  if (missing.length) throw new Error(`clips not in this pack: ${missing.join(', ')}`)

  let stripped = 0
  for (const node of json.nodes ?? []) {
    if (node.mesh !== undefined && STRIP.some((re) => re.test(node.name ?? ''))) {
      delete node.mesh
      delete node.skin
      stripped += 1
    }
  }

  // Only meshes something still points at. A node that lost its mesh above
  // leaves that mesh unreferenced, and walking `json.meshes` blindly would keep
  // every byte of the pistol we just detached.
  const liveMeshes = new Set(
    (json.nodes ?? []).filter((n) => n.mesh !== undefined).map((n) => n.mesh),
  )

  // Every accessor still reachable from something that is drawn or played.
  const liveAccessors = new Set()
  for (const index of liveMeshes) {
    const mesh = json.meshes[index]
    for (const prim of mesh.primitives ?? []) {
      for (const accessor of Object.values(prim.attributes ?? {})) liveAccessors.add(accessor)
      if (prim.indices !== undefined) liveAccessors.add(prim.indices)
      for (const target of prim.targets ?? []) {
        for (const accessor of Object.values(target)) liveAccessors.add(accessor)
      }
    }
  }
  for (const skin of json.skins ?? []) {
    if (skin.inverseBindMatrices !== undefined) liveAccessors.add(skin.inverseBindMatrices)
  }
  for (const animation of json.animations) {
    for (const sampler of animation.samplers) {
      liveAccessors.add(sampler.input)
      liveAccessors.add(sampler.output)
    }
  }

  // Renumber accessors, and with them the buffer views they read from.
  const accessorIndex = new Map()
  const accessors = []
  const viewIndex = new Map()
  const views = []
  const chunks = []
  let offset = 0

  for (const old of [...liveAccessors].sort((a, b) => a - b)) {
    const accessor = { ...json.accessors[old] }
    if (accessor.sparse) throw new Error('sparse accessors are not handled')

    if (accessor.bufferView !== undefined) {
      if (!viewIndex.has(accessor.bufferView)) {
        const view = { ...json.bufferViews[accessor.bufferView] }
        const start = view.byteOffset ?? 0
        const bytes = bin.subarray(start, start + view.byteLength)
        // Four-byte aligned, which the spec requires of accessor offsets and
        // which three.js will not forgive.
        while (offset % 4 !== 0) {
          chunks.push(Buffer.alloc(1))
          offset += 1
        }
        chunks.push(bytes)
        viewIndex.set(accessor.bufferView, views.length)
        views.push({ ...view, buffer: 0, byteOffset: offset })
        offset += bytes.length
      }
      accessor.bufferView = viewIndex.get(accessor.bufferView)
    }

    accessorIndex.set(old, accessors.length)
    accessors.push(accessor)
  }

  const remap = (i) => {
    const next = accessorIndex.get(i)
    if (next === undefined) throw new Error(`accessor ${i} was pruned but is still referenced`)
    return next
  }

  for (const index of liveMeshes) {
    const mesh = json.meshes[index]
    for (const prim of mesh.primitives ?? []) {
      for (const key of Object.keys(prim.attributes ?? {})) {
        prim.attributes[key] = remap(prim.attributes[key])
      }
      if (prim.indices !== undefined) prim.indices = remap(prim.indices)
      for (const target of prim.targets ?? []) {
        for (const key of Object.keys(target)) target[key] = remap(target[key])
      }
    }
  }
  for (const skin of json.skins ?? []) {
    if (skin.inverseBindMatrices !== undefined) {
      skin.inverseBindMatrices = remap(skin.inverseBindMatrices)
    }
  }
  for (const animation of json.animations) {
    for (const sampler of animation.samplers) {
      sampler.input = remap(sampler.input)
      sampler.output = remap(sampler.output)
    }
  }

  const buffer = Buffer.concat(chunks)
  json.accessors = accessors
  json.bufferViews = views
  json.buffers = [{ byteLength: buffer.length }]
  // Nothing here has textures, and a stray image would break the single-buffer
  // assumption above.
  if (json.images?.length) throw new Error('this pack has images; the packer assumes none')

  return { json, buffer, stripped }
}

/** Wraps JSON and binary into a .glb container. */
function pack(json, buffer) {
  const jsonChunk = pad(Buffer.from(JSON.stringify(json), 'utf8'), 0x20)
  const binChunk = pad(buffer, 0x00)

  const header = Buffer.alloc(12)
  header.write('glTF', 0, 'ascii')
  header.writeUInt32LE(2, 4)
  header.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + binChunk.length, 8)

  const jsonHeader = Buffer.alloc(8)
  jsonHeader.writeUInt32LE(jsonChunk.length, 0)
  jsonHeader.writeUInt32LE(0x4e4f534a, 4)

  const binHeader = Buffer.alloc(8)
  binHeader.writeUInt32LE(binChunk.length, 0)
  binHeader.writeUInt32LE(0x004e4942, 4)

  return Buffer.concat([header, jsonHeader, jsonChunk, binHeader, binChunk])
}

function pad(buffer, byte) {
  const over = buffer.length % 4
  if (!over) return buffer
  return Buffer.concat([buffer, Buffer.alloc(4 - over, byte)])
}

main()
