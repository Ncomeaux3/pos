'use server'

import { revalidatePath } from 'next/cache'
import { requireOwner } from '@/core/auth'
import type { Channel } from '@/core/notification-rules'
import { listRules, patchRule } from '@/core/notify'
import { setSetting, type SettingKey, type Settings } from '@/core/settings'

// Server actions are standalone POST endpoints addressed by id, so the (app)
// layout does not run for them and each one authenticates independently.

export type ActionResult = { ok: true } | { ok: false; error: string }

function done(): ActionResult {
  revalidatePath('/settings/notifications')
  revalidatePath('/notifications')
  revalidatePath('/', 'layout')
  return { ok: true }
}

function failed(error: unknown): ActionResult {
  return { ok: false, error: error instanceof Error ? error.message : 'Failed' }
}

const CHANNELS: Channel[] = ['push', 'email', 'inapp']

/**
 * Turn a channel on or off for every rule in one module. The grid's cell is a
 * rollup, so the write it makes has to be one too.
 */
export async function setModuleChannel(
  module: string,
  channel: Channel,
  on: boolean,
): Promise<ActionResult> {
  await requireOwner()
  if (!CHANNELS.includes(channel)) return { ok: false, error: `${channel} is not a channel` }

  try {
    const rules = (await listRules()).filter((r) => r.module === module)
    for (const rule of rules) {
      const has = rule.channels.includes(channel)
      if (has === on) continue
      await patchRule(rule.id, {
        channels: on ? [...rule.channels, channel] : rule.channels.filter((c) => c !== channel),
      })
    }
    return done()
  } catch (error) {
    return failed(error)
  }
}

/**
 * Batching for a whole module. On means the morning digest, because that is the
 * one every module has; a rule that should land in the evening is set on the
 * Notifications screen, and turning batching off here leaves it immediate.
 */
export async function setModuleDigest(module: string, on: boolean): Promise<ActionResult> {
  await requireOwner()
  try {
    const rules = (await listRules()).filter((r) => r.module === module)
    for (const rule of rules) {
      const batched = rule.timing !== 'immediate'
      if (batched === on) continue
      await patchRule(rule.id, { timing: on ? 'morning' : 'immediate' })
    }
    return done()
  } catch (error) {
    return failed(error)
  }
}

/**
 * The keys this tab owns. A server action accepts whatever it is sent and the
 * type parameter is erased at runtime, so without this the quiet hours card
 * would be a general purpose write to any setting.
 */
const QUIET_KEYS = ['quiet_from', 'quiet_to', 'quiet_urgent_override'] as const satisfies
  readonly SettingKey[]

type QuietKey = (typeof QUIET_KEYS)[number]

export async function setQuiet<K extends QuietKey>(
  key: K,
  value: Settings[K],
): Promise<ActionResult> {
  await requireOwner()
  if (!(QUIET_KEYS as readonly string[]).includes(key)) {
    return { ok: false, error: `${key} is not a quiet hours setting` }
  }
  try {
    await setSetting(key, value)
    return done()
  } catch (error) {
    return failed(error)
  }
}
