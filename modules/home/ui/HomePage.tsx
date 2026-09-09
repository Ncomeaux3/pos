import { PageHeader } from '@/components/pos'
import { readMetric } from '@/core/metrics'
import {
  listAssets,
  listServiceLog,
  listServices,
  listVendors,
  listWarranties,
  ownerToday,
  toSchedule,
} from '../data'
import { dueStatus, nextDue } from '../schedule'
import { Home, type HomeData } from './Home'

export default async function HomePage() {
  const [assets, services, log, warranties, vendors, todayIso, netWorth] = await Promise.all([
    listAssets(),
    listServices(),
    listServiceLog(),
    listWarranties(),
    listVendors(),
    ownerToday(),
    // The mortgage and what the house is worth against it belong to Finance.
    // Read through the registry rather than kept here twice, so there is one
    // source of truth and it is simply absent when Finance is not installed.
    readMetric('finance.net_worth'),
  ])

  const data: HomeData = {
    todayIso,
    netWorth,
    assets: assets.map((a) => ({
      id: a.id,
      kind: a.kind,
      name: a.name,
      subtitle: a.subtitle,
      valueCents: Number(a.value_cents),
      annualCostCents: Number(a.annual_cost_cents),
      valueAsOf: a.value_as_of,
      notes: a.notes,
      facts: a.facts,
    })),
    services: services.map((s) => ({
      id: s.id,
      assetId: s.asset_id,
      assetName: s.asset_name,
      title: s.title,
      intervalMonths: s.interval_months,
      lastDoneOn: s.last_done_on,
      // Derived here rather than stored, so the calendar can never disagree
      // with the history it was computed from.
      dueOn: nextDue(toSchedule(s)),
      status: dueStatus(toSchedule(s), todayIso),
      snoozeUntil: s.snooze_until,
      costEstimateCents: s.cost_estimate_cents,
      vendorName: s.vendor_name,
      notes: s.notes,
    })),
    log: log.map((l) => ({
      id: l.id,
      assetId: l.asset_id,
      what: l.what,
      doneOn: l.done_on,
      costCents: l.cost_cents,
      vendorName: l.vendor_name,
    })),
    warranties: warranties.map((w) => ({
      id: w.id,
      assetId: w.asset_id,
      name: w.name,
      detail: w.detail,
      cover: w.cover,
      expiresOn: w.expires_on,
      documentUrl: w.document_url,
      facts: w.facts,
    })),
    vendors: vendors.map((v) => ({
      id: v.id,
      name: v.name,
      trade: v.trade,
      contact: v.contact,
      lastUsedOn: v.last_used_on,
      lastCostCents: v.last_cost_cents,
    })),
  }

  const dueNow = data.services.filter((s) => s.status === 'overdue' || s.status === 'due')
  const dueCents = dueNow.reduce((sum, s) => sum + s.costEstimateCents, 0)

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={
          dueNow.length === 0
            ? 'Home / nothing due this month'
            : `Home / ${dueNow.length} job${dueNow.length === 1 ? '' : 's'} due this month / $${Math.round(dueCents / 100).toLocaleString('en-US')} estimated`
        }
        dot={
          dueNow.some((s) => s.status === 'overdue') ? 'bad' : dueNow.length > 0 ? 'warn' : 'ok'
        }
        title="Home and assets"
        lede="The house, the vehicles and the equipment worth tracking: what each is worth, what it costs to keep, and what it needs next. Maintenance is an interval and the date it was last done, so the calendar is worked out from the history rather than kept beside it."
        actions={
          <span className="num text-[11px] text-ink-3">{data.assets.length} tracked</span>
        }
      />
      <Home data={data} />
    </div>
  )
}
