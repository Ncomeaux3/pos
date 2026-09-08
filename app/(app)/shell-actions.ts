'use server'

import { revalidatePath } from 'next/cache'
import { requireOwner } from '@/core/auth'
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
