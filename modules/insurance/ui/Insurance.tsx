'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import {
  ActionButton,
  Card,
  CardHead,
  Chip,
  EmptyState,
  Eyebrow,
  MetricStrip,
  MetricTile,
  Overlay,
  PillGroup,
  Row,
  RowList,
  StatusChip,
  Switch,
  fieldClass,
  useToast,
} from '@/components/pos'
import { cn } from '@/lib/utils'
import {
  CADENCE_LABELS,
  STATUS_LABELS,
  annualCents,
  daysUntil,
  expiryLabel,
  nextTermEnd,
  policyStatus,
  type Cadence,
} from '../premium'
import { LOW_CONFIDENCE, type DraftField } from '../draft'
import {
  createFromDraft,
  discardDraft,
  draftPolicy,
  renewPolicy,
  reveal,
  savePolicy,
  type ActionResult,
} from './actions'

export type InsuranceData = {
  todayIso: string
  policies: {
    id: string
    kind: string
    name: string
    carrier: string
    maskedNumber: string
    expiresOn: string | null
    premiumCents: number
    cadence: Cadence
    deductibleCents: number | null
    limits: string
    agentName: string
    agentContact: string
    reminderLeads: number[]
    postToFinance: boolean
    status: string
    notes: string
    documentCount: number
  }[]
  documents: { id: string; policyId: string; name: string; meta: string }[]
}

const KINDS = [
  'auto', 'renters', 'homeowners', 'health', 'dental', 'vision', 'life', 'pet',
  'device', 'umbrella', 'other',
] as const

const LEADS = [60, 30, 14, 7, 0]

const money = (cents: number) =>
  `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: cents % 100 === 0 ? 0 : 2 })}`

const TONE: Record<string, 'brand' | 'quiet' | 'warn' | 'bad'> = {
  expired: 'bad',
  'renew-now': 'bad',
  expiring: 'warn',
  active: 'brand',
  undated: 'quiet',
}

export function Insurance({ data }: { data: InsuranceData }) {
  const router = useRouter()
  const params = useSearchParams()
  const open = data.policies.find((p) => p.id === params.get('policy')) ?? null
  const editing = params.get('edit') === '1'
  const uploading = params.get('upload') === '1'

  const setParams = (next: Record<string, string | null>) => {
    const search = new URLSearchParams(params.toString())
    for (const [key, value] of Object.entries(next)) {
      if (value === null) search.delete(key)
      else search.set(key, value)
    }
    const query = search.toString()
    router.replace(query ? `?${query}` : '?', { scroll: false })
  }

  const [, start] = useTransition()
  const toast = useToast()
  /** The one policy number the owner asked to see, held only in this state. */
  const [revealed, setRevealed] = useState<{ id: string; number: string } | null>(null)

  const run = (action: () => Promise<ActionResult>, ok?: string) =>
    start(async () => {
      const result = await action()
      if (!result.ok) toast(result.error)
      else if (ok) toast(ok)
    })

  const active = data.policies.filter((p) => p.status === 'active')
  const annual = active.reduce((sum, p) => sum + annualCents(p.premiumCents, p.cadence), 0)
  const soon = active.filter((p) => {
    const status = policyStatus(p.expiresOn, data.todayIso)
    return status === 'expiring' || status === 'renew-now' || status === 'expired'
  })
  const next = active
    .filter((p) => p.expiresOn !== null && daysUntil(p.expiresOn, data.todayIso)! >= 0)
    .sort((a, b) => (a.expiresOn! < b.expiresOn! ? -1 : 1))[0]
  const linked = active.filter((p) => p.postToFinance).length

  return (
    <div className="space-y-5">
      <MetricStrip>
        <MetricTile
          label="Annual premium"
          value={money(annual)}
          delta={`${active.length} active policies`}
        />
        <MetricTile
          label="Per month"
          value={money(Math.round(annual / 12))}
          delta={`${linked} posting to Finance`}
          deltaTone="quiet"
        />
        <MetricTile
          label="Next renewal"
          value={next ? `${daysUntil(next.expiresOn, data.todayIso)} days` : 'none'}
          delta={next ? `${next.name} / ${next.expiresOn}` : 'nothing dated'}
        />
        <MetricTile
          label="Expiring in 60d"
          value={soon.length}
          delta={soon.length > 0 ? soon.map((p) => p.name).join(', ') : 'nothing soon'}
          deltaTone={soon.length > 0 ? 'warn' : 'quiet'}
        />
      </MetricStrip>

      <div className="flex flex-wrap gap-2">
        <ActionButton variant="brand" onClick={() => setParams({ upload: '1' })}>
          Upload PDF
        </ActionButton>
        <ActionButton onClick={() => setParams({ policy: 'new', edit: '1' })}>
          Add policy
        </ActionButton>
      </div>

      <Card className="space-y-3">
        <CardHead label="Policies" meta="sorted by what expires first" />
        {data.policies.length === 0 ? (
          <EmptyState headline="No policies" className="border-0">
            Add one by hand, or drop a declarations page and confirm what is read off it.
          </EmptyState>
        ) : (
          <RowList>
            {data.policies.map((policy) => {
              const status = policyStatus(policy.expiresOn, data.todayIso)
              return (
                <Row
                  key={policy.id}
                  title={policy.name}
                  meta={`${policy.carrier} / ${policy.maskedNumber}`}
                  selected={open?.id === policy.id}
                  muted={policy.status !== 'active'}
                  onClick={() => setParams({ policy: policy.id, edit: null })}
                  right={
                    <>
                      <Chip tone="quiet">{policy.kind}</Chip>
                      <span className="num text-[11px] text-ink-2">
                        {money(policy.premiumCents)} {CADENCE_LABELS[policy.cadence].toLowerCase()}
                      </span>
                      <span className="num text-[11px] text-ink-3">
                        {expiryLabel(policy.expiresOn, data.todayIso)}
                      </span>
                      <StatusChip tone={TONE[status]}>{STATUS_LABELS[status]}</StatusChip>
                    </>
                  }
                />
              )
            })}
          </RowList>
        )}
      </Card>

      <Overlay
        open={open !== null && !editing}
        onClose={() => setParams({ policy: null })}
        eyebrow={open?.kind}
        title={open?.name ?? ''}
      >
        {open && (
          <div className="space-y-4">
            <p className="t-caption text-ink-3">{open.carrier}</p>

            <div className="flex flex-wrap items-center gap-2">
              <span className="num text-[12px] text-ink">
                {revealed?.id === open.id ? revealed.number : open.maskedNumber}
              </span>
              <ActionButton
                onClick={() =>
                  start(async () => {
                    if (revealed?.id === open.id) {
                      setRevealed(null)
                      return
                    }
                    const result = await reveal(open.id)
                    if (!result.ok) toast(result.error)
                    else setRevealed({ id: open.id, number: result.number })
                  })
                }
              >
                {revealed?.id === open.id ? 'Hide' : 'Reveal'}
              </ActionButton>
            </div>

            <div className="space-y-1.5">
              <Fact label="Expires" value={`${open.expiresOn ?? 'no date on file'} / ${expiryLabel(open.expiresOn, data.todayIso)}`} />
              <Fact
                label="Premium"
                value={`${money(open.premiumCents)} ${CADENCE_LABELS[open.cadence].toLowerCase()} / ${money(annualCents(open.premiumCents, open.cadence))} a year`}
              />
              <Fact
                label="Deductible"
                value={
                  // Null is "not on this policy", which term life genuinely is
                  // not. Zero would claim the deductible is nothing.
                  open.deductibleCents === null ? 'none on this policy' : money(open.deductibleCents)
                }
              />
              <Fact label="Coverage limits" value={open.limits || 'nothing written down'} />
              <Fact label="Agent" value={[open.agentName, open.agentContact].filter(Boolean).join(' / ') || 'none'} />
              <Fact
                label="Reminders"
                value={
                  open.reminderLeads.length > 0
                    ? open.reminderLeads
                        .slice()
                        .sort((a, b) => b - a)
                        .map((l) => (l === 0 ? 'day of' : `${l}d`))
                        .join(' / ')
                    : 'off'
                }
              />
            </div>

            <p className="t-caption rounded-md border border-rule-2 px-3 py-2 text-ink-3">
              What this covers is recorded in the words on the declarations page. Nothing here
              scores it, compares it or has an opinion about whether it is enough.
            </p>

            <div className="space-y-1.5">
              <Eyebrow>Documents</Eyebrow>
              {data.documents.filter((d) => d.policyId === open.id).length === 0 ? (
                <p className="t-caption text-ink-3">No documents yet.</p>
              ) : (
                <RowList>
                  {data.documents
                    .filter((d) => d.policyId === open.id)
                    .map((d) => (
                      <Row key={d.id} title={d.name} meta={d.meta} />
                    ))}
                </RowList>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <ActionButton onClick={() => setParams({ edit: '1' })}>Edit</ActionButton>
              {open.expiresOn && (
                <ActionButton
                  variant="brand"
                  onClick={() =>
                    run(
                      () => renewPolicy(open.id, nextTermEnd(open.expiresOn!, open.cadence)),
                      `Renewed to ${nextTermEnd(open.expiresOn!, open.cadence)}. Same row, so the history stays together.`,
                    )
                  }
                >
                  Mark renewed to {nextTermEnd(open.expiresOn, open.cadence)}
                </ActionButton>
              )}
            </div>
          </div>
        )}
      </Overlay>

      <PolicyForm
        open={editing}
        policy={open}
        onClose={() => setParams({ edit: null, policy: open?.id === 'new' ? null : params.get('policy') })}
        run={run}
      />

      <UploadDrawer open={uploading} onClose={() => setParams({ upload: null })} toast={toast} />
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="t-caption text-ink-3">{label}</span>
      <span className="num text-right text-[11px] text-ink-2">{value}</span>
    </div>
  )
}

function PolicyForm({
  open,
  policy,
  onClose,
  run,
}: {
  open: boolean
  policy: InsuranceData['policies'][number] | null
  onClose: () => void
  run: (action: () => Promise<ActionResult>, ok?: string) => void
}) {
  const [form, setForm] = useState({
    kind: policy?.kind ?? 'auto',
    name: policy?.name ?? '',
    carrier: policy?.carrier ?? '',
    policyNumber: '',
    expiresOn: policy?.expiresOn ?? '',
    premium: policy ? String(policy.premiumCents / 100) : '',
    cadence: policy?.cadence ?? 'monthly',
    deductible: policy?.deductibleCents === null || policy === null ? '' : String(policy.deductibleCents / 100),
    limits: policy?.limits ?? '',
    agentName: policy?.agentName ?? '',
    agentContact: policy?.agentContact ?? '',
    leads: policy?.reminderLeads ?? [60, 30, 7],
    postToFinance: policy?.postToFinance ?? false,
  })

  const set = (patch: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...patch }))
  const dollars = (value: string) => {
    const n = Number(value.replace(/[^0-9.]/g, ''))
    return value.trim() === '' || !Number.isFinite(n) ? null : Math.round(n * 100)
  }

  return (
    <Overlay
      open={open}
      onClose={onClose}
      eyebrow={policy ? 'Edit' : 'New policy'}
      title={policy?.name ?? 'Add a policy'}
      footer={
        <div className="flex gap-2">
          <ActionButton
            variant="brand"
            disabled={!form.name.trim()}
            onClick={() => {
              run(
                () =>
                  savePolicy({
                    id: policy?.id,
                    kind: form.kind,
                    name: form.name,
                    carrier: form.carrier,
                    policyNumber: form.policyNumber || undefined,
                    expiresOn: form.expiresOn || null,
                    premiumCents: dollars(form.premium) ?? 0,
                    cadence: form.cadence,
                    deductibleCents: dollars(form.deductible),
                    limits: form.limits,
                    agentName: form.agentName,
                    agentContact: form.agentContact,
                    reminderLeads: form.leads,
                    postToFinance: form.postToFinance,
                  }),
                policy ? 'Saved' : 'Policy created',
              )
              onClose()
            }}
          >
            {policy ? 'Save' : 'Create'}
          </ActionButton>
          <ActionButton onClick={onClose}>Cancel</ActionButton>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Policy name">
          <input
            aria-label="Policy name"
            value={form.name}
            onChange={(e) => set({ name: e.target.value })}
            className={cn(fieldClass, 'w-full')}
          />
        </Field>

        <div className="space-y-1.5">
          <Eyebrow>Type</Eyebrow>
          <PillGroup
            label="Policy type"
            value={form.kind}
            options={KINDS.map((k) => ({ value: k, label: k }))}
            onChange={(kind) => set({ kind })}
          />
        </div>

        <Field label="Carrier">
          <input
            aria-label="Carrier"
            value={form.carrier}
            onChange={(e) => set({ carrier: e.target.value })}
            className={cn(fieldClass, 'w-full')}
          />
        </Field>

        <Field label="Policy number">
          <input
            aria-label="Policy number"
            value={form.policyNumber}
            placeholder={policy ? 'leave blank to keep the one on file' : ''}
            onChange={(e) => set({ policyNumber: e.target.value })}
            className={cn(fieldClass, 'w-full')}
          />
          <p className="t-caption text-ink-3">Encrypted at rest, and shown masked everywhere.</p>
        </Field>

        <div className="flex flex-wrap gap-3">
          <Field label="Expires" className="min-w-0 flex-1">
            <input
              type="date"
              aria-label="Expires"
              value={form.expiresOn}
              onChange={(e) => set({ expiresOn: e.target.value })}
              className={cn(fieldClass, 'w-full')}
            />
          </Field>
          <Field label="Premium" className="min-w-0 flex-1">
            <input
              inputMode="decimal"
              aria-label="Premium"
              value={form.premium}
              onChange={(e) => set({ premium: e.target.value })}
              className={cn(fieldClass, 'w-full')}
            />
          </Field>
        </div>

        <div className="space-y-1.5">
          <Eyebrow>Billed</Eyebrow>
          <PillGroup
            label="Billing cadence"
            value={form.cadence}
            options={(['monthly', 'quarterly', 'semiannual', 'annual'] as Cadence[]).map((c) => ({
              value: c,
              label: CADENCE_LABELS[c],
            }))}
            onChange={(cadence) => set({ cadence })}
          />
        </div>

        <Field label="Deductible">
          <input
            inputMode="decimal"
            aria-label="Deductible"
            value={form.deductible}
            placeholder="leave blank if the policy has none"
            onChange={(e) => set({ deductible: e.target.value })}
            className={cn(fieldClass, 'w-full')}
          />
        </Field>

        <Field label="Coverage limits">
          <input
            aria-label="Coverage limits"
            value={form.limits}
            placeholder="in the words on the page"
            onChange={(e) => set({ limits: e.target.value })}
            className={cn(fieldClass, 'w-full')}
          />
        </Field>

        <div className="flex flex-wrap gap-3">
          <Field label="Agent" className="min-w-0 flex-1">
            <input
              aria-label="Agent"
              value={form.agentName}
              onChange={(e) => set({ agentName: e.target.value })}
              className={cn(fieldClass, 'w-full')}
            />
          </Field>
          <Field label="Agent contact" className="min-w-0 flex-1">
            <input
              aria-label="Agent contact"
              value={form.agentContact}
              onChange={(e) => set({ agentContact: e.target.value })}
              className={cn(fieldClass, 'w-full')}
            />
          </Field>
        </div>

        <div className="space-y-1.5">
          <Eyebrow>Renewal reminders</Eyebrow>
          <PillGroup
            label="Reminder leads"
            multiple
            value={form.leads.map(String)}
            options={LEADS.map((l) => ({ value: String(l), label: l === 0 ? 'day of' : `${l}d` }))}
            onChange={(value) => {
              const lead = Number(value)
              set({
                leads: form.leads.includes(lead)
                  ? form.leads.filter((l) => l !== lead)
                  : [...form.leads, lead],
              })
            }}
          />
          <p className="t-caption text-ink-3">
            Sent through whatever channels Settings has on. Nothing renews itself.
          </p>
        </div>

        <Switch
          label="Post the premium to Finance"
          checked={form.postToFinance}
          onChange={(postToFinance) => set({ postToFinance })}
        />
      </div>
    </Overlay>
  )
}

function Field({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Eyebrow>{label}</Eyebrow>
      {children}
    </div>
  )
}

function UploadDrawer({
  open,
  onClose,
  toast,
}: {
  open: boolean
  onClose: () => void
  toast: (message: string) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [, start] = useTransition()
  const [working, setWorking] = useState(false)
  const [draft, setDraft] = useState<{
    fields: DraftField[]
    filePath: string
    fileName: string
  } | null>(null)

  const send = (file: File) => {
    setWorking(true)
    start(async () => {
      const form = new FormData()
      form.set('file', file)
      const result = await draftPolicy(form)
      setWorking(false)
      if (!result.ok) toast(result.error)
      else setDraft({ fields: result.fields, filePath: result.filePath, fileName: result.fileName })
    })
  }

  const close = () => {
    if (draft) discardDraft(draft.filePath)
    setDraft(null)
    onClose()
  }

  return (
    <Overlay
      open={open}
      onClose={close}
      eyebrow="Upload PDF"
      title={draft ? 'Confirm each field' : 'Drop a declarations page'}
      footer={
        draft ? (
          <div className="flex gap-2">
            <ActionButton
              variant="brand"
              onClick={() => {
                const fields = Object.fromEntries(draft.fields.map((f) => [f.key, f.value]))
                start(async () => {
                  const result = await createFromDraft({
                    fields,
                    filePath: draft.filePath,
                    fileName: draft.fileName,
                    pages: 0,
                  })
                  if (!result.ok) toast(result.error)
                  else {
                    toast('Policy created, with the PDF attached to it.')
                    setDraft(null)
                    onClose()
                  }
                })
              }}
            >
              Create policy
            </ActionButton>
            <ActionButton onClick={close}>Discard</ActionButton>
          </div>
        ) : undefined
      }
    >
      {!draft ? (
        <div className="space-y-3">
          <p className="t-caption text-ink-3">
            The declarations page works best. The PDF is sent to Anthropic with your own key so the
            fields can be drafted, and it is stored in this app&apos;s private bucket. No policy is
            created until you confirm the fields.
          </p>
          <input
            ref={input}
            type="file"
            accept="application/pdf"
            aria-label="Policy PDF"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) send(file)
            }}
            className={cn(fieldClass, 'w-full')}
          />
          {working && <p className="t-caption text-ink-2">Reading the page.</p>}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="t-caption text-ink-3">
            Drafted from {draft.fileName}. Edit anything that looks wrong: what you save is what is
            stored, not what was read.
          </p>

          {draft.fields.map((field, i) => (
            <div key={field.key} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <Eyebrow>{field.label}</Eyebrow>
                <span
                  className={cn(
                    'num text-[10px]',
                    field.confidence < LOW_CONFIDENCE ? 'text-warn' : 'text-ink-3',
                  )}
                >
                  {Math.round(field.confidence * 100)}%
                </span>
              </div>
              <input
                aria-label={field.label}
                value={field.value}
                onChange={(e) =>
                  setDraft((prev) =>
                    prev === null
                      ? prev
                      : {
                          ...prev,
                          fields: prev.fields.map((f, j) =>
                            j === i ? { ...f, value: e.target.value } : f,
                          ),
                        },
                  )
                }
                className={cn(
                  fieldClass,
                  'w-full',
                  field.confidence < LOW_CONFIDENCE && 'border-warn',
                )}
              />
            </div>
          ))}

          <p className="t-caption text-ink-3">
            A field the page did not clearly say comes back empty at zero percent rather than
            guessed. The PDF is attached to the policy as its first document.
          </p>
        </div>
      )}
    </Overlay>
  )
}
