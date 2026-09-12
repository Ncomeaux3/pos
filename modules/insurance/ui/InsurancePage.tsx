import { listDocuments, listPolicies, ownerToday, renewalChannels } from '../data'
import { type Cadence } from '../premium'
import { Insurance, type InsuranceData } from './Insurance'

export default async function InsurancePage() {
  const [policies, documents, todayIso, channels] = await Promise.all([
    listPolicies(),
    listDocuments(),
    ownerToday(),
    renewalChannels(),
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
      hasFile: d.file_path !== null,
    })),
    renewalChannels: channels,
  }

  return <Insurance data={data} />
}
