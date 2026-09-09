'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import {
  ActionButton,
  Card,
  CardHead,
  Chip,
  EmptyState,
  Eyebrow,
  MetricTile,
  Overlay,
  PaceBar,
  Row,
  RowList,
  StatusChip,
  TabBar,
  fieldClass,
  useToast,
} from '@/components/pos'
import { cn } from '@/lib/utils'
import {
  balance,
  compactMoney,
  money,
  percent,
  signedMoney,
  transactionAmount,
} from '../money'
import { recategorise, saveBudget, setSubscriptionStatus, type ActionResult } from './actions'

// Five tabs over one dataset, plus two drawer kinds. The tab and the open
// drawer live in the URL, so both survive a refresh and a shared link opens
// what it says it opens.

export type FinanceData = {
  todayIso: string
  monthPace: number
  netWorthCents: number
  changeCents: number
  assetsCents: number
  debtCents: number
  series: number[]
  seriesDates: string[]
  accounts: {
    id: string
    name: string
    institution: string
    kind: string
    balanceCents: number
    changeCents: number | null
    sharePercent: number
    txCount: number
    mask: string
  }[]
  budgets: {
    id: string
    name: string
    description: string
    isFixed: boolean
    spentCents: number
    limitCents: number | null
    txCount: number
  }[]
  upcoming: {
    id: string
    name: string
    vendor: string
    amountCents: number
    nextChargeOn: string
    cadence: string
  }[]
  transactions: {
    id: string
    descriptor: string
    amountCents: number
    occurredOn: string
    accountName: string
    categoryName: string | null
    classifiedBy: string | null
    confidence: number | null
    isManual: boolean
  }[]
}

type Tab = 'overview' | 'accounts' | 'budgets' | 'subscriptions' | 'transactions'

const TABS: { value: Tab; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'accounts', label: 'Accounts' },
  { value: 'budgets', label: 'Budgets' },
  { value: 'subscriptions', label: 'Subscriptions' },
  { value: 'transactions', label: 'Transactions' },
]

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const shortDate = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`)
  return `${MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')}`
}

/** Past this share of a limit, a budget is worth flagging. SPEC's number. */
const ALERT = 80

export function Finance({ data }: { data: FinanceData }) {
  const router = useRouter()
  const params = useSearchParams()
  const tab = (TABS.find((t) => t.value === params.get('tab'))?.value ?? 'overview') as Tab

  const setParams = (next: Record<string, string | null>) => {
    const search = new URLSearchParams(params.toString())
    for (const [key, value] of Object.entries(next)) {
      if (value === null) search.delete(key)
      else search.set(key, value)
    }
    const query = search.toString()
    router.replace(query ? `?${query}` : '?', { scroll: false })
  }

  const openAccount = data.accounts.find((a) => a.id === params.get('account')) ?? null
  const openBudget = data.budgets.find((b) => b.id === params.get('budget')) ?? null

  const [, start] = useTransition()
  const toast = useToast()

  const run = (action: () => Promise<ActionResult>, ok?: string) =>
    start(async () => {
      const result = await action()
      if (!result.ok) toast(result.error)
      else if (ok) toast(ok)
    })

  const upcomingTotal = data.upcoming.reduce((sum, u) => sum + u.amountCents, 0)
  const hot = data.budgets.filter(
    (b) => !b.isFixed && b.limitCents && percent(b.spentCents, b.limitCents) >= ALERT,
  )

  return (
    <div className="space-y-5">
      <TabBar
        label="Finance views"
        value={tab}
        onChange={(next) => setParams({ tab: next === 'overview' ? null : next })}
        tabs={TABS.map((t) => ({
          value: t.value,
          label: t.label,
          count:
            t.value === 'accounts'
              ? data.accounts.length
              : t.value === 'subscriptions'
                ? data.upcoming.length
                : undefined,
        }))}
      />

      {tab === 'overview' && (
        <div className="space-y-5">
          <div className="grid gap-2.5 sm:grid-cols-[repeat(auto-fit,minmax(min(100%,170px),1fr))]">
            <MetricTile
              label="Net worth"
              value={balance(data.netWorthCents)}
              delta={`${signedMoney(data.changeCents)} in 30 days`}
              deltaTone={data.changeCents >= 0 ? 'ok' : 'bad'}
            />
            <MetricTile label="Assets" value={money(data.assetsCents)} />
            <MetricTile
              label="Debt"
              value={money(data.debtCents)}
              delta={data.debtCents > 0 ? 'owed' : 'none'}
              deltaTone={data.debtCents > 0 ? 'warn' : 'quiet'}
            />
            <MetricTile
              label="Due in 14 days"
              value={money(upcomingTotal, true)}
              delta={`${data.upcoming.length} charges`}
            />
          </div>

          <Card className="space-y-3">
            <CardHead
              label="Net worth"
              meta={`${data.series.length} daily snapshots`}
            />
            {data.series.length < 2 ? (
              <EmptyState headline="No history yet" className="border-0">
                The chart is built from one balance snapshot per account per night. It fills in as
                the nightly job runs; a balance not recorded on the day is gone.
              </EmptyState>
            ) : (
              <NetWorthChart values={data.series} dates={data.seriesDates} />
            )}
          </Card>

          <div className="grid gap-2.5 lg:grid-cols-2">
            <Card className="space-y-3">
              <CardHead label="Upcoming" meta="Next 14 days" />
              {data.upcoming.length === 0 ? (
                <EmptyState headline="Nothing booked" className="border-0">
                  No active subscription is due in the next fortnight.
                </EmptyState>
              ) : (
                <RowList>
                  {data.upcoming.map((u) => (
                    <Row
                      key={u.id}
                      title={u.name}
                      meta={`${u.vendor || u.cadence} / ${shortDate(u.nextChargeOn)}`}
                      right={<span className="num text-[13px] text-ink">{money(u.amountCents, true)}</span>}
                    />
                  ))}
                </RowList>
              )}
            </Card>

            <Card className="space-y-3">
              <CardHead label="Budgets over 80 percent" meta={`${hot.length} of ${data.budgets.length}`} />
              {hot.length === 0 ? (
                <EmptyState headline="All within limits" className="border-0">
                  Nothing has passed {ALERT} percent of its limit this month.
                </EmptyState>
              ) : (
                <div className="space-y-3.5">
                  {hot.map((b) => (
                    <div key={b.id} className="space-y-1.5">
                      {/* A bar with no name is a decoration. The whole point of
                          this card is which category is running hot. */}
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="t-caption text-ink">{b.name}</span>
                        <span className="num text-[11px] text-ink-3">
                          {money(b.spentCents)} of {money(b.limitCents!)}
                        </span>
                      </div>
                      <BudgetBar budget={b} pace={data.monthPace} />
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {tab === 'accounts' && (
        <RowList>
          {data.accounts.map((a) => (
            <Row
              key={a.id}
              title={a.name}
              meta={`${a.institution}${a.mask ? ` ${a.mask}` : ''} / ${a.txCount} transactions`}
              onClick={() => setParams({ account: a.id })}
              right={
                <>
                  <span className="num text-[14px] text-ink">{balance(a.balanceCents)}</span>
                  <span
                    className={cn(
                      'label text-[10px]',
                      a.changeCents === null
                        ? 'text-ink-3'
                        : a.changeCents > 0
                          ? 'text-ok'
                          : a.changeCents < 0
                            ? 'text-bad'
                            : 'text-ink-3',
                    )}
                  >
                    {/* Not tracked is not the same as no change, and must not
                        render as one. */}
                    {a.changeCents === null ? 'new' : signedMoney(a.changeCents)}
                  </span>
                </>
              }
            >
              {a.balanceCents > 0 && (
                <div className="flex items-center gap-2.5">
                  <PaceBar value={a.sharePercent} max={100} className="flex-1" />
                  <span className="label w-9 shrink-0 text-right text-[10px] text-ink-3">
                    {Math.round(a.sharePercent)}%
                  </span>
                </div>
              )}
            </Row>
          ))}
        </RowList>
      )}

      {tab === 'budgets' && (
        <div className="space-y-3">
          <p className="t-caption text-ink-3">
            The tick on each bar is where you would be if you spent evenly through the month. A
            limit you set here applies to this month only, so raising one in March does not rewrite
            what February was measured against.
          </p>
          {data.budgets.map((b) => (
            <Card key={b.id} className="space-y-2.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <button
                  type="button"
                  onClick={() => setParams({ budget: b.id })}
                  className="t-body text-left text-ink"
                >
                  {b.name}
                </button>
                <div className="flex items-center gap-2">
                  {b.isFixed && <Chip tone="quiet">Fixed</Chip>}
                  <span className="num text-[12px] text-ink-3">
                    {money(b.spentCents)}
                    {b.limitCents ? ` of ${money(b.limitCents)}` : ' spent, no limit'}
                  </span>
                </div>
              </div>
              <BudgetBar budget={b} pace={data.monthPace} />
              <p className="t-caption text-ink-3">{b.description}</p>
            </Card>
          ))}
        </div>
      )}

      {tab === 'subscriptions' && (
        <div className="space-y-3">
          {data.upcoming.length === 0 ? (
            <EmptyState headline="Nothing detected">
              A subscription is three charges from the same merchant, within ten percent of each
              other, on a regular cadence. The nightly job promotes what it finds; two charges is a
              coincidence, not a subscription.
            </EmptyState>
          ) : (
            <RowList>
              {data.upcoming.map((u) => (
                <Row
                  key={u.id}
                  title={u.name}
                  meta={`${u.vendor || 'No vendor'} / ${u.cadence} / next ${shortDate(u.nextChargeOn)}`}
                  right={
                    <>
                      <span className="num text-[13px] text-ink">{money(u.amountCents, true)}</span>
                      <ActionButton
                        onClick={() =>
                          run(() => setSubscriptionStatus(u.id, 'cancelled'), `Cancelled ${u.name}`)
                        }
                      >
                        Cancel
                      </ActionButton>
                    </>
                  }
                />
              ))}
            </RowList>
          )}
        </div>
      )}

      {tab === 'transactions' && (
        <TransactionList
          transactions={data.transactions}
          categories={data.budgets.map((b) => ({ id: b.id, name: b.name }))}
          onRecategorise={(id, categoryId) =>
            run(() => recategorise(id, categoryId), 'Filed, and the rule learned it')
          }
        />
      )}

      {openAccount && (
        <Overlay
          open
          onClose={() => setParams({ account: null })}
          eyebrow={`Accounts / ${openAccount.institution}`}
          title={openAccount.name}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2.5">
              <MetricTile label="Balance" value={balance(openAccount.balanceCents)} />
              <MetricTile
                label="30 day change"
                value={openAccount.changeCents === null ? 'new' : signedMoney(openAccount.changeCents)}
              />
            </div>
            <TransactionList
              transactions={data.transactions.filter((t) => t.accountName === openAccount.name)}
              categories={data.budgets.map((b) => ({ id: b.id, name: b.name }))}
              onRecategorise={(id, categoryId) =>
                run(() => recategorise(id, categoryId), 'Filed, and the rule learned it')
              }
            />
          </div>
        </Overlay>
      )}

      {openBudget && (
        <Overlay
          open
          onClose={() => setParams({ budget: null })}
          eyebrow="Budgets"
          title={openBudget.name}
        >
          <div className="space-y-4">
            <p className="t-caption text-ink-3">{openBudget.description}</p>
            <BudgetBar budget={openBudget} pace={data.monthPace} />

            <label className="block space-y-1.5">
              <Eyebrow>Limit for this month, dollars</Eyebrow>
              <div className="flex flex-wrap gap-2">
                <input
                  type="number"
                  min={1}
                  step="1"
                  defaultValue={openBudget.limitCents ? openBudget.limitCents / 100 : ''}
                  aria-label={`Monthly limit for ${openBudget.name}`}
                  onBlur={(e) =>
                    e.target.value !== '' &&
                    run(() => saveBudget(openBudget.id, Number(e.target.value)), 'Limit saved')
                  }
                  className={cn(fieldClass, 'min-w-0 flex-1 basis-[140px]')}
                />
              </div>
              <p className="t-caption text-ink-3">
                Applies to this month. A job never overwrites it.
              </p>
            </label>

            <TransactionList
              transactions={data.transactions.filter((t) => t.categoryName === openBudget.name)}
              categories={data.budgets.map((b) => ({ id: b.id, name: b.name }))}
              onRecategorise={(id, categoryId) =>
                run(() => recategorise(id, categoryId), 'Filed, and the rule learned it')
              }
            />
          </div>
        </Overlay>
      )}
    </div>
  )
}

function BudgetBar({
  budget,
  pace,
}: {
  budget: FinanceData['budgets'][number]
  pace: number
}) {
  if (!budget.limitCents) {
    return (
      <p className="t-caption text-ink-3">
        No limit set. {money(budget.spentCents)} spent this month.
      </p>
    )
  }

  const pct = percent(budget.spentCents, budget.limitCents)
  // A fixed cost at its limit is not over budget, it is rent. Flagging it every
  // month would train the reader to ignore the flag.
  const over = !budget.isFixed && pct >= ALERT

  return (
    <div className="space-y-1.5">
      <PaceBar
        value={pct}
        max={100}
        pace={pace}
        tone={budget.isFixed ? 'brand' : pct > 100 ? 'bad' : over ? 'warn' : 'brand'}
      />
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className={cn('label text-[10px]', over ? 'text-warn' : 'text-ink-3')}>
          {pct}% used
        </span>
        <span className="label text-[10px] text-ink-3">
          {budget.limitCents - budget.spentCents >= 0
            ? `${money(budget.limitCents - budget.spentCents)} left`
            : `${money(budget.spentCents - budget.limitCents)} over`}
        </span>
      </div>
    </div>
  )
}

/** The 31 point line. Hand rolled SVG: no chart library anywhere in this app. */
function NetWorthChart({ values, dates }: { values: number[]; dates: string[] }) {
  const width = 100
  const height = 32
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1

  const x = (i: number) => (i / Math.max(1, values.length - 1)) * width
  const y = (v: number) => height - ((v - min) / span) * (height - 2) - 1

  const line = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(' ')
  const area = `${line} L${width},${height} L0,${height} Z`

  return (
    <div className="space-y-1.5">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Net worth over ${values.length} days, from ${compactMoney(values[0])} to ${compactMoney(values[values.length - 1])}`}
        className="h-28 w-full"
      >
        <path d={area} fill="var(--accent-soft)" />
        <path
          d={line}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={0.6}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="flex justify-between">
        <span className="label text-[10px] text-ink-3">{shortDate(dates[0])}</span>
        <span className="label text-[10px] text-ink-3">{compactMoney(min)} to {compactMoney(max)}</span>
        <span className="label text-[10px] text-ink-3">{shortDate(dates[dates.length - 1])}</span>
      </div>
    </div>
  )
}

function TransactionList({
  transactions,
  categories,
  onRecategorise,
}: {
  transactions: FinanceData['transactions']
  categories: { id: string; name: string }[]
  onRecategorise: (id: string, categoryId: string) => void
}) {
  const [editing, setEditing] = useState<string | null>(null)

  if (transactions.length === 0) {
    return (
      <EmptyState headline="No transactions">
        Nothing here yet. Connect an account at Settings, Connections, and the nightly sync fills
        this in.
      </EmptyState>
    )
  }

  return (
    <RowList>
      {transactions.map((t) => {
        const amount = transactionAmount(t.amountCents)
        return (
          <Row
            key={t.id}
            title={t.descriptor}
            meta={`${shortDate(t.occurredOn)} / ${t.accountName}`}
            right={
              <>
                {/* Every row says which arm decided it, which is the system's
                    rules-first promise made visible rather than asserted. */}
                {t.categoryName ? (
                  <Chip tone={t.isManual ? 'brand' : 'quiet'}>
                    {t.categoryName}
                    {t.classifiedBy === 'model' && t.confidence !== null
                      ? ` ${Math.round(t.confidence * 100)}%`
                      : ''}
                  </Chip>
                ) : (
                  <StatusChip tone="warn">Uncategorised</StatusChip>
                )}
                <span className={cn('num text-[13px]', amount.incoming ? 'text-ok' : 'text-ink')}>
                  {amount.text}
                </span>
                <ActionButton onClick={() => setEditing(editing === t.id ? null : t.id)}>
                  {editing === t.id ? 'Close' : 'File'}
                </ActionButton>
              </>
            }
          >
            {editing === t.id && (
              <div className="flex flex-wrap gap-1.5">
                {categories.map((c) => (
                  <ActionButton
                    key={c.id}
                    variant={t.categoryName === c.name ? 'brand' : 'outline'}
                    onClick={() => {
                      onRecategorise(t.id, c.id)
                      setEditing(null)
                    }}
                  >
                    {c.name}
                  </ActionButton>
                ))}
              </div>
            )}
          </Row>
        )
      })}
    </RowList>
  )
}
