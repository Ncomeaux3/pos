'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useSyncExternalStore, useTransition, type ReactNode } from 'react'
import {
  DataTable,
  DataRow,
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
  /** The Finance setting: a category past this share of its limit is flagged. */
  alertThreshold: number
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

/** True from md up. False on the server and on the first client render, so the
 * phone's segments are what hydrates; the desktop takes over on the pass after. */
function useDesktop() {
  return useSyncExternalStore(
    (notify) => {
      const mq = window.matchMedia('(min-width: 768px)')
      mq.addEventListener('change', notify)
      return () => mq.removeEventListener('change', notify)
    },
    () => window.matchMedia('(min-width: 768px)').matches,
    () => false,
  )
}

/** One cell of the KPI strip: eyebrow, 34px figure, an 11px tracked line. */
function Kpi({
  label,
  value,
  tone,
  children,
}: {
  label: ReactNode
  value: ReactNode
  tone?: 'ok' | 'bad' | 'warn'
  children: ReactNode
}) {
  return (
    <div className="bg-bg px-5 py-4">
      <Eyebrow>{label}</Eyebrow>
      <div
        className={cn(
          'num mt-2.5 text-[34px] font-light leading-none tracking-[-0.02em]',
          tone === 'ok' ? 'text-ok' : tone === 'bad' ? 'text-bad' : tone === 'warn' ? 'text-warn' : 'text-ink',
        )}
      >
        {value}
      </div>
      <div className="label mt-2 truncate text-[11px] tracking-[0.06em] text-ink-3">{children}</div>
    </div>
  )
}

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

  // The desktop is the artboard's one page; the segments are the phone's,
  // from PosPhone, and the tab in the URL only means something there.
  const desktop = useDesktop()

  return (
    <div className="space-y-5">
      <TabBar
        className="md:hidden"
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

      {(tab === 'overview' || desktop) && (
        <div className="space-y-3.5">
          {/* POS Finance.dc.html: the whole picture on one page. Four cells on
            * the page ground with 1px rules between, then accounts over the
            * curve beside what is due over the budgets. The phone drills in
            * through its segments; the desktop through the drawers. */}
          <div
            data-testid="finance-kpis"
            className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-px border border-rule bg-rule"
          >
            <Kpi label="Net worth" value={balance(data.netWorthCents)}>
              assets {money(data.assetsCents)} · debt {money(data.debtCents)}
            </Kpi>
            <Kpi
              label="30-day change"
              value={signedMoney(data.changeCents)}
              tone={data.changeCents > 0 ? 'ok' : data.changeCents < 0 ? 'bad' : undefined}
            >
              {data.series.length > 1
                ? `${data.changeCents >= 0 ? '+' : ''}${((data.changeCents / Math.max(1, Math.abs(data.series[0]))) * 100).toFixed(1)}% · from ${money(data.series[0])}`
                : 'no history yet'}
            </Kpi>
            <Kpi label="Due in 14 days" value={money(upcomingTotal, true)}>
              {data.upcoming.length > 0
                ? `${data.upcoming.length} ${data.upcoming.length === 1 ? 'charge' : 'charges'} · next ${shortDate(data.upcoming[0].nextChargeOn)}`
                : 'nothing booked'}
            </Kpi>
            <Kpi
              label={`Budgets over ${data.alertThreshold}%`}
              value={hot.length}
              tone={hot.length > 0 ? 'warn' : undefined}
            >
              {hot.length > 0
                ? `${hot.map((b) => b.name).join(' · ')} · ${daysLeft} days left`
                : `all within limits · ${daysLeft} days left`}
            </Kpi>
          </div>

          <div className="grid items-start gap-3.5 lg:grid-cols-2">
            <div className="flex flex-col gap-3.5 self-stretch">
              <Card data-testid="finance-accounts" className={overviewCard}>
                <CardHead label="Accounts" meta="share of assets" className="mb-1" />
                <DataTable
                  head={['Account', 'Institution', 'Balance', '30d', 'Share']}
                  cols="minmax(0,1.3fr) minmax(0,1fr) minmax(0,.9fr) minmax(0,.7fr) minmax(0,1fr)"
                >
                  {data.accounts.map((a) => (
                    <DataRow key={a.id} onClick={() => setParams({ account: a.id })} className={overviewRow}>
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

              {/* The chart owns its own header, because the high, low and
                * average belong beside the title rather than under the line.
                * It takes the rest of the column's height, as drawn. */}
              <Card className={cn(overviewCard, 'flex min-h-[340px] flex-1 flex-col')}>
                {data.series.length < 2 ? (
                  <>
                    <CardHead label="Net worth · 30 days" meta="no history yet" />
                    <EmptyState headline="No history yet" className="mt-3 border-0">
                      The chart is built from one balance snapshot per account per night. It fills in
                      as the nightly job runs; a balance not recorded on the day is gone.
                    </EmptyState>
                  </>
                ) : (
                  <NetWorthChart values={data.series} dates={data.seriesDates} />
                )}
              </Card>
            </div>

            <div className="flex flex-col gap-3.5">
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
                          <button
                            type="button"
                            aria-label={`Cancel ${u.name}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              run(() => setSubscriptionStatus(u.id, 'cancelled'), `${u.name} cancelled`)
                            }}
                            className="label border border-rule-2 px-2 py-[3px] text-[10px] tracking-[0.08em] text-ink-3 transition-colors duration-150 hover:border-bad hover:text-bad"
                          >
                            Cancel
                          </button>
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
                    <button
                      type="button"
                      onClick={() => setParams({ limits: '1' })}
                      className="label border border-rule-2 px-2 py-1 text-[11px] tracking-[0.08em] text-ink-2 transition-colors duration-150 hover:border-ink hover:text-ink"
                    >
                      Edit limits
                    </button>
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
                            onClick={() => setParams({ budget: b.id })}
                            className={cn(overviewRow, 'md:block md:py-1.5')}
                          >
                            <span className="grid items-baseline gap-x-3.5 md:grid-cols-[minmax(0,1fr)_auto_44px]">
                              <span className="min-w-0 truncate text-[13px] text-ink">
                                {b.name}
                                {b.isFixed ? (
                                  <span className="label ml-1.5 text-[10px] tracking-[0.08em] text-ink-4">Fixed</span>
                                ) : over ? (
                                  <span className="label ml-1.5 text-[10px] tracking-[0.08em] text-warn">
                                    over {data.alertThreshold}%
                                  </span>
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
      )}

      {tab === 'accounts' && !desktop && (
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

      {tab === 'budgets' && !desktop && (
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
              <BudgetBar budget={b} pace={data.monthPace} threshold={data.alertThreshold} />
              <p className="t-caption text-ink-3">{b.description}</p>
            </Card>
          ))}
        </div>
      )}

      {tab === 'subscriptions' && !desktop && (
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

      {tab === 'transactions' && !desktop && (
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
              size="lg"
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
            <BudgetBar budget={openBudget} pace={data.monthPace} threshold={data.alertThreshold} />

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
        <span className={cn('label text-[10px]', over ? 'text-warn' : 'text-ink-3')}>
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

/** The 31 point line. Hand rolled SVG: no chart library anywhere in this app. */
/**
 * Thirty days of net worth, drawn the way the artboard draws it.
 *
 * Four gridlines, the value thirty days ago as a dashed baseline, the high and
 * the low marked, and a crosshair that says what a given day was and how far
 * from the start it had moved. The axis labels are outside the plot in their
 * own 64px column, so the line is never squeezed by the width of a number.
 */
function NetWorthChart({ values, dates }: { values: number[]; dates: string[] }) {
  const [hover, setHover] = useState<number | null>(null)

  const width = 600
  const height = 160
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1

  const x = (i: number) => (i / Math.max(1, values.length - 1)) * width
  const y = (v: number) => height - ((v - min) / span) * height

  const line = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const area = `${line} L${width},${height} L0,${height} Z`

  const hi = values.indexOf(max)
  const lo = values.indexOf(min)
  const start = values[0]

  // The biggest single day move in each direction, which is the one thing the
  // shape of the line does not tell you at a glance.
  const moves = values.slice(1).map((v, i) => v - values[i])
  const best = moves.length > 0 ? Math.max(...moves) : 0
  const worst = moves.length > 0 ? Math.min(...moves) : 0

  const at = hover === null ? null : values[hover]

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="eyebrow text-ink-3">Net worth · 30 days</span>
        <span className="label flex gap-[18px] text-[11px] tracking-[0.04em] text-ink-3">
          <span>
            High <span className="num text-ink">{compactMoney(max)}</span>
          </span>
          <span>
            Low <span className="num text-ink">{compactMoney(min)}</span>
          </span>
          <span>
            Avg{' '}
            <span className="num text-ink">
              {compactMoney(Math.round(values.reduce((sum, v) => sum + v, 0) / values.length))}
            </span>
          </span>
        </span>
      </div>

      <div className="mt-2.5 grid flex-1 grid-cols-[1fr_64px]">
        <div className="relative min-h-[200px]">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
            role="img"
            aria-label={`Net worth over ${values.length} days, from ${compactMoney(values[0])} to ${compactMoney(values[values.length - 1])}`}
            className="block h-full w-full cursor-crosshair overflow-visible"
            onMouseMove={(e) => {
              const box = e.currentTarget.getBoundingClientRect()
              const share = (e.clientX - box.left) / box.width
              setHover(Math.max(0, Math.min(values.length - 1, Math.round(share * (values.length - 1)))))
            }}
            onMouseLeave={() => setHover(null)}
          >
            {[0, 53, 107].map((line_) => (
              <line key={line_} x1="0" y1={line_} x2={width} y2={line_} stroke="var(--rule)" />
            ))}
            <line x1="0" y1={height} x2={width} y2={height} stroke="var(--rule-2)" />

            {/* Where it stood thirty days ago: everything above this line is
              * the month's gain, and the eye reads that without arithmetic. */}
            <line
              x1="0"
              y1={y(start)}
              x2={width}
              y2={y(start)}
              stroke="var(--ink-4)"
              strokeDasharray="3 4"
              vectorEffect="non-scaling-stroke"
            />

            <path d={area} fill="var(--accent-soft)" />
            <path
              d={line}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
            />

            <circle cx={x(hi)} cy={y(max)} r={2.5} fill="var(--bg-elev)" stroke="var(--ink-2)" vectorEffect="non-scaling-stroke" />
            <circle cx={x(lo)} cy={y(min)} r={2.5} fill="var(--bg-elev)" stroke="var(--ink-2)" vectorEffect="non-scaling-stroke" />
            <circle cx={width} cy={y(values[values.length - 1])} r={3} fill="var(--accent)" />

            {hover !== null && at !== undefined && at !== null && (
              <g>
                <line x1={x(hover)} y1="0" x2={x(hover)} y2={height} stroke="var(--ink-2)" vectorEffect="non-scaling-stroke" />
                <circle cx={x(hover)} cy={y(at)} r={3.5} fill="var(--ink)" />
              </g>
            )}
          </svg>

          {hover !== null && at !== undefined && at !== null && (
            <div
              className="pointer-events-none absolute top-0 z-2 whitespace-nowrap border border-rule-2 bg-bg px-2.5 py-1.5 text-[11px]"
              style={{
                left: `${(hover / Math.max(1, values.length - 1)) * 100}%`,
                transform: hover > values.length / 2 ? 'translateX(-100%)' : 'none',
              }}
            >
              <span className="text-ink-3">{shortDate(dates[hover])}</span>{' '}
              <span className="num ml-2 text-ink">{money(at)}</span>{' '}
              <span className={cn('num ml-2', at - start >= 0 ? 'text-ok' : 'text-bad')}>
                {signedMoney(at - start)}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col justify-between pl-3 text-[11px] text-ink-3">
          {[max, min + (span * 2) / 3, min + span / 3, min].map((v, i) => (
            <span key={i} className="num leading-none">
              {compactMoney(Math.round(v))}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-2.5 grid grid-cols-[1fr_64px]">
        <div className="flex justify-between text-[11px] text-ink-3">
          {dates
            .filter((unused, i) => i % Math.max(1, Math.round(dates.length / 6)) === 0)
            .map((d) => (
              <span key={d} className="num">
                {shortDate(d)}
              </span>
            ))}
        </div>
        <span />
      </div>

      <div className="label mt-2.5 flex flex-wrap gap-x-[18px] gap-y-2 border-t border-rule pt-2.5 text-[11px] tracking-[0.04em] text-ink-3">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-3 bg-brand" aria-hidden />
          Daily net worth
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 border-t border-dashed border-ink-3" aria-hidden />
          30d ago {compactMoney(start)}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full border border-ink-2" aria-hidden />
          High / low
        </span>
        <span className="ml-auto">
          Best day <span className="num text-ok">{signedMoney(best)}</span> · worst{' '}
          <span className="num text-bad">{signedMoney(worst)}</span>
        </span>
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
