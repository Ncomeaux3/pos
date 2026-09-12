'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import {
  ActionButton,
  Card,
  CardHead,
  Chip,
  EmptyState,
  Eyebrow,
  Row,
  RowList,
  StatusChip,
  Switch,
  WizardShell,
  fieldClass,
  useToast,
} from '@/components/pos'
import type { Category } from '@/core/connectors'
import type { Metric } from '@/core/metrics'
import { cn } from '@/lib/utils'
import {
  finish,
  removeProvider,
  requestProvider,
  saveSetting,
  seedGoals,
  type ActionResult,
  type GoalSeed,
} from './actions'

// Six steps, and every one writes as it goes. There is no submit at the end:
// the wizard is a guided tour of settings that already exist, so leaving
// halfway through leaves a half configured app rather than nothing, and coming
// back resumes because the settings are the state.

export type SetupData = {
  ownerName: string
  timezone: string
  modules: { id: string; label: string; note: string; enabled: boolean }[]
  categories: Category[]
  supported: string[]
  requested: string[]
  metrics: Metric[]
  hasGoals: boolean
  todayIso: string
  nightlyAt: string
  schedule: {
    morningAt: string
    morningEnabled: boolean
    eveningAt: string
    eveningEnabled: boolean
    quietFrom: string
    quietTo: string
    urgentOverride: boolean
  }
  completedAt: string
}

type StepKey = 'you' | 'modules' | 'connect' | 'goals' | 'notify' | 'ready'

const STEPS: { key: StepKey; name: string; kicker: string; question: string; helper: string }[] = [
  {
    key: 'you',
    name: 'You',
    kicker: 'Step one, who this is for',
    question: 'What should it call you, and where are you?',
    helper: 'The timezone decides what "today" means everywhere, so it is worth getting right.',
  },
  {
    key: 'modules',
    name: 'Modules',
    kicker: 'Step two, what it tracks',
    question: 'Which parts do you want?',
    helper:
      'Visibility only. A module you turn off keeps its data and its tools; it just stops taking up room in the nav.',
  },
  {
    key: 'connect',
    name: 'Connections',
    kicker: 'Step three, where the data comes from',
    question: 'What should it read?',
    helper:
      'Picking one here records the intent. Anything with a real integration is authorised properly at Settings, because a wizard is no place to handle a secret.',
  },
  {
    key: 'goals',
    name: 'Goals',
    kicker: 'Step four, what you are aiming at',
    question: 'Start with two or three?',
    helper: 'A goal pointed at a module metric checks itself in every night. The rest you do by hand.',
  },
  {
    key: 'notify',
    name: 'Notifications',
    kicker: 'Step five, when it may interrupt',
    question: 'When can it reach you?',
    helper: 'Quiet hours hold everything but an urgent rule, and held is not dropped.',
  },
  {
    key: 'ready',
    name: 'First run',
    kicker: 'Step six, start it',
    question: 'Ready?',
    helper: 'Nothing here is permanent. Every answer is a setting you can change later.',
  },
]

/**
 * Categories with nothing requested that leave a real tile empty: the
 * dashboard's net worth and the runway goal both read Finance's balances.
 * Named here rather than added to config/connectors.yaml, since a plain
 * array of the ids that already exist there is the smaller, in-scope change.
 */
const NEEDED_CATEGORY_IDS = ['bank', 'broker']

/**
 * Three quiet-hours shortcuts. There is no per-rule loudness setting to
 * pick between (core.settings has only the two digest toggles and one quiet
 * window), so each preset only ever writes the quiet-hours width and the
 * urgent override, the same two fields the panel below already saves. No
 * per-day notification count is shown: nothing here counts real rules, so a
 * number would be invented.
 */
const NOTIFY_PRESETS = [
  {
    id: 'quiet',
    tag: 'LIGHTEST',
    name: 'Digest only',
    note: 'Everything batches into the morning and evening digest. Nothing interrupts.',
    quietFrom: '00:00',
    quietTo: '23:59',
    override: false,
  },
  {
    id: 'balanced',
    tag: 'RECOMMENDED',
    name: 'Money and deadlines',
    note: 'Quiet hours hold the rest; an urgent rule still breaks through.',
    quietFrom: '22:00',
    quietTo: '06:30',
    override: true,
  },
  {
    id: 'all',
    tag: 'LOUDEST',
    name: 'Tell me everything',
    note: 'No quiet hours at all. Useful for the first week, then trim it.',
    quietFrom: '00:00',
    quietTo: '00:00',
    override: true,
  },
] as const

/**
 * Goals a fresh install can start from.
 *
 * Each one names a metric it would like. Whether that metric exists is decided
 * at render against the registry, so a fork without Finance is offered the two
 * that do not need it rather than three that would never compute.
 */
const STARTER_GOALS: (GoalSeed & { wants: string | null; blurb: string })[] = [
  {
    title: 'Six months of runway',
    area: 'Life ops',
    kind: 'number',
    unit: '$',
    target_value: 30_000,
    deadline: '',
    metric_source: null,
    wants: 'finance.liquid',
    blurb: 'Cash on hand, from the accounts you connect.',
  },
  {
    title: 'Clear the week every week',
    area: 'Engineering',
    kind: 'streak',
    unit: '/wk',
    target_value: 10,
    deadline: '',
    metric_source: null,
    wants: 'tasks.completed_this_week',
    blurb: 'Tasks finished per week, counted for you.',
  },
  {
    title: 'Read twelve books this year',
    area: 'Communication',
    kind: 'count',
    unit: 'books',
    target_value: 12,
    deadline: '',
    metric_source: null,
    wants: null,
    blurb: 'Checked in by hand, one line per finish.',
  },
]

export function Onboarding({ data }: { data: SetupData }) {
  const router = useRouter()
  const params = useSearchParams()
  const step = (STEPS.find((s) => s.key === params.get('step'))?.key ?? 'you') as StepKey

  const setStep = (next: StepKey) => {
    const search = new URLSearchParams(params.toString())
    if (next === 'you') search.delete('step')
    else search.set('step', next)
    const query = search.toString()
    router.replace(query ? `?${query}` : '?', { scroll: false })
  }

  const [enabled, setEnabled] = useState(
    data.modules.filter((m) => m.enabled).map((m) => m.id),
  )
  const [picked, setPicked] = useState<string[]>([])
  const [goalCfg, setGoalCfg] = useState<Record<string, { target?: string; deadline?: string }>>(
    {},
  )
  const [openCategory, setOpenCategory] = useState<string | null>(null)
  const [connectSearch, setConnectSearch] = useState('')
  const [manualOpen, setManualOpen] = useState(false)
  const [manualValue, setManualValue] = useState('')
  const [done, setDone] = useState(data.completedAt !== '')
  const [pending, start] = useTransition()
  const toast = useToast()

  const supported = new Set(data.supported)
  const requested = new Set(data.requested)
  const metricIds = new Set(data.metrics.map((m) => m.id))

  const run = (action: () => Promise<ActionResult>, ok?: string) =>
    start(async () => {
      const result = await action()
      if (!result.ok) toast(result.error)
      else if (ok) toast(ok)
    })

  const index = STEPS.findIndex((s) => s.key === step)
  const stage = STEPS[index]

  const toggleModule = (id: string) => {
    const next = enabled.includes(id) ? enabled.filter((m) => m !== id) : [...enabled, id]
    setEnabled(next)
    run(() => saveSetting('modules_enabled', next))
  }

  // A year out, so a starter goal has room to be wrong about its date without
  // being overdue on the day it is created. The default the TARGET and BY
  // WHEN inputs show, and what a goal falls back to if left blank or typed
  // as something that does not parse.
  const [defaultYear, defaultMonth, defaultDay] = data.todayIso.split('-').map(Number)
  const defaultDeadline = `${defaultYear + 1}-${String(defaultMonth).padStart(2, '0')}-${String(defaultDay).padStart(2, '0')}`

  const finishUp = () =>
    start(async () => {
      if (picked.length > 0 && data.hasGoals) {
        const goals = STARTER_GOALS.filter((g) => picked.includes(g.title)).map((g) => {
          const typedTarget = Number((goalCfg[g.title]?.target ?? '').replace(/[^0-9.-]/g, ''))
          return {
            title: g.title,
            area: g.area,
            kind: g.kind,
            unit: g.unit,
            target_value: Number.isFinite(typedTarget) && typedTarget > 0 ? typedTarget : g.target_value,
            deadline: goalCfg[g.title]?.deadline || defaultDeadline,
            // Only when something really provides it. A goal pointed at a metric
            // that does not exist would sit at zero forever looking broken.
            metric_source: g.wants && metricIds.has(g.wants) ? g.wants : null,
          }
        })
        const seeded = await seedGoals(goals)
        if (!seeded.ok) toast(seeded.error)
      }

      const result = await finish()
      if (!result.ok) {
        toast(result.error)
        return
      }
      setDone(true)
    })

  if (done) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 p-7">
        <Eyebrow dot="ok">First run complete</Eyebrow>
        <EmptyState headline="You are set up">
          Every answer you gave is a setting, and every one of them is editable. The nightly job
          takes it from here.
        </EmptyState>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/"
            className="label rounded-md border border-brand bg-brand-soft px-3 py-2 text-[10px] tracking-[0.1em] text-ink"
          >
            Go to the dashboard
          </Link>
          <Link
            href="/settings/connections"
            className="label rounded-md border border-rule-2 px-3 py-2 text-[10px] tracking-[0.1em] text-ink-2 hover:border-ink hover:text-ink"
          >
            Connect a provider
          </Link>
        </div>
      </div>
    )
  }

  return (
    <WizardShell
      railTitle="First run"
      railLede="Six steps. Everything saves as you go, so you can stop anywhere."
      steps={STEPS.map((s) => ({ key: s.key, name: s.name }))}
      current={step}
      onStep={(key) => setStep(key as StepKey)}
      kicker={stage.kicker}
      title={stage.question}
      helper={stage.helper}
      onBack={index > 0 ? () => setStep(STEPS[index - 1].key) : undefined}
      onSkip={index < STEPS.length - 1 ? () => setStep(STEPS[index + 1].key) : undefined}
      onNext={index === STEPS.length - 1 ? finishUp : () => setStep(STEPS[index + 1].key)}
      nextLabel={index === STEPS.length - 1 ? 'Finish' : 'Continue'}
      footnote={pending ? 'Saving.' : undefined}
    >
      {step === 'you' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <Eyebrow>What to call you</Eyebrow>
            <input
              defaultValue={data.ownerName}
              aria-label="Your name"
              placeholder="Nick"
              onBlur={(e) => run(() => saveSetting('owner_name', e.target.value))}
              className={cn(fieldClass, 'w-full')}
            />
          </label>
          <label className="block space-y-1.5">
            <Eyebrow>Timezone</Eyebrow>
            <input
              defaultValue={data.timezone}
              aria-label="Timezone"
              placeholder="America/Chicago"
              onBlur={(e) => run(() => saveSetting('timezone', e.target.value))}
              className={cn(fieldClass, 'w-full')}
            />
            <p className="t-caption text-ink-3">
              An IANA name. Every date in the app is computed from it, so a task due today is due
              today where you are.
            </p>
          </label>
        </div>
      )}

      {step === 'modules' && (
        <div className="space-y-4">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,230px),1fr))] gap-2.5">
            {data.modules.map((m, i) => {
              const on = enabled.includes(m.id)
              return (
                <Card key={m.id} selected={on} className="p-0">
                  <button
                    type="button"
                    onClick={() => toggleModule(m.id)}
                    className="w-full p-4 text-left"
                  >
                    <span className="flex items-baseline justify-between gap-2.5">
                      <span
                        className={cn(
                          'label text-[9px] tracking-[0.12em]',
                          on ? 'text-brand' : 'text-ink-3',
                        )}
                      >
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span
                        className={cn(
                          'label text-[9px] tracking-[0.1em]',
                          on ? 'text-brand' : 'text-ink-3',
                        )}
                      >
                        {on ? 'ON' : 'OFF'}
                      </span>
                    </span>
                    <span className="mt-2.5 block text-[15px] text-ink">{m.label}</span>
                    <span className="mt-1 block text-[11px] leading-[1.45] text-ink-3">
                      {m.note}
                    </span>
                  </button>
                </Card>
              )
            })}
          </div>
          <p className="t-caption text-ink-3">
            {enabled.length} of {data.modules.length} on. {data.categories.length} connector
            categories unlock on the next step; the rest stay visible but greyed.
          </p>
        </div>
      )}

      {step === 'connect' && (() => {
        const connectQuery = connectSearch.trim().toLowerCase()
        const searchResults = connectQuery
          ? data.categories
              .flatMap((category) =>
                category.providers
                  .filter((p) => p.toLowerCase().includes(connectQuery))
                  .map((provider) => ({ provider, category })),
              )
              .slice(0, 12)
          : []

        const neededMissing = data.categories.filter(
          (c) =>
            NEEDED_CATEGORY_IDS.includes(c.id) && !c.providers.some((p) => requested.has(p)),
        )

        const requestedList = data.requested.map((name) => ({
          name,
          categoryLabel: data.categories.find((c) => c.providers.includes(name))?.name ?? 'Other',
        }))

        const providerButton = (provider: string, categoryId: string) => {
          const on = requested.has(provider)
          return (
            <ActionButton
              key={provider}
              variant={on ? 'brand' : 'outline'}
              onClick={() =>
                run(
                  () => (on ? removeProvider(provider) : requestProvider(provider, categoryId)),
                  on ? undefined : `${provider} noted`,
                )
              }
            >
              {provider}
              {supported.has(provider) ? ' *' : ''}
            </ActionButton>
          )
        }

        return (
          <div className="space-y-3">
            <input
              value={connectSearch}
              onChange={(e) => setConnectSearch(e.target.value)}
              aria-label="Search every connector"
              placeholder="Search every connector, Chase, Amex, Delta, Whoop..."
              className={cn(fieldClass, 'w-full')}
            />

            {connectQuery && (
              <Card className="space-y-2">
                <Eyebrow>Matches · {searchResults.length}</Eyebrow>
                {searchResults.length === 0 ? (
                  <p className="t-caption text-ink-3">
                    Nothing matches. Open the closest category below and add it manually.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {searchResults.map(({ provider, category }) =>
                      providerButton(provider, category.id),
                    )}
                  </div>
                )}
              </Card>
            )}

            {requestedList.length > 0 && (
              <Card className="space-y-2 border-brand bg-brand-soft">
                <Eyebrow>Requested · {requestedList.length}</Eyebrow>
                <div className="flex flex-wrap gap-1.5">
                  {requestedList.map(({ name }) => (
                    <ActionButton
                      key={name}
                      variant="brand"
                      onClick={() => run(() => removeProvider(name))}
                    >
                      {name}
                    </ActionButton>
                  ))}
                </div>
              </Card>
            )}

            {data.categories.length === 0 ? (
              <EmptyState headline="Nothing to connect">
                None of the modules you kept read from an outside provider. You can still enter
                everything by hand.
              </EmptyState>
            ) : (
              data.categories.map((category) => {
                const needed =
                  NEEDED_CATEGORY_IDS.includes(category.id) &&
                  !category.providers.some((p) => requested.has(p))
                const open = openCategory === category.id
                return (
                  <Card key={category.id} className="space-y-3">
                    <button
                      type="button"
                      onClick={() => {
                        setOpenCategory(open ? null : category.id)
                        setManualOpen(false)
                      }}
                      className="w-full text-left"
                    >
                      <CardHead
                        label={
                          <>
                            {category.name}
                            {needed && (
                              <span className="label ml-2 border border-amber px-1.5 py-0.5 text-[9px] tracking-[0.1em] text-amber">
                                Needed
                              </span>
                            )}
                          </>
                        }
                        meta={open ? 'Hide' : `${category.providers.length}`}
                      />
                      <p className="t-caption mt-1 text-ink-3">Gives you {category.data}.</p>
                    </button>

                    {open && (
                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-1.5">
                          {category.providers.map((provider) => providerButton(provider, category.id))}
                        </div>

                        {manualOpen ? (
                          <div className="flex flex-wrap gap-2">
                            <input
                              value={manualValue}
                              onChange={(e) => setManualValue(e.target.value)}
                              aria-label="Name of the institution"
                              placeholder="Name of the institution"
                              className={cn(fieldClass, 'flex-1')}
                            />
                            <ActionButton
                              variant="solid"
                              onClick={() => {
                                const name = manualValue.trim()
                                if (!name) return
                                run(() => requestProvider(name, category.id), `${name} noted`)
                                setManualValue('')
                                setManualOpen(false)
                              }}
                            >
                              Add
                            </ActionButton>
                          </div>
                        ) : (
                          <ActionButton variant="outline" onClick={() => setManualOpen(true)}>
                            Add manually
                          </ActionButton>
                        )}
                      </div>
                    )}
                  </Card>
                )
              })
            )}

            {neededMissing.length > 0 && (
              <p className="t-caption text-ink-3">
                {neededMissing.map((c) => c.name).join(' and ')} carry the numbers behind Finance
                and Goals. Without at least one in each, those tiles open empty.
              </p>
            )}

            <p className="t-caption text-ink-3">
              A star means a real integration exists and can sync it once you authorise it at
              Settings. Everything else is recorded as a request, so it is written down and nothing
              pretends to be connected.
            </p>
          </div>
        )
      })()}

      {step === 'goals' && (
        <div className="space-y-3">
          {!data.hasGoals ? (
            <EmptyState headline="No goals module">
              Goals is not installed, so there is nothing to seed. Skip this one.
            </EmptyState>
          ) : (
            <RowList>
              {STARTER_GOALS.map((g) => {
                const computable = g.wants !== null && metricIds.has(g.wants)
                const on = picked.includes(g.title)
                const setCfg = (key: 'target' | 'deadline', value: string) =>
                  setGoalCfg((prev) => ({ ...prev, [g.title]: { ...prev[g.title], [key]: value } }))
                return (
                  <Row
                    key={g.title}
                    title={g.title}
                    meta={g.blurb}
                    selected={on}
                    right={
                      <>
                        {g.wants && (
                          <Chip tone={computable ? 'brand' : 'quiet'}>
                            {computable ? 'computed' : 'by hand'}
                          </Chip>
                        )}
                        <ActionButton
                          variant={on ? 'brand' : 'outline'}
                          onClick={() =>
                            setPicked(on ? picked.filter((t) => t !== g.title) : [...picked, g.title])
                          }
                        >
                          {on ? 'Picked' : 'Add'}
                        </ActionButton>
                      </>
                    }
                  >
                    {on && (
                      <div className="mt-3.5 flex flex-wrap gap-3.5 border-t border-rule pt-3.5">
                        <label className="flex min-w-[130px] flex-1 flex-col gap-1.5">
                          <Eyebrow>Target ({g.unit})</Eyebrow>
                          <input
                            aria-label={`${g.title} target`}
                            defaultValue={String(g.target_value)}
                            onChange={(e) => setCfg('target', e.target.value)}
                            className={cn(fieldClass, 'w-full')}
                          />
                        </label>
                        <label className="flex min-w-[150px] flex-1 flex-col gap-1.5">
                          <Eyebrow>By when</Eyebrow>
                          <input
                            type="date"
                            aria-label={`${g.title} deadline`}
                            defaultValue={goalCfg[g.title]?.deadline ?? defaultDeadline}
                            onChange={(e) => setCfg('deadline', e.target.value)}
                            className={cn(fieldClass, 'w-full')}
                          />
                        </label>
                      </div>
                    )}
                  </Row>
                )
              })}
            </RowList>
          )}
          <p className="t-caption text-ink-3">
            These are written when you finish, not now, so changing your mind costs nothing. A goal
            whose metric is not installed is created for hand check-ins rather than pointed at
            something that would never compute.
          </p>
        </div>
      )}

      {step === 'notify' && (
        <div className="space-y-5">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,210px),1fr))] gap-3.5">
            {NOTIFY_PRESETS.map((p) => (
              <Card key={p.id} className="p-0">
                <button
                  type="button"
                  onClick={() =>
                    run(async () => {
                      const results = await Promise.all([
                        saveSetting('quiet_from', p.quietFrom),
                        saveSetting('quiet_to', p.quietTo),
                        saveSetting('quiet_urgent_override', p.override),
                      ])
                      return results.find((r) => !r.ok) ?? { ok: true }
                    })
                  }
                  className="w-full p-4 text-left"
                >
                  <Eyebrow>{p.tag}</Eyebrow>
                  <span className="mt-3 block text-[16px] tracking-[-0.01em] text-ink">
                    {p.name}
                  </span>
                  <span className="mt-2 block text-[12px] leading-[1.5] text-ink-3">{p.note}</span>
                </button>
              </Card>
            ))}
          </div>

          <div className="grid gap-5 sm:grid-cols-[repeat(auto-fit,minmax(min(100%,210px),1fr))]">
          <div className="space-y-2">
            <Eyebrow>Morning digest</Eyebrow>
            <div className="flex items-center gap-2.5">
              <input
                type="time"
                aria-label="Morning digest time"
                defaultValue={data.schedule.morningAt}
                onBlur={(e) => run(() => saveSetting('digest_morning_at', e.target.value))}
                className={cn(fieldClass, 'w-32')}
              />
              <Switch
                label="Morning digest on"
                checked={data.schedule.morningEnabled}
                onChange={(next) => run(() => saveSetting('digest_morning_enabled', next))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Eyebrow>Evening digest</Eyebrow>
            <div className="flex items-center gap-2.5">
              <input
                type="time"
                aria-label="Evening digest time"
                defaultValue={data.schedule.eveningAt}
                onBlur={(e) => run(() => saveSetting('digest_evening_at', e.target.value))}
                className={cn(fieldClass, 'w-32')}
              />
              <Switch
                label="Evening digest on"
                checked={data.schedule.eveningEnabled}
                onChange={(next) => run(() => saveSetting('digest_evening_enabled', next))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Eyebrow>Quiet hours</Eyebrow>
            <div className="flex flex-wrap items-center gap-2">
              <input
                key={data.schedule.quietFrom}
                type="time"
                aria-label="Quiet hours start"
                defaultValue={data.schedule.quietFrom}
                onBlur={(e) => run(() => saveSetting('quiet_from', e.target.value))}
                className={cn(fieldClass, 'w-28')}
              />
              <span className="t-caption text-ink-3">to</span>
              <input
                key={data.schedule.quietTo}
                type="time"
                aria-label="Quiet hours end"
                defaultValue={data.schedule.quietTo}
                onBlur={(e) => run(() => saveSetting('quiet_to', e.target.value))}
                className={cn(fieldClass, 'w-28')}
              />
            </div>
            <ActionButton
              variant={data.schedule.urgentOverride ? 'brand' : 'outline'}
              onClick={() =>
                run(() => saveSetting('quiet_urgent_override', !data.schedule.urgentOverride))
              }
            >
              {data.schedule.urgentOverride ? 'Urgent breaks through' : 'Nothing breaks through'}
            </ActionButton>
          </div>
          </div>
        </div>
      )}

      {step === 'ready' && (
        <div className="space-y-4">
          <RowList>
            {(
              [
                { title: 'Called', meta: 'What the app calls you', value: data.ownerName || 'not set', jump: 'you' },
                { title: 'Timezone', meta: 'Decides what today means', value: data.timezone, jump: 'you' },
                {
                  title: 'Modules',
                  meta: 'Visible in the nav',
                  value: `${enabled.length} of ${data.modules.length}`,
                  jump: 'modules',
                },
                {
                  title: 'Connections',
                  meta: 'Recorded as requests until authorised',
                  value: String(data.requested.length),
                  jump: 'connect',
                },
                {
                  title: 'Goals',
                  meta: 'Written when you finish',
                  value: String(picked.length),
                  jump: 'goals',
                },
              ] as const
            ).map((row) => (
              <Row
                key={row.title}
                title={row.title}
                meta={row.meta}
                right={
                  <>
                    <span className="t-caption text-ink-2">{row.value}</span>
                    <ActionButton variant="quiet" onClick={() => setStep(row.jump)}>
                      Change
                    </ActionButton>
                  </>
                }
              />
            ))}
          </RowList>

          <div className="space-y-2 rounded-md border border-rule-2 p-3.5">
            <StatusChip tone="brand">What happens next</StatusChip>
            <p className="t-caption text-ink-3">
              Finishing writes the goals you picked and marks first run done. Tonight at{' '}
              {data.nightlyAt}, the nightly job writes each module a digest and sends one email.
              A requested connection does not sync until you authorise it at Settings. Nothing
              here is permanent.
            </p>
          </div>
        </div>
      )}
    </WizardShell>
  )
}
