import { db } from './db'

/**
 * The owner's date, as the database computes it.
 *
 * Not `new Date()` in Node and not `current_date` in SQL: the first is the
 * server's timezone, the second is the database's, and neither is necessarily
 * the owner's. core.today() reads core.settings.timezone, so every module and
 * every screen agree about what day it is even when the three clocks do not.
 */
export async function ownerToday(): Promise<string> {
  const { rows } = await db().query<{ today: string }>(`select core.today()::text as today`)
  return rows[0].today
}
