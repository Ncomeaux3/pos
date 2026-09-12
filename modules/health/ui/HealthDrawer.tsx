'use client'

import { useState } from 'react'
import { ActionButton, Eyebrow, Overlay } from '@/components/pos'
import { cn } from '@/lib/utils'
import { logVisit, recordUrl, setAppointmentStatus, type ActionResult } from './actions'
import {
  KIND_LABEL,
  ctl,
  longWhen,
  pill,
  recordDate,
  type Appointment,
  type HealthRecord,
} from './Health'

// The one drawer on the Health page: keyed rows for an appointment or a
// record, or the Log a visit form. The artboard's drawer has no band of its
// own, so the shared band's crumb carries the kind.

const input =
  'h-[42px] w-full min-w-0 border border-rule-2 bg-bg px-3 text-[14px] text-ink outline-none placeholder:text-ink-4 focus-visible:border-brand'
const key = 'w-[120px] shrink-0 text-[10px] tracking-[0.12em] text-ink-3'

export function HealthDrawer({
  appointment,
  record,
  isNew,
  providers,
  todayIso,
  onClose,
  onRun,
}: {
  appointment: Appointment | null
  record: HealthRecord | null
  isNew: boolean
  providers: { id: string; name: string; role: string }[]
  todayIso: string
  onClose: () => void
  onRun: (action: () => Promise<ActionResult>, ok?: string) => void
}) {
  if (isNew) return <Form providers={providers} todayIso={todayIso} onClose={onClose} onRun={onRun} />
  if (appointment) return <AppointmentView appointment={appointment} onClose={onClose} onRun={onRun} />
  if (record) return <RecordView record={record} onClose={onClose} />
  return null
}

function Rows({ rows }: { rows: [string, string][] }) {
  return (
    <div className="mt-[22px]">
      {rows
        .filter(([, v]) => v)
        .map(([k, v]) => (
          <div key={k} className="flex flex-wrap items-baseline gap-2 gap-x-3.5 border-b border-rule py-[13px]">
            <span className={key}>{k.toUpperCase()}</span>
            <span className="min-w-0 flex-[1_1_160px] text-[14px] leading-[1.45] text-ink">{v}</span>
          </div>
        ))}
    </div>
  )
}

function Head({ title, sub }: { title: string; sub: string }) {
  return (
    <>
      <h2 className="text-[22px] font-normal leading-[1.25] tracking-[-0.02em] text-ink">{title}</h2>
      {sub && <p className="mt-2 text-[12px] leading-[1.5] text-ink-3">{sub}</p>}
    </>
  )
}

function AppointmentView({
  appointment: a,
  onClose,
  onRun,
}: {
  appointment: Appointment
  onClose: () => void
  onRun: (action: () => Promise<ActionResult>, ok?: string) => void
}) {
  const past = a.status === 'done' || a.status === 'cancelled' || new Date(a.startsAt) < new Date()
  return (
    <Overlay open narrow onClose={onClose} eyebrow={past ? 'Past visit' : 'Appointment'}>
      <Head title={a.what} sub={[a.provider, a.location].filter(Boolean).join(' · ')} />
      <Rows
        rows={[
          ['When', longWhen(a.startsAt)],
          ['Where', a.location || a.providerAddress || ''],
          ['Provider', a.provider ? `${a.provider}${a.providerRole ? ` · ${a.providerRole}` : ''}` : ''],
          ['Prep', a.prep],
          ['Status', a.status.charAt(0).toUpperCase() + a.status.slice(1)],
          ['Cost estimate', a.costCents === null ? '' : `$${(a.costCents / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}`],
        ]}
      />
      {a.notes && (
        <div className="mt-5">
          <span className="num text-[10px] tracking-[0.12em] text-ink-3">NOTES</span>
          <p className="mt-2.5 text-[13px] leading-[1.6] text-ink-2">{a.notes}</p>
        </div>
      )}
      {!past && (
        <div className="mt-[26px] flex flex-wrap gap-2.5">
          <ActionButton
            variant="accent"
            className="h-10 px-4 text-[13px]"
            onClick={() => {
              onRun(() => setAppointmentStatus(a.id, 'done'), 'Marked done')
              onClose()
            }}
          >
            Mark done
          </ActionButton>
        </div>
      )}
    </Overlay>
  )
}

function RecordView({ record: r, onClose }: { record: HealthRecord; onClose: () => void }) {
  const [opening, setOpening] = useState(false)
  return (
    <Overlay open narrow onClose={onClose} eyebrow={`Record · ${r.kind}`}>
      <Head title={r.title} sub={[recordDate(r.takenOn), r.file ?? 'NO FILE', r.summary].filter(Boolean).join(' · ')} />
      <Rows rows={[...Object.entries(r.fields), ...(r.summary ? ([['Summary', r.summary]] as [string, string][]) : [])]} />
      {r.file && (
        <div className="mt-[26px] flex flex-wrap gap-2.5">
          <button
            type="button"
            disabled={opening}
            className={ctl}
            onClick={async () => {
              setOpening(true)
              const result = await recordUrl(r.id)
              setOpening(false)
              if (result.ok) window.open(result.url, '_blank', 'noopener')
            }}
          >
            Open the file
          </button>
        </div>
      )}
    </Overlay>
  )
}

const KINDS = ['visit', 'lab', 'imaging', 'dental', 'vision', 'immunisation'] as const

function Form({
  providers,
  todayIso,
  onClose,
  onRun,
}: {
  providers: { id: string; name: string; role: string }[]
  todayIso: string
  onClose: () => void
  onRun: (action: () => Promise<ActionResult>, ok?: string) => void
}) {
  const [kind, setKind] = useState<(typeof KINDS)[number]>('visit')
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(todayIso)
  const [tried, setTried] = useState(false)
  const future = date > todayIso
  const missing = !title.trim() || !date

  return (
    <Overlay open narrow onClose={onClose} eyebrow="New entry">
      <Head title="Log a visit" sub="A date in the future lands on the appointment list; anything past goes straight to records." />
      <form
        className="mt-[22px] flex flex-col gap-[18px]"
        onSubmit={(e) => {
          e.preventDefault()
          setTried(true)
          if (missing) return
          const form = new FormData(e.currentTarget)
          form.set('kind', kind)
          onRun(() => logVisit(form), future ? 'Saved. It is on the appointment list.' : 'Saved to records.')
          onClose()
        }}
      >
        <div>
          <span className="num text-[10px] tracking-[0.12em] text-ink-3">TYPE</span>
          <div role="radiogroup" aria-label="Type" className="mt-2.5 flex flex-wrap gap-1.5">
            {KINDS.map((k) => (
              <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={pill(kind === k)}>
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
        </div>
        <label className="flex flex-col gap-2">
          <span className="num text-[10px] tracking-[0.12em] text-ink-3">TITLE</span>
          <input name="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Annual physical" className={input} />
        </label>
        <label className="flex flex-col gap-2">
          <span className="num text-[10px] tracking-[0.12em] text-ink-3">PROVIDER</span>
          <select
            name="provider"
            defaultValue={(providers.find((p) => /primary/i.test(p.role)) ?? providers[0])?.id ?? ''}
            className={input}
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.role.toLowerCase()}
              </option>
            ))}
            <option value="">Other · name it in the notes</option>
          </select>
        </label>
        <div className="flex flex-wrap gap-3">
          <label className="flex min-w-0 flex-[1_1_140px] flex-col gap-2">
            <span className="num text-[10px] tracking-[0.12em] text-ink-3">DATE</span>
            <input name="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={cn(input, 'num')} />
          </label>
          <label className="flex min-w-0 flex-[1_1_120px] flex-col gap-2">
            <span className="num text-[10px] tracking-[0.12em] text-ink-3">COST</span>
            <input name="cost" placeholder="$40 copay" className={input} />
          </label>
        </div>
        <label className="flex flex-col gap-2">
          <span className="num text-[10px] tracking-[0.12em] text-ink-3">NOTES</span>
          <textarea name="notes" placeholder="What was decided, what to follow up on" className={cn(input, 'h-auto min-h-24 resize-y px-3 py-2.5 leading-[1.5]')} />
        </label>
        <div>
          <span className="num text-[10px] tracking-[0.12em] text-ink-3">ATTACHMENT</span>
          <input
            name="file"
            type="file"
            accept="application/pdf,image/*"
            disabled={future}
            aria-label="Attachment"
            className="mt-2.5 block w-full text-[12px] text-ink-3 file:mr-3 file:h-8 file:border file:border-rule-2 file:bg-transparent file:px-3 file:text-[10px] file:tracking-[0.08em] file:text-ink-3 disabled:opacity-100"
          />
          {future && <p className="mt-1.5 text-[11px] text-ink-4">Files attach to a record, once the visit has happened.</p>}
        </div>
        <p className={cn('text-[12px] leading-[1.5]', tried && missing ? 'text-bad' : 'text-ink-3')}>
          {tried && missing
            ? 'A title and a date are required.'
            : future
              ? 'Future date: this will appear under Appointments.'
              : 'Past date: this files under Records.'}
        </p>
        <div className="mt-2 flex flex-wrap gap-2.5">
          <ActionButton type="submit" variant="accent" className="h-10 px-4 text-[13px]">
            Save entry
          </ActionButton>
          <button type="button" onClick={onClose} className={ctl}>
            Cancel
          </button>
        </div>
      </form>
    </Overlay>
  )
}
