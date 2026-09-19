'use client'

import { useState, useTransition } from 'react'
import {
  DataTable,
  DataRow,
  ActionButton,
  Card,
  CardHead,
  Chip,
  EmptyState,
  Eyebrow,
  LineChart,
  MetricStrip,
  MetricTile,
  Overlay,
  PaceBar,
  Row,
  RowList,
  StatusChip,
  fieldClass,
  useToast,
} from '@/components/pos'
import { Segments } from '@/components/pos/Segments'
import type { Day } from '@/core/series'
import { useSearchState } from '@/components/pos/searchState'
import { parseNumber } from '@/core/numbers'
import { cn } from '@/lib/utils'
import {
  balance,
  compactMoney,
  money,
  percent,
  signedMoney,
  transactionAmount,
} from '../money'
import { recategorise, saveBudget, saveThreshold, setSubscriptionStatus, type ActionResult } from './actions'

// Five tabs over one dataset, plus two drawer kinds. The tab and the open
// drawer live in the URL, so both survive a refresh and a shared link opens
// what it says it opens.

export type FinanceData = {
  todayIso: string
  /** The Finance setting: a category past this share of its limit is flagged. */
  alertThreshold: number
  /** The integration's label, for the drawer's "Synced nightly from SimpleFIN". */
  provider: string | null
  monthPace: number
  netWorthCents: number
  changeCents: number
  assetsCents: number
  debtCents: number
  /**
   * The 30 day axis from spine(): one entry per day, nulls before the first
   * balance was ever recorded. Not the raw rows, which carry no dates the
   * chart can place and no way to tell a reading from a carried one.
   */
  series: Day[]
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

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const weekday = (iso: string) => DOW[new Date(`${iso}T12:00:00`).getDay()]
const plusDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}
const inDays = (from: string, to: string) => {
  const n = Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000)
  return n === 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n}d`
}
const dayOfMonth = (iso: string) => new Date(`${iso}T12:00:00`).getDate()
const daysLeftInMonth = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`)
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() - d.getDate()
}
const monthLabel = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`)
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

/** The artboard's card: 1px rule on the elevated ground, 14px 20px inside. */
const overviewCard = 'border-rule px-5 py-3.5'
/** Its rows: 9px, and the accent wash on hover. */
const overviewRow = 'md:py-[9px] md:gap-y-0 hover:bg-brand-soft'

/** One cell of the KPI strip: eyebrow, 34px figure, an 11px tracked line. */
/** The KPI strip's four cells: the phone's overview summary and the desktop's one-page dashboard share them. */
function KpiStrip({
  data,
  hot,
  upcomingTotal,
  daysLeft,
}: {
  data: FinanceData
  hot: FinanceData['budgets']
  upcomingTotal: number
  daysLeft: number
}) {
  // What the change is measured from: the oldest day an actual balance was
  // recorded, not data.series[0], which is null until the first sync.
  const firstKnown = data.series.find((d) => d.observed)?.cents ?? null

  // The sub-line wraps on the phone, where a cell is half the width and
  // nothing may be cut, and truncates from md.
  const sub = 'num block min-w-0 md:truncate'
  return (
    <>
      <MetricTile
        size="lg"
        label="Net worth"
        value={balance(data.netWorthCents)}
        delta={<span className={sub}>assets {money(data.assetsCents)} · debt {money(data.debtCents)}</span>}
      />
      <MetricTile
        size="lg"
        label="30-day change"
        value={signedMoney(data.changeCents)}
        valueTone={data.changeCents > 0 ? 'ok' : data.changeCents < 0 ? 'bad' : undefined}
        delta={
          <span className={sub}>
            {firstKnown === null
              ? 'no history yet'
              : `${data.changeCents >= 0 ? '+' : ''}${((data.changeCents / Math.max(1, Math.abs(firstKnown))) * 100).toFixed(1)}% · from ${money(firstKnown)}`}
          </span>
        }
      />
      <MetricTile
        size="lg"
        label="Due in 14 days"
        value={money(upcomingTotal, true)}
        delta={
          <span className={sub}>
            {data.upcoming.length > 0
              ? `${data.upcoming.length} ${data.upcoming.length === 1 ? 'charge' : 'charges'} · next ${shortDate(data.upcoming[0].nextChargeOn)}`
              : 'nothing booked'}
          </span>
        }
      />
      <MetricTile
        size="lg"
        label={`Budgets over ${data.alertThreshold}%`}
        value={hot.length}
        valueTone={hot.length > 0 ? 'warn' : undefined}
        delta={
          <span className={sub}>
            {hot.length > 0
              ? `${daysLeft} days left · ${hot.map((b) => b.name).join(' · ')}`
              : `${daysLeft} days left · all within limits`}
          </span>
        }
      />
    </>
  )
}

/** The chart or its empty state: the phone's sparkline card and the desktop's chart card share this. */
function NetWorthCard({ data }: { data: FinanceData }) {
  // One reading draws nothing worth looking at, and none draws a flat line at
  // zero that reads as a balance of zero. Both are the empty state.
  if (data.series.filter((d) => d.observed).length < 1) {
    return (
      <>
        <CardHead label="Net worth · 30 days" meta="no history yet" />
        <EmptyState headline="No history yet" className="mt-3 border-0">
          The chart is built from one balance snapshot per account per night. It fills in
          as the nightly job runs; a balance not recorded on the day is gone.
        </EmptyState>
      </>
    )
  }
  return <NetWorthChart days={data.series} />
}

export function Finance({ data }: { data: FinanceData }) {
  const { params, set: setParams } = useSearchState()
  const tab = (TABS.find((t) => t.value === params.get('tab'))?.value ?? 'overview') as Tab

  const openAccount = data.accounts.find((a) => a.id === params.get('account')) ?? null
  const openBudget = data.budgets.find((b) => b.id === params.get('budget')) ?? null
  const accountTx = openAccount
    ? data.transactions.filter((t) => t.accountName === openAccount.name)
    : []

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
    (b) => !b.isFixed && b.limitCents && percent(b.spentCents, b.limitCents) >= data.alertThreshold,
  )
  const daysLeft = daysLeftInMonth(data.todayIso)
  // What the fortnight's charges cost per month: a yearly one contributes a
  // twelfth, a weekly one four and a third.
  const monthlySubscriptions = data.upcoming.reduce(
    (sum, u) => sum + u.amountCents * (u.cadence === 'yearly' ? 1 / 12 : u.cadence === 'weekly' ? 52 / 12 : 1),
    0,
  )
  const budgetTotals = data.budgets
    .filter((b) => b.limitCents)
    .reduce((t, b) => ({ spent: t.spent + b.spentCents, limit: t.limit + (b.limitCents ?? 0) }), { spent: 0, limit: 0 })

  return (
    <div className="space-y-5">
      <div className="md:hidden">
        <Segments
          label="Finance views"
          value={tab}
          onChange={(next) => setParams({ tab: next === 'overview' ? null : next }, { local: true })}
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
        >
          {tab === 'overview' && (
            <div className="mt-[18px] space-y-3.5">
              <MetricStrip>
                <KpiStrip data={data} hot={hot} upcomingTotal={upcomingTotal} daysLeft={daysLeft} />
              </MetricStrip>
              <Card className={cn(overviewCard, 'flex min-h-[260px] flex-col')}>
                <NetWorthCard data={data} />
              </Card>
              <RowList>
                <Row
                  title="Accounts"
                  meta={`${data.accounts.length} ${data.accounts.length === 1 ? 'account' : 'accounts'} · ${balance(data.netWorthCents)}`}
                  onClick={() => setParams({ tab: 'accounts' }, { local: true })}
                  right={<span aria-hidden="true" className="text-ink-3">&rarr;</span>}
                />
                <Row
                  title="Budgets"
                  meta={`${hot.length} over ${data.alertThreshold}% · ${money(budgetTotals.spent)} spent`}
                  onClick={() => setParams({ tab: 'budgets' }, { local: true })}
                  right={<span aria-hidden="true" className="text-ink-3">&rarr;</span>}
                />
                <Row
                  title="Subscriptions"
                  meta={`${data.upcoming.length} due in 14 days · ${money(upcomingTotal, true)}`}
                  onClick={() => setParams({ tab: 'subscriptions' }, { local: true })}
                  right={<span aria-hidden="true" className="text-ink-3">&rarr;</span>}
                />
              </RowList>
            </div>
          )}

          {tab === 'accounts' && (
            <RowList className="mt-[18px]">
              {data.accounts.map((a) => (
                <Row
                  key={a.id}
                  title={a.name}
                  meta={`${a.institution}${a.mask ? ` ${a.mask}` : ''} / ${a.txCount} transactions`}
                  onClick={() => setParams({ account: a.id }, { push: true })}
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
            <div className="mt-[18px] space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className={cn('label text-[11px]', hot.length > 0 ? 'text-warn' : 'text-ink-3')}>
                  {hot.length} over {data.alertThreshold}%
                </span>
                {/* The same drawer the desktop card opens; the phone has no card head to hold it. */}
                <ActionButton size="sm" onClick={() => setParams({ limits: '1' }, { push: true })}>
                  Edit limits
                </ActionButton>
              </div>
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
                      onClick={() => setParams({ budget: b.id }, { push: true })}
                      className="t-body text-left text-ink pointer-coarse:-my-3 pointer-coarse:py-3"
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
                  <BudgetBar budget={b} pace={data.monthPace} threshold={data.alertThreshold} />
                  <p className="t-caption text-ink-3">{b.description}</p>
                </Card>
              ))}
            </div>
          )}

          {tab === 'subscriptions' && (
            <div className="mt-[18px] space-y-3">
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
                      amount={money(u.amountCents, true)}
                      right={
                        <>
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
        </Segments>
      </div>

      <div className="hidden md:block space-y-3.5">
        {/* POS Finance.dc.html: the whole picture on one page. Four cells on
          * the page ground with 1px rules between, then accounts over the
          * curve beside what is due over the budgets. The phone drills in
          * through its segments; the desktop through the drawers. */}
        <div data-testid="finance-kpis">
          <MetricStrip className="sm:grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))]">
            <KpiStrip data={data} hot={hot} upcomingTotal={upcomingTotal} daysLeft={daysLeft} />
          </MetricStrip>
        </div>

        {/* The chart owns its own header, because the high, low and average
          * belong beside the title rather than under the line. Full width
          * under the KPIs, as the Holon mockup draws it (docs/design/holon/finance.html). */}
        <Card className={cn(overviewCard, 'flex min-h-[300px] flex-col')}>
          <NetWorthCard data={data} />
        </Card>

        <div className="grid items-start gap-3.5 lg:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-3.5 self-stretch">
            <Card data-testid="finance-accounts" className={overviewCard}>
              <CardHead label="Accounts" meta="share of assets" className="mb-1" />
              <DataTable
                head={['Account', 'Institution', 'Balance', '30d', 'Share']}
                cols="minmax(0,1.3fr) minmax(0,1fr) minmax(0,.9fr) minmax(0,.7fr) minmax(0,1fr)"
              >
                {data.accounts.map((a) => (
                  <DataRow key={a.id} onClick={() => setParams({ account: a.id }, { push: true })} className={overviewRow}>
                    <span className="min-w-0 truncate text-[13px] text-ink">
                      {a.name}
                      <span className="label ml-1.5 text-[10px] text-ink-4">{a.txCount} tx →</span>
                    </span>
                    <span className="truncate text-[13px] text-ink-3">{a.institution}</span>
                    <span className="num text-right text-[13px] text-ink">{balance(a.balanceCents)}</span>
                    <span
                      className={cn(
                        'num text-right text-[13px]',
                        a.changeCents === null || a.changeCents === 0
                          ? 'text-ink-3'
                          : a.changeCents > 0
                            ? 'text-ok'
                            : 'text-bad',
                      )}
                    >
                      {/* Not tracked is not the same as no change, and must not
                          render as one. */}
                      {a.changeCents === null ? 'new' : a.changeCents === 0 ? 'flat' : signedMoney(a.changeCents)}
                    </span>
                    <span className="flex items-center justify-end gap-2">
                      <span className="h-0.5 w-14 bg-rule-2" aria-hidden>
                        <span className="block h-0.5 bg-brand" style={{ width: `${Math.max(0, Math.min(100, a.sharePercent))}%` }} />
                      </span>
                      <span className="num w-[34px] shrink-0 text-right text-[11px] text-ink-2">
                        {a.balanceCents > 0 ? `${Math.round(a.sharePercent)}%` : '\u2014'}
                      </span>
                    </span>
                  </DataRow>
                ))}
              </DataTable>
            </Card>

          </div>

          <div className="flex min-w-0 flex-col gap-3.5">
            <Card data-testid="finance-upcoming" className={overviewCard}>
              <CardHead
                label="Upcoming · 14 days"
                meta={`${shortDate(data.todayIso)} → ${shortDate(plusDays(data.todayIso, 14))}`}
                className="mb-1"
              />
              {data.upcoming.length === 0 ? (
                <EmptyState headline="Nothing booked" className="border-0">
                  No active subscription is due in the next fortnight.
                </EmptyState>
              ) : (
                <DataTable head={['Date', 'Charge', 'Amount']} cols="82px minmax(0,1fr) auto">
                  {data.upcoming.map((u) => (
                    <DataRow key={u.id} className={cn(overviewRow, 'md:gap-x-3')}>
                      <span className="num text-[12px] text-ink">
                        {shortDate(u.nextChargeOn)}
                        <span className="mt-0.5 block text-[10px] text-ink-3">
                          {weekday(u.nextChargeOn)} · {inDays(data.todayIso, u.nextChargeOn)}
                        </span>
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] text-ink">{u.name}</span>
                        <span className="mt-0.5 block truncate text-[11px] text-ink-3">
                          Subscription · {u.cadence}
                          {u.vendor ? ` · ${u.vendor}` : ''}
                        </span>
                      </span>
                      <span className="flex items-center justify-end gap-2.5">
                        <span className="num text-right text-[13px] text-ink">{money(u.amountCents, true)}</span>
                        {/* Not on the artboard: cancel has no home there, and
                            this is the one place a due charge is named. */}
                        <ActionButton
                          size="sm"
                          variant="quiet"
                          aria-label={`Cancel ${u.name}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            run(() => setSubscriptionStatus(u.id, 'cancelled'), `${u.name} cancelled`)
                          }}
                        >
                          Cancel
                        </ActionButton>
                      </span>
                    </DataRow>
                  ))}
                  <DataRow className="border-b-0 md:gap-x-3 md:pb-0.5 md:pt-2.5">
                    <span className="label text-[11px] text-ink-3">Total</span>
                    <span className="text-[12px] text-ink-3">
                      {data.upcoming.length} {data.upcoming.length === 1 ? 'charge' : 'charges'} ·{' '}
                      {money(monthlySubscriptions, true)}/mo in subscriptions
                    </span>
                    <span className="num text-right text-[13px] text-ink">{money(upcomingTotal, true)}</span>
                  </DataRow>
                </DataTable>
              )}
            </Card>

            <Card data-testid="finance-budgets" className={cn(overviewCard, 'flex flex-col')}>
              <div className="mb-1 flex items-center justify-between gap-3.5">
                <Eyebrow>Budgets · {monthLabel(data.todayIso)}</Eyebrow>
                <span className="flex items-center gap-3.5">
                  <span className={cn('label text-[11px]', hot.length > 0 ? 'text-warn' : 'text-ink-3')}>
                    {hot.length} over {data.alertThreshold}%
                  </span>
                  <ActionButton size="sm" onClick={() => setParams({ limits: '1' }, { push: true })}>
                    Edit limits
                  </ActionButton>
                </span>
              </div>
              {data.budgets.length === 0 ? (
                <EmptyState headline="No budgets" className="border-0">
                  A budget is a limit on a category for this month. Set one with Edit limits.
                </EmptyState>
              ) : (
                <>
                  <DataTable head={['Category', 'Spent / limit', 'Used']} cols="minmax(0,1fr) auto 44px">
                    {data.budgets.map((b) => {
                      const used = b.limitCents ? (b.spentCents / b.limitCents) * 100 : null
                      const over = used !== null && !b.isFixed && used >= data.alertThreshold
                      const tone =
                        used === null
                          ? 'text-ink-3'
                          : over && used >= 100
                            ? 'text-bad'
                            : over
                              ? 'text-warn'
                              : 'text-ink'
                      return (
                        <DataRow
                          key={b.id}
                          onClick={() => setParams({ budget: b.id }, { push: true })}
                          className={cn(overviewRow, 'md:block md:py-1.5')}
                        >
                          <span className="grid items-baseline gap-x-3.5 md:grid-cols-[minmax(0,1fr)_auto_44px]">
                            <span className="min-w-0 truncate text-[13px] text-ink">
                              {b.name}
                              {b.isFixed ? (
                                <StatusChip tone="quiet" className="ml-1.5">Fixed</StatusChip>
                              ) : over ? (
                                <StatusChip tone="warn" className="ml-1.5">over {data.alertThreshold}%</StatusChip>
                              ) : null}
                            </span>
                            <span className="num text-[12px] text-ink-2">
                              {money(b.spentCents)}{' '}
                              <span className="text-ink-3">/ {b.limitCents ? money(b.limitCents) : 'no limit'}</span>
                            </span>
                            <span className={cn('num text-right text-[12px]', tone)}>
                              {used === null ? '\u2014' : `${Math.round(used)}%`}
                            </span>
                          </span>
                          <BudgetBar budget={b} pace={data.monthPace} threshold={data.alertThreshold} compact />
                        </DataRow>
                      )
                    })}
                  </DataTable>
                  <div className="grid items-baseline gap-x-3.5 pt-2.5 md:grid-cols-[minmax(0,1fr)_auto_44px]">
                    <span className="label text-[11px] text-ink-3">
                      Total · <span className="text-ink-2">{money(Math.max(0, budgetTotals.limit - budgetTotals.spent))} left</span> ·
                      pace mark at day {dayOfMonth(data.todayIso)}
                    </span>
                    <span className="num text-[12px] text-ink">
                      {money(budgetTotals.spent)} <span className="text-ink-3">/ {money(budgetTotals.limit)}</span>
                    </span>
                    <span className="num text-right text-[12px] text-ink">
                      {budgetTotals.limit > 0 ? `${Math.round((budgetTotals.spent / budgetTotals.limit) * 100)}%` : '\u2014'}
                    </span>
                  </div>
                </>
              )}
            </Card>
          </div>
        </div>
      </div>

      {openAccount && (
        <Overlay
          open
          onClose={() => setParams({ account: null })}
          eyebrow={`Finance / Accounts / ${openAccount.name}`}
          title={openAccount.name}
          lede={`${openAccount.institution} · balance ${balance(openAccount.balanceCents)} · ${
            openAccount.changeCents === null ? 'new this month' : `${signedMoney(openAccount.changeCents)} over 30 days`
          }. Synced nightly${data.provider ? ` from ${data.provider}` : ''}.`}
        >
          <DrawerStats
            cells={[
              { label: 'Balance', value: balance(openAccount.balanceCents) },
              {
                label: '30-day change',
                value: openAccount.changeCents === null ? 'new' : signedMoney(openAccount.changeCents),
                tone: openAccount.changeCents === null || openAccount.changeCents === 0 ? undefined : openAccount.changeCents > 0 ? 'ok' : 'bad',
              },
              { label: 'In / Out', value: inOut(accountTx) },
            ]}
          />
          <TransactionList
            transactions={accountTx}
            categories={data.budgets.map((b) => ({ id: b.id, name: b.name }))}
            onRecategorise={(id, categoryId) =>
              run(() => recategorise(id, categoryId), 'Filed, and the rule learned it')
            }
          />
        </Overlay>
      )}

      {openBudget && (
        <Overlay
          open
          onClose={() => setParams({ budget: null })}
          eyebrow={`Finance / Budgets / ${openBudget.name}`}
          title={openBudget.name}
          lede={`${openBudget.description ? `${openBudget.description}. ` : ''}Classified by rules first, model second; every transaction shows which.`}
        >
          <DrawerStats
            cells={[
              { label: 'Spent', value: money(openBudget.spentCents) },
              {
                label: 'Used',
                value: openBudget.limitCents ? `${percent(openBudget.spentCents, openBudget.limitCents)}%` : '\u2014',
                tone: openBudget.limitCents && !openBudget.isFixed && percent(openBudget.spentCents, openBudget.limitCents) >= data.alertThreshold ? 'warn' : undefined,
              },
              {
                label: 'Remaining',
                value: openBudget.limitCents ? money(Math.max(0, openBudget.limitCents - openBudget.spentCents)) : '\u2014',
              },
            ]}
          />
          <Card className="mt-3.5 flex items-center gap-3.5">
            <Eyebrow className="flex-1">Monthly limit</Eyebrow>
            <span className="num text-[13px] text-ink-3">$</span>
            <input
              inputMode="decimal"
              defaultValue={openBudget.limitCents ? openBudget.limitCents / 100 : ''}
              aria-label={`Monthly limit for ${openBudget.name}`}
              onBlur={(e) => {
                const n = parseNumber(e.target.value)
                if (n !== null) run(() => saveBudget(openBudget.id, n), 'Limit saved')
              }}
              className={cn(fieldClass, 'num w-24 text-right')}
            />
            <span className="num text-[11px] text-ink-3">
              per month
              {openBudget.limitCents
                ? ` · ${money(Math.max(0, Math.round((openBudget.limitCents - openBudget.spentCents) / Math.max(1, daysLeft))))}/day left`
                : ''}
            </span>
          </Card>
          <TransactionList
            transactions={data.transactions.filter((t) => t.categoryName === openBudget.name)}
            categories={data.budgets.map((b) => ({ id: b.id, name: b.name }))}
            onRecategorise={(id, categoryId) =>
              run(() => recategorise(id, categoryId), 'Filed, and the rule learned it')
            }
          />
        </Overlay>
      )}

      {params.get('limits') === '1' && (
        <LimitsDrawer
          budgets={data.budgets}
          threshold={data.alertThreshold}
          onClose={() => setParams({ limits: null })}
          onSave={async (limits, threshold) => {
            for (const [id, dollars] of limits) {
              const result = await saveBudget(id, dollars)
              if (!result.ok) return result
            }
            if (threshold !== null) return saveThreshold(threshold)
            return { ok: true }
          }}
          toast={toast}
        />
      )}
    </div>
  )
}

function BudgetBar({
  budget,
  pace,
  threshold,
  compact = false,
}: {
  budget: FinanceData['budgets'][number]
  pace: number
  threshold: number
  /** The overview's row: the 2px bar with its pace tick and nothing under it. */
  compact?: boolean
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
  const over = !budget.isFixed && pct >= threshold

  return (
    <div className={cn(!compact && 'space-y-1.5', compact && 'mt-[5px]')}>
      <PaceBar
        value={pct}
        max={100}
        pace={pace}
        tone={budget.isFixed ? 'brand' : pct > 100 ? 'bad' : over ? 'warn' : 'brand'}
        className={cn(compact && 'h-0.5 rounded-none [&>div]:rounded-none')}
      />
      {compact ? null : (
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className={cn('label text-[10px]', pct > 100 ? 'text-bad' : over ? 'text-warn' : 'text-ink-3')}>
          {pct}% used
        </span>
        <span className="label text-[10px] text-ink-3">
          {budget.limitCents - budget.spentCents >= 0
            ? `${money(budget.limitCents - budget.spentCents)} left`
            : `${money(budget.spentCents - budget.limitCents)} over`}
        </span>
      </div>
      )}
    </div>
  )
}

/**
 * Thirty days of net worth on the shared LineChart (v1.1 Phase 11 extracted
 * it; the drawing is described there). The x axis is thirty days, not thirty
 * rows: before spine() this drew whatever rows the query returned, evenly
 * spaced, so two nights of balances became a line across the full width
 * under a caption reading "30 days".
 */
function NetWorthChart({ days }: { days: Day[] }) {
  return (
    <LineChart
      name="Net worth"
      days={days}
      format={money}
      formatCompact={compactMoney}
      formatDelta={signedMoney}
    />
  )
}

/** "$11.6k / $4.7k": money in and out over the rows shown. */
function inOut(transactions: FinanceData['transactions']): string {
  const inCents = transactions.filter((t) => t.amountCents < 0).reduce((s, t) => s - t.amountCents, 0)
  const outCents = transactions.filter((t) => t.amountCents > 0).reduce((s, t) => s + t.amountCents, 0)
  return `${compactMoney(inCents)} / ${compactMoney(outCents)}`
}

/** The drawer's three cells: one strip, eyebrow over a 24px figure. */
function DrawerStats({
  cells,
}: {
  cells: { label: string; value: string; tone?: 'ok' | 'bad' | 'warn' }[]
}) {
  return (
    <MetricStrip className="grid-cols-3 sm:grid-cols-3">
      {cells.map((c) => (
        <MetricTile key={c.label} size="sm" label={c.label} value={c.value} valueTone={c.tone} className="px-3.5 py-3 sm:px-3.5 sm:py-3" />
      ))}
    </MetricStrip>
  )
}

/**
 * The drawer's transactions, as the artboard draws them: date, merchant with
 * its category and the arm that filed it under, amount with income in green.
 * The category is the control: pressing it opens the picker in the row, and
 * the row stays the artboard's row until then. Every row says which arm
 * decided it, which is the system's rules-first promise made visible.
 */
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
      <EmptyState headline="No transactions" className="mt-3.5">
        Nothing here yet. Connect an account at Settings, Connections, and the nightly sync fills
        this in.
      </EmptyState>
    )
  }

  return (
    <div className="mt-3.5">
      <div className="flex items-center justify-between">
        <Eyebrow>Transactions · 30 days</Eyebrow>
        <span className="label text-[11px] text-ink-3">
          {transactions.length} {transactions.length === 1 ? 'transaction' : 'transactions'}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-[64px_minmax(0,1fr)_auto] gap-x-3 border-b border-rule-2 py-[7px]">
        {['Date', 'Merchant', 'Amount'].map((h, i) => (
          <span key={h} className={cn('label text-[11px] text-ink-3', i === 2 && 'text-right')}>
            {h}
          </span>
        ))}
      </div>
      {transactions.map((t) => {
        const amount = transactionAmount(t.amountCents)
        const open = editing === t.id
        return (
          <div key={t.id} className="border-b border-rule">
            <div className="grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-x-3 py-[9px] text-[13px]">
              <span className="num text-[11px] text-ink-3">{shortDate(t.occurredOn)}</span>
              <span className="min-w-0">
                <span className="block text-ink md:truncate">{t.descriptor}</span>
                <span className="mt-0.5 block text-[11px] text-ink-3 md:truncate">
                  <button
                    type="button"
                    aria-label={`File ${t.descriptor}`}
                    aria-expanded={open}
                    onClick={() => setEditing(open ? null : t.id)}
                    className={cn(
                      // A text link in a dense row: the hit area grows on a coarse pointer without moving the row.
                      'underline-offset-2 hover:text-ink hover:underline pointer-coarse:-my-3 pointer-coarse:py-3',
                      t.categoryName ? (t.isManual ? 'text-ink-2' : 'text-ink-3') : 'text-warn',
                    )}
                  >
                    {t.categoryName ?? 'Uncategorised'}
                  </button>{' '}
                  {(t.isManual || t.classifiedBy === 'model' || t.classifiedBy === 'rule') && (
                    <StatusChip tone={t.classifiedBy === 'model' && !t.isManual ? 'brand' : 'quiet'}>
                      {t.isManual
                        ? 'Manual'
                        : t.classifiedBy === 'model' && t.confidence !== null
                          ? `Model ${t.confidence.toFixed(2)}`
                          : t.classifiedBy === 'model'
                            ? 'Model'
                            : 'Rule'}
                    </StatusChip>
                  )}
                </span>
              </span>
              <span className={cn('num text-right text-[13px]', amount.incoming ? 'text-ok' : 'text-ink')}>
                {amount.text}
              </span>
            </div>
            {open && (
              <div className="flex flex-wrap gap-1.5 pb-2.5">
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
          </div>
        )
      })}
    </div>
  )
}

/**
 * The Budget limits drawer. Edits are held here until Done, as the artboard's
 * Reset and Done imply: the hint counts them, Reset drops them, Done writes
 * them and closes, and leaving with edits asks first.
 */
function LimitsDrawer({
  budgets,
  threshold,
  onClose,
  onSave,
  toast,
}: {
  budgets: FinanceData['budgets']
  threshold: number
  onClose: () => void
  onSave: (limits: [string, number][], threshold: number | null) => Promise<ActionResult>
  toast: (message: string) => void
}) {
  const [limits, setLimits] = useState<Record<string, string>>({})
  const [nextThreshold, setNextThreshold] = useState(threshold)
  const [pending, start] = useTransition()

  const changed = Object.entries(limits).flatMap(([id, v]) => {
    const n = parseNumber(v)
    const was = budgets.find((b) => b.id === id)?.limitCents
    return n !== null && Math.round(n * 100) !== (was ?? 0) ? [[id, n] as [string, number]] : []
  })
  const thresholdChanged = nextThreshold !== threshold
  const count = changed.length + (thresholdChanged ? 1 : 0)

  const close = () => {
    if (count > 0 && !window.confirm(`Discard ${count} unsaved change${count === 1 ? '' : 's'}?`)) return
    onClose()
  }
  const reset = () => {
    setLimits({})
    setNextThreshold(threshold)
  }
  const done = () =>
    start(async () => {
      const result = await onSave(changed, thresholdChanged ? nextThreshold : null)
      if (!result.ok) {
        toast(result.error)
        return
      }
      if (count > 0) toast(`${count} change${count === 1 ? '' : 's'} saved`)
      onClose()
    })

  const totals = budgets.reduce(
    (t, b) => {
      const edited = limits[b.id] === undefined ? null : parseNumber(limits[b.id])
      const limit = edited !== null ? Math.round(edited * 100) : (b.limitCents ?? 0)
      return { spent: t.spent + b.spentCents, limit: t.limit + limit }
    },
    { spent: 0, limit: 0 },
  )

  return (
    <Overlay
      open
      onClose={close}
      eyebrow="Finance / Budgets / Settings"
      title="Budget limits"
      lede="Monthly limits per category. Spent this month is shown for reference. Changes apply when you press Done and are never overwritten by a job."
      footer={
        <>
          <span className="label text-[11px] text-ink-3">
            {count === 0 ? 'No changes' : `${count} unsaved change${count === 1 ? '' : 's'}`}
          </span>
          <span className="flex gap-2.5">
            <ActionButton variant="outline" size="lg" className="h-9 px-3.5 text-[13px]" onClick={reset} disabled={count === 0 || pending}>
              Reset
            </ActionButton>
            <ActionButton variant="solid" size="lg" className="h-9 gap-2 px-3.5 text-[13px]" onClick={done} disabled={pending}>
              Done <span aria-hidden="true">&rarr;</span>
            </ActionButton>
          </span>
        </>
      }
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto_130px] gap-x-3.5 border-b border-rule-2 py-[7px]">
        <span className="label text-[11px] text-ink-3">Category</span>
        <span className="label text-right text-[11px] text-ink-3">Spent</span>
        <span className="label text-right text-[11px] text-ink-3">Monthly limit</span>
      </div>
      {budgets.map((b) => {
        const used = b.limitCents ? percent(b.spentCents, b.limitCents) : null
        const over = used !== null && !b.isFixed && used >= threshold
        return (
          <div key={b.id} className="grid grid-cols-[minmax(0,1fr)_auto_130px] items-center gap-x-3.5 border-b border-rule py-2.5 text-[13px]">
            <span className="min-w-0">
              <span className="block truncate text-ink">{b.name}</span>
              <span className="mt-0.5 block truncate text-[11px] text-ink-3">
                {b.isFixed && !/^fixed\b/i.test(b.description) ? `Fixed${b.description ? ' · ' : ''}` : ''}
                {b.description}
              </span>
            </span>
            <span className={cn('num text-right text-[12px]', over ? 'text-warn' : 'text-ink-2')}>
              {money(b.spentCents)}
              {used !== null ? ` · ${used}%` : ''}
            </span>
            <span className="flex items-center justify-end gap-1.5">
              <span className="num text-[13px] text-ink-3">$</span>
              <input
                inputMode="decimal"
                value={limits[b.id] ?? (b.limitCents ? String(b.limitCents / 100) : '')}
                onChange={(e) => setLimits((l) => ({ ...l, [b.id]: e.target.value }))}
                aria-label={`Monthly limit for ${b.name}`}
                className={cn(fieldClass, 'num w-[88px] py-1.5 text-right')}
              />
            </span>
          </div>
        )
      })}
      <div className="grid grid-cols-[minmax(0,1fr)_auto_130px] items-center gap-x-3.5 py-3 text-[13px]">
        <span className="label text-[11px] text-ink-3">Total</span>
        <span className="num text-right text-[12px] text-ink">{money(totals.spent)}</span>
        <span className="num text-right text-[13px] text-ink">{money(totals.limit)}</span>
      </div>

      <Card className="mt-2 flex flex-col gap-2.5">
        <Eyebrow>Alert threshold</Eyebrow>
        <div className="flex items-center gap-3.5">
          <input
            type="range"
            min={50}
            max={100}
            step={5}
            value={nextThreshold}
            onChange={(e) => setNextThreshold(Number(e.target.value))}
            aria-label="Alert threshold"
            className="flex-1 accent-action"
          />
          <span className="num w-11 text-right text-[13px] text-ink">{nextThreshold}%</span>
        </div>
        <p className="text-[12px] leading-[1.5] text-ink-3">
          Categories past this share of their limit are flagged in the digest and count toward
          &quot;Budgets over threshold&quot;.
        </p>
      </Card>
    </Overlay>
  )
}
