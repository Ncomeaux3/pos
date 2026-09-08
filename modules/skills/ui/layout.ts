import type { SkillNode } from '../tree'

// Deterministic placement, not a force simulation. The prototype's constellation
// is the same every time it loads, which is what makes a skill findable twice.
// See docs/plans/design-build.md decision 8: no d3-force.

export type Ring = 'root' | 'attribute' | 'category' | 'leaf'
export type Placed = { id: string; x: number; y: number; ring: Ring; parent?: string }

export const ROOT_ID = '__you'

const ATTR_RX = 150
const ATTR_RY = 120
const LEAF_R_MIN = 330
const LEAF_R_MAX = 364
/** Radians of the wedge left empty between two attributes, so fans do not touch. */
const WEDGE_GAP = 0.18

const at = (angle: number, rx: number, ry: number) => ({
  x: Math.cos(angle) * rx,
  y: Math.sin(angle) * ry,
})

/**
 * Root at the centre, attributes on an ellipse, every leaf fanned on an outer
 * arc inside its attribute's wedge, and each category at the midpoint between
 * its attribute and its own leaves.
 *
 * Leaves are found by having no children rather than by depth, because the
 * committed tree is uneven: Engineering has categories, Health does not.
 */
export function layout(nodes: SkillNode[]): Placed[] {
  const childrenOf = new Map<string, SkillNode[]>()
  for (const node of nodes) {
    if (!node.parent) continue
    childrenOf.set(node.parent, [...(childrenOf.get(node.parent) ?? []), node])
  }

  const attributes = nodes.filter((n) => !n.parent)
  const placed: Placed[] = [{ id: ROOT_ID, x: 0, y: 0, ring: 'root' }]
  if (attributes.length === 0) return placed

  const wedge = (Math.PI * 2) / attributes.length

  attributes.forEach((attribute, i) => {
    // Start at the top and go clockwise, so the first attribute in the file is
    // where the eye lands.
    const centre = -Math.PI / 2 + i * wedge
    placed.push({ id: attribute.id, ...at(centre, ATTR_RX, ATTR_RY), ring: 'attribute' })

    const descendants = (id: string): SkillNode[] =>
      (childrenOf.get(id) ?? []).flatMap((c) => [c, ...descendants(c.id)])
    const leaves = descendants(attribute.id).filter((n) => !childrenOf.has(n.id))

    const span = wedge - WEDGE_GAP
    const positions = new Map<string, { x: number; y: number }>()

    leaves.forEach((leaf, j) => {
      // One leaf sits on the wedge's centre line rather than at its edge.
      const t = leaves.length === 1 ? 0.5 : j / (leaves.length - 1)
      const angle = centre - span / 2 + t * span
      // Alternate the radius so adjacent labels do not collide.
      const radius = LEAF_R_MIN + (j % 2) * (LEAF_R_MAX - LEAF_R_MIN)
      const point = at(angle, radius, radius)
      positions.set(leaf.id, point)
      placed.push({ id: leaf.id, ...point, ring: 'leaf', parent: leaf.parent })
    })

    for (const category of childrenOf.get(attribute.id) ?? []) {
      if (!childrenOf.has(category.id)) continue
      const own = descendants(category.id)
        .map((n) => positions.get(n.id))
        .filter((p): p is { x: number; y: number } => Boolean(p))
      if (own.length === 0) continue

      const mean = {
        x: own.reduce((s, p) => s + p.x, 0) / own.length,
        y: own.reduce((s, p) => s + p.y, 0) / own.length,
      }
      const attr = placed.find((p) => p.id === attribute.id)!
      placed.push({
        id: category.id,
        x: (attr.x + mean.x) / 2,
        y: (attr.y + mean.y) / 2,
        ring: 'category',
        parent: category.parent,
      })
    }
  })

  return placed
}

/** Node radius by level. Sized by level, per SPEC's "nodes sized by level". */
export function nodeRadius(ring: Ring, level: number): number {
  const base = ring === 'root' ? 26 : ring === 'attribute' ? 15 : ring === 'category' ? 10 : 7
  return base + Math.min(level, 20) * 0.45
}
