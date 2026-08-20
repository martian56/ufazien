import { describe, expect, it } from 'vitest'

// The build script, not a component — but it is the thing that decides what
// every prop in the campus is made of, and it is homegrown rather than a
// library, so it is worth more than a glance.
import { parseObj, toGlb } from '../../../scripts/build-props.mjs'

const CUBE_FACE = `
# a single quad with two materials' worth of structure
v 0 0 0
v 1 0 0
v 1 1 0
v 0 1 0
vn 0 0 1
usemtl Green
f 1//1 2//1 3//1 4//1
`

describe('reading an OBJ', () => {
  it('triangulates a quad into two triangles', () => {
    // The pack is quads throughout and glTF has no such thing.
    const [group] = parseObj(CUBE_FACE)
    expect(group.material).toBe('Green')
    expect(group.indices).toHaveLength(6)
    expect(group.positions).toHaveLength(4 * 3)
  })

  it('keeps a vertex per position-and-normal pair', () => {
    // OBJ indexes positions and normals separately; glTF cannot. Two faces
    // sharing a corner but not a normal need two vertices there, which is what
    // makes flat shading possible at all.
    const twoNormals = `
v 0 0 0
v 1 0 0
v 1 1 0
vn 0 0 1
vn 1 0 0
usemtl M
f 1//1 2//1 3//1
f 1//2 2//2 3//2
`
    const [group] = parseObj(twoNormals)
    expect(group.positions).toHaveLength(6 * 3)
    expect(group.indices).toHaveLength(6)
  })

  it('splits by material, because that is what becomes a draw call', () => {
    const two = `
v 0 0 0
v 1 0 0
v 1 1 0
vn 0 0 1
usemtl Wood
f 1//1 2//1 3//1
usemtl Green
f 1//1 2//1 3//1
`
    const groups = parseObj(two)
    expect(groups.map((g) => g.material)).toEqual(['Wood', 'Green'])
  })

  it('resolves negative indices, which count back from the end', () => {
    const relative = `
v 0 0 0
v 1 0 0
v 1 1 0
vn 0 0 1
usemtl M
f -3//-1 -2//-1 -1//-1
`
    const [group] = parseObj(relative)
    expect(group.indices).toHaveLength(3)
    expect(group.positions.slice(0, 3)).toEqual([0, 0, 0])
  })

  it('ignores comments, blanks and anything it does not use', () => {
    const noisy = `
# comment
mtllib thing.mtl
o SomeObject
s off
${CUBE_FACE}
`
    expect(parseObj(noisy)).toHaveLength(1)
  })

  it('drops a group that ended up with no faces', () => {
    expect(parseObj('v 0 0 0\nusemtl Empty\n')).toHaveLength(0)
  })

  it('refuses a face pointing at a vertex that is not there', () => {
    // Silently writing a mesh with a hole in it is worse than stopping.
    expect(() => parseObj('v 0 0 0\nvn 0 0 1\nusemtl M\nf 1//1 9//1 3//1\n')).toThrow(
      /missing vertex/,
    )
  })
})

describe('writing a GLB', () => {
  const built = () => toGlb(parseObj(CUBE_FACE), new Map([['Green', [0.1, 0.5, 0.2]]]), 'Quad')

  it('writes a container a loader will accept', () => {
    const glb = built()
    expect(glb.readUInt32LE(0)).toBe(0x46546c67) // 'glTF'
    expect(glb.readUInt32LE(4)).toBe(2)
    expect(glb.readUInt32LE(8), 'declared length must match the file').toBe(glb.length)
  })

  it('describes exactly the bytes it wrote', () => {
    // An accessor claiming more than its view holds is the failure that renders
    // as nothing, or as garbage, depending on the driver.
    const glb = built()
    const jsonLength = glb.readUInt32LE(12)
    const json = JSON.parse(glb.subarray(20, 20 + jsonLength).toString('utf8'))
    const sizes: Record<number, number> = { 5126: 4, 5123: 2, 5125: 4 }
    const arity: Record<string, number> = { VEC3: 3, SCALAR: 1 }
    for (const accessor of json.accessors) {
      const view = json.bufferViews[accessor.bufferView]
      const needed = accessor.count * sizes[accessor.componentType] * arity[accessor.type]
      expect(needed).toBeLessThanOrEqual(view.byteLength)
    }
    expect(json.buffers[0].byteLength).toBeGreaterThan(0)
  })

  it('carries the material colour through', () => {
    const glb = built()
    const jsonLength = glb.readUInt32LE(12)
    const json = JSON.parse(glb.subarray(20, 20 + jsonLength).toString('utf8'))
    const pbr = json.materials[0].pbrMetallicRoughness
    expect(pbr.baseColorFactor.slice(0, 3)).toEqual([0.1, 0.5, 0.2])
    // No environment map in this project, so metal renders black. CLAUDE.md.
    expect(pbr.metallicFactor).toBe(0)
  })

  it('bounds the positions, which glTF requires', () => {
    const glb = built()
    const jsonLength = glb.readUInt32LE(12)
    const json = JSON.parse(glb.subarray(20, 20 + jsonLength).toString('utf8'))
    const position = json.accessors[0]
    expect(position.min).toEqual([0, 0, 0])
    expect(position.max).toEqual([1, 1, 0])
  })
})
