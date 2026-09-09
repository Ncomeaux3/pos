import { PageHeader } from '@/components/pos'
import { listDocuments, listPolicies, ownerToday } from '../data'
import { annualCents, daysUntil, policyStatus, type Cadence } from '../premium'
import { Insurance, type InsuranceData } from './Insurance'

export default async function InsurancePage() {
  const [policies, documents, todayIso] = await Promise.all([
    listPolicies(),
    listDocuments(),
    ownerToday(),
  ])

  const data: InsuranceData = {
    todayIso,
    policies: policies.map((p) => ({
      id: p.id,
      kind: p.kind,
      name: p.name,
      carrier: p.carrier,
      // Masked in the query. The plaintext is a separate action with an id
      // behind it, never a field that rides along in this payload.
      maskedNumber: p.masked_number,
      expiresOn: p.expires_on,
      premiumCents: p.premium_cents,
      cadence: p.cadence as Cadence,
      deductibleCents: p.deductible_cents,
      limits: p.limits,
      agentName: p.agent_name,
      agentContact: p.agent_contact,
      reminderLeads: p.reminder_leads,
      postToFinance: p.post_to_finance,
      status: p.status,
      notes: p.notes,
      documentCount: p.document_count,
    })),
    documents: documents.map((d) => ({
      id: d.id,
      policyId: d.policy_id,
      name: d.name,
      meta: d.meta,
    })),
  }

  const active = data.policies.filter((p) => p.status === 'active')
  const annual = active.reduce((sum, p) => sum + annualCents(p.premiumCents, p.cadence), 0)
  const soon = active.filter((p) => {
    const status = policyStatus(p.expiresOn, todayIso)
    return status === 'expiring' || status === 'renew-now' || status === 'expired'
  })
  const next = active
    .filter((p) => p.expiresOn !== null && daysUntil(p.expiresOn, todayIso)! >= 0)
    .sort((a, b) => (a.expiresOn! < b.expiresOn! ? -1 : 1))[0]

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={
          soon.length > 0
            ? `Insurance / ${soon.length} expiring inside 60 days`
            : next
              ? `Insurance / next renewal in ${daysUntil(next.expiresOn, todayIso)} days`
              : 'Insurance / nothing expiring'
        }
        dot={soon.length > 0 ? 'warn' : 'ok'}
        title="Insurance and policies"
        lede="Sorted by what expires first. Reminders fire 60, 30 and 7 days out by default. What each policy covers is recorded in the words on the declarations page and nothing here judges whether it is enough: no gap analysis, no scoring, no opinion."
        actions={
          <span className="num text-[11px] text-ink-3">
            ${Math.round(annual / 100).toLocaleString('en-US')} a year
          </span>
        }
      />
      <Insurance data={data} />
    </div>
  )
}
