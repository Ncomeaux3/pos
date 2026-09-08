'use server'

import { requireOwner } from '@/core/auth'
import { getModule } from '@/core/modules'
import { search } from '@/core/search'

export type PaletteHit = {
  id: string
  module: string
  moduleLabel: string
  entityType: string
  title: string
}

/**
 * What the command palette calls as you type. Server actions are standalone
 * POST endpoints addressed by id, so the (app) layout does not run for them and
 * this authenticates on its own.
 */
export async function paletteSearch(query: string): Promise<PaletteHit[]> {
  await requireOwner()

  const hits = await search(query, { limit: 6 })
  return hits.map((h) => ({
    id: h.id,
    module: h.module,
    moduleLabel: getModule(h.module)?.nav.label ?? h.module,
    entityType: h.entityType,
    title: h.title,
  }))
}
