'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireOwner } from '@/core/auth'
import { setSetting, type Settings } from '@/core/settings'
import { setSidebarCollapsed, setTheme, type Theme } from '@/core/theme'

// Server actions are standalone POST endpoints addressed by id, so the (app)
// layout does not run for them and each one authenticates on its own.

export async function toggleTheme(current: Theme) {
  await requireOwner()
  await setTheme(current === 'dark' ? 'light' : 'dark')
  revalidatePath('/', 'layout')
}

export async function toggleSidebar(collapsed: boolean) {
  await requireOwner()
  await setSidebarCollapsed(collapsed)
  revalidatePath('/', 'layout')
}

// Tile ids are module ids and the core tile names, all short and lowercase;
// anything else is not a layout and is refused rather than stored.
const layoutSchema = z
  .object({
    order: z.array(z.string().regex(/^[a-z0-9_-]{1,40}$/)).max(40),
    hidden: z.array(z.string().regex(/^[a-z0-9_-]{1,40}$/)).max(40),
  })
  .nullable()

/** The key is fixed here: the client says what the layout is, not where it goes. */
export async function saveDashboardLayout(layout: Settings['dashboard_layout']) {
  await requireOwner()
  await setSetting('dashboard_layout', layoutSchema.parse(layout))
  revalidatePath('/', 'layout')
}
