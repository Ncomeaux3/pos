import { describe, expect, it } from 'vitest'
import { toCalendarItems } from './calendar'

const range = { from: '2026-09-01', to: '2026-09-30' }

const row = (over: Partial<Parameters<typeof toCalendarItems>[0][number]> = {}) => ({
  id: 't1',
  title: 'Renew passport',
  due_on: '2026-09-15',
  due_at: null,
  status: 'open',
  ...over,
})

describe('toCalendarItems', () => {
  it('is all day when there is no time of day', () => {
    const [item] = toCalendarItems([row()], range)
    expect(item.allDay).toBe(true)
    expect(item.startsAt).toBe('2026-09-15')
  })

  it('combines the date and time when one is set', () => {
    const [item] = toCalendarItems([row({ due_at: '14:30' })], range)
    expect(item.allDay).toBe(false)
    expect(item.startsAt).toBe('2026-09-15T14:30')
  })

  it('marks a done task done rather than dropping it', () => {
    const [item] = toCalendarItems([row({ status: 'done' })], range)
    expect(item.done).toBe(true)
    expect(item.kind).toBe('task')
  })

  it('drops a due date outside the range', () => {
    expect(toCalendarItems([row({ due_on: '2026-08-31' })], range)).toHaveLength(0)
    expect(toCalendarItems([row({ due_on: '2026-10-01' })], range)).toHaveLength(0)
  })

  it('links to the task', () => {
    const [item] = toCalendarItems([row()], range)
    expect(item.href).toBe('/tasks?task=t1')
    expect(item.module).toBe('tasks')
  })
})
