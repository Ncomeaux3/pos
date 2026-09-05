import { classify } from './classify'
import { db } from './db'
import { emit } from './events'

export type RegisterArgs = {
  module: string
  entityType: string
  /** The module row's own id. Unique within module and type. */
  entityId: string
  title: string
  /** Indexable text. Classification, search, and embedding all read it. */
  text?: string
  /** Defaults to `<entityType>_created`. */
  eventType?: string
  /** Imports backdate this so XP reflects real history. */
  occurredAt?: Date
  payload?: Record<string, unknown>
}

/**
 * The one call every module makes when it creates a row: register the entity,
 * classify it to skills, emit the event. That is what keeps the Skill Tree,
 * Goals, and the dashboard consistent without any module knowing about them.
 */
export async function register({
  module,
  entityType,
  entityId,
  title,
  text,
  eventType,
  occurredAt,
  payload,
}: RegisterArgs): Promise<string> {
  const { rows } = await db().query<{ id: string }>(
    `insert into core.entities (module, entity_type, entity_id, title, body)
     values ($1, $2, $3, $4, $5)
     on conflict (module, entity_type, entity_id) do update
       set title = excluded.title, body = excluded.body
     returning id`,
    [module, entityType, entityId, title, text ?? null],
  )
  const entityRef = rows[0].id

  await classify(entityRef, [title, text].filter(Boolean).join('\n'), module)
  await emit({
    module,
    entityRef,
    eventType: eventType ?? `${entityType}_created`,
    occurredAt,
    payload,
    titleSnapshot: title,
  })

  return entityRef
}
