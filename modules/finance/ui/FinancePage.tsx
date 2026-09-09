import { PageHeader } from '@/components/pos'
import { ownerToday } from '@/core/today'
import {
  categorySpend,
  listAccounts,
  listTransactions,
  netWorthSeries,
  upcomingCharges,
} from '../data'
import { monthPace } from '../money'
import { Finance, type FinanceData } from './Finance'

export default async function FinancePage() {
  const [accounts, series, spend, upcoming, transactions, todayIso] = await Promise.all([
    listAccounts(),
    netWorthSeries(30),
    categorySpend(),
    upcomingCharges(14),
    listTransactions({ limit: 60 }),
    ownerToday(),
  ])

  const netWorth = accounts.reduce((sum, a) => sum + Number(a.balance_cents), 0)
  const assets = accounts
    .filter((a) => Number(a.balance_cents) > 0)
    .reduce((sum, a) => sum + Number(a.balance_cents), 0)

  // From the series, not from per account deltas: an account opened inside the
  // window has no thirty day balance, and counting its whole balance as growth
  // would put a number on the screen that never happened.
  const change = series.length > 1 ? netWorth - series[0].cents : 0

  const data: FinanceData = {
    todayIso,
    monthPace: monthPace(todayIso),
    netWorthCents: netWorth,
    changeCents: change,
    assetsCents: assets,
    debtCents: assets - netWorth,
    series: series.map((s) => s.cents),
    seriesDates: series.map((s) => s.on_date),

    accounts: accounts.map((a) => ({
      id: a.id,
      name: a.name,
      institution: a.institution,
      kind: a.kind,
      balanceCents: Number(a.balance_cents),
      // Null means it was not being tracked thirty days ago, which is not the
      // same as no change and must not render as one.
      changeCents:
        a.balance_30d_cents === null ? null : Number(a.balance_cents) - Number(a.balance_30d_cents),
      sharePercent: assets > 0 ? Math.max(0, (Number(a.balance_cents) / assets) * 100) : 0,
      txCount: Number(a.tx_count),
      mask: a.mask,
    })),

    budgets: spend.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      isFixed: c.is_fixed,
      spentCents: Number(c.spent_cents),
      limitCents: c.limit_cents === null ? null : Number(c.limit_cents),
      txCount: Number(c.tx_count),
    })),

    upcoming: upcoming.map((u) => ({
      id: u.id,
      name: u.name,
      vendor: u.vendor,
      amountCents: Number(u.amount_cents),
      nextChargeOn: u.next_charge_on,
      cadence: u.cadence,
    })),

    transactions: transactions.map((t) => ({
      id: t.id,
      descriptor: t.descriptor,
      amountCents: Number(t.amount_cents),
      occurredOn: t.occurred_on,
      accountName: t.account_name,
      categoryName: t.category_name,
      classifiedBy: t.classified_by,
      confidence: t.confidence === null ? null : Number(t.confidence),
      isManual: t.is_manual,
    })),
  }

  const hot = data.budgets.filter(
    (b) => !b.isFixed && b.limitCents && b.spentCents / b.limitCents >= 0.8,
  ).length

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={`Finance / ${data.accounts.length} accounts / ${hot} budgets hot`}
        dot={hot > 0 ? 'warn' : 'brand'}
        title="Finance"
        lede="Net worth from nightly balance snapshots, spending against this month's limits, and what is due in the next fortnight. Transactions are categorised by rules first; every one shows which rule decided it."
        actions={
          <span className="num text-[11px] text-ink-3">
            {data.transactions.length} recent transactions
          </span>
        }
      />
      <Finance data={data} />
    </div>
  )
}
