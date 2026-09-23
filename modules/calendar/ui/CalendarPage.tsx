import { PageHeader } from '@/components/pos'
import { calendarItems } from '@/core/calendar-registry'
import { getModules } from '@/core/modules'
import { ownerToday } from '@/core/today'
import { getHidden } from '../data'
import { monthRange } from '../range'
import { Calendar, NewEventButton } from './Calendar'

export default async function CalendarPage() {
  const today = await ownerToday()
  const month = today.slice(0, 7)
  const [items, hidden] = await Promise.all([calendarItems(monthRange(month)), getHidden()])

  // The chips: every module that dates anything, in rail order.
  const sources = getModules()
    .filter((m) => m.calendar)
    .sort((a, b) => a.nav.order - b.nav.order)
    .map((m) => ({ id: m.id, label: m.nav.label }))

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Calendar"
        title="Calendar"
        lede="Everything dated in POS, and the events you add here."
        actions={<NewEventButton />}
        phoneAction={<NewEventButton phone />}
        search={false}
      />
      <Calendar today={today} month={month} initial={items} hidden={hidden} sources={sources} />
    </div>
  )
}
