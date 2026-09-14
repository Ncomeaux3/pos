import { describe, expect, it } from 'vitest'
import type { NavItem } from './nav'
import { phoneTabs } from './phone-tabs'

const item = (href: string, label: string): NavItem => ({ href, label, code: '00' })

const nav = [
  item('/', 'Dashboard'),
  item('/finance', 'Finance'),
  item('/skills', 'Skill Tree'),
  item('/tasks', 'Tasks'),
  item('/goals', 'Goals'),
  item('/review', 'Review'),
]

describe('phoneTabs', () => {
  it('is Home, Tasks, Finance, Browse, whatever order the rail has', () => {
    expect(phoneTabs(nav).map((t) => t.label)).toEqual(['Home', 'Tasks', 'Finance', 'Browse'])
  })

  it('drops a disabled module and keeps Browse last', () => {
    // Finance disabled: the bar tops up from rail order and Browse stays the
    // last tab, because Browse is where the rest of the app is.
    const tabs = phoneTabs(nav.filter((n) => n.href !== '/finance'))
    expect(tabs.map((t) => t.href)).toEqual(['/', '/tasks', '/skills', '/browse'])
  })
})
