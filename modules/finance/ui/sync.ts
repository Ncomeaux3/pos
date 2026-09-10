'use server'

import { revalidatePath } from 'next/cache'
import { requireOwner } from '@/core/auth'
import { syncModule } from '@/core/sync'

/** Pull from the bank now. The nightly job and this write the same row. */
export async function syncFinance(): Promise<{ ran: number; failed: string[] }> {
  await requireOwner()
  const result = await syncModule('finance')
  revalidatePath('/finance')
  revalidatePath('/', 'layout')
  return result
}
