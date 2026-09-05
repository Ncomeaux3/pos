import { db } from './db'

// The handful of knobs a fork needs without touching .env. Everything here is
// owner-editable on the Settings page; anything infrastructural stays in .env.
export type Settings = {
  timezone: string
  owner_name: string
  /** Hour of the local day the digest is written for. The cron itself is 09:00 UTC. */
  digest_hour: number
  /** Month to date ceiling on model spend. Past this, research calls refuse. */
  llm_soft_cap_cents: number
}
export type SettingKey = keyof Settings

export const DEFAULT_SETTINGS: Settings = {
  timezone: 'America/Chicago',
  owner_name: '',
  digest_hour: 9,
  llm_soft_cap_cents: 1000,
}

export async function getSetting<K extends SettingKey>(key: K): Promise<Settings[K]> {
  const { rows } = await db().query<{ value: Settings[K] }>(
    'select value from core.settings where key = $1',
    [key],
  )
  return rows.length > 0 ? rows[0].value : DEFAULT_SETTINGS[key]
}

export async function getSettings(): Promise<Settings> {
  const { rows } = await db().query<{ key: SettingKey; value: unknown }>(
    'select key, value from core.settings',
  )
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  return { ...DEFAULT_SETTINGS, ...stored }
}

export async function setSetting<K extends SettingKey>(key: K, value: Settings[K]): Promise<void> {
  await db().query(
    `insert into core.settings (key, value) values ($1, $2::jsonb)
     on conflict (key) do update set value = excluded.value`,
    [key, JSON.stringify(value)],
  )
}
