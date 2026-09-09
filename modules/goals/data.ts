import { db } from '@/core/db'
import type { GoalKind, Point } from './progress'

// Reads for the screen and the digest. The shape it renders and the arithmetic
// over it live in ./progress.ts, which a client component can import.

export type GoalRow = {
  id: string
  title: string
  notes: string
  area: string
  kind: GoalKind
  unit: string
  start_value: string
  target_value: string
  deadline: string
  metric_source: string | null
  archived: boolean
  created_at: Date
}

export async function listGoals(includeArchived = true): Promise<GoalRow[]> {
  const { rows } = await db().query<GoalRow>(
    `select id, title, notes, area, kind, unit, start_value, target_value,
            deadline::text, metric_source, archived, created_at
       from goals.goal
      where $1 or archived = false
      order by archived, deadline`,
    [includeArchived],
  )
  return rows
}

/**
 * Every check-in, as days ago and a value, which is the shape progress() takes.
 * Days are computed against the owner's date, not the database's, so a check-in
 * entered this evening is zero days ago rather than one.
 */
export async function historyByGoal(): Promise<Map<string, Point[]>> {
  const { rows } = await db().query<{ goal_id: string; days_ago: number; value: string }>(
    `select goal_id,
            (core.today() - occurred_on)::int as days_ago,
            value::text
       from goals.checkin
      order by occurred_on`,
  )

  const map = new Map<string, Point[]>()
  for (const r of rows) {
    const point = { daysAgo: r.days_ago, value: Number(r.value) }
    map.set(r.goal_id, [...(map.get(r.goal_id) ?? []), point])
  }
  return map
}

export async function checkIn(args: {
  goalId: string
  value: number
  note?: string
  occurredOn?: string
  isManual?: boolean
}): Promise<void> {
  await db().query(
    `insert into goals.checkin (goal_id, value, note, occurred_on, is_manual)
     values ($1, $2, $3, coalesce($4::date, core.today()), $5)
     on conflict (goal_id, occurred_on) do update
       set value = excluded.value,
           note = excluded.note,
           -- A hand entered reading overrules a computed one, and the nightly
           -- job must never take it back. Manual only ever goes true.
           is_manual = goals.checkin.is_manual or excluded.is_manual
     -- The latch above kept the flag but not the number: pullMetrics writes
     -- is_manual false onto today's row, which is the same row the owner may
     -- already have typed by hand, and set value = excluded.value took it back.
     -- Same guard core.skill_links uses, plus the case that flag alone missed:
     -- the owner correcting their own reading is still a manual write.
     where goals.checkin.is_manual = false or excluded.is_manual`,
    [args.goalId, args.value, args.note ?? '', args.occurredOn ?? null, args.isManual ?? true],
  )
}

/**
 * The columns a patch is allowed to name.
 *
 * Not the type restated: patchGoal builds its SET clause by interpolating
 * column names and is reached from a server action, which is a public POST
 * endpoint whose TypeScript signature is erased at runtime.
 */
const PATCHABLE = [
  'title',
  'notes',
  'area',
  'kind',
  'unit',
  'start_value',
  'target_value',
  'deadline',
  'metric_source',
  'archived',
] as const

export type GoalPatch = Partial<Record<(typeof PATCHABLE)[number], unknown>>

export async function patchGoal(id: string, patch: GoalPatch): Promise<void> {
  const fields = PATCHABLE.filter((f) => f in patch)
  if (fields.length === 0) return

  const set = fields.map((f, i) => `${f} = $${i + 2}`).join(', ')
  await db().query(`update goals.goal set ${set} where id = $1`, [
    id,
    ...fields.map((f) => patch[f]),
  ])
}
