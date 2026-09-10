import type { FinanceDigest } from '../jobs/nightly-digest'

// The Finance dashboard tile. The module says how its own numbers read,
// because core cannot: it has no idea what `netWorthCents` is, and printing
// the payload generically is what put "debt cents 231000" on the dashboard.

const money = (cents: number) =>
  `$${Math.round(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`

/** Signed, because a net worth change reads wrong without its direction. */
const delta = (cents: number) => `${cents >= 0 ? '+' : '-'}${money(Math.abs(cents))}`

export function FinanceTile({ payload }: { payload: Record<string, unknown> }) {
  const d = payload as Partial<FinanceDigest>
  const netWorth = d.netWorthCents ?? 0
  const change = d.changeCents ?? 0
  const upcoming = d.upcomingCents ?? 0
  const overBudget = d.overBudget ?? []

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-x-8 gap-y-3">
        <div>
          <span className="eyebrow block text-ink-3">Net worth</span>
          <span className="num block text-[26px] font-light leading-tight text-ink">
            {money(netWorth)}
          </span>
          <span className={`num text-[11px] ${change >= 0 ? 'text-brand' : 'text-bad'}`}>
            {delta(change)} · 30d
          </span>
        </div>

        <div>
          <span className="eyebrow block text-ink-3">Due in 14 days</span>
          <span className="num block text-[26px] font-light leading-tight text-ink">
            {money(upcoming)}
          </span>
          <span className="num text-[11px] text-ink-3">
            {d.upcomingCount ?? 0} {d.upcomingCount === 1 ? 'charge' : 'charges'}
          </span>
        </div>
      </div>

      {overBudget.length > 0 && (
        <p className="t-caption text-amber">
          {overBudget
            .slice(0, 2)
            .map((b) => `${b.name} at ${Math.round(b.percent)}%`)
            .join(', ')}
          {overBudget.length > 2 ? ` and ${overBudget.length - 2} more` : ''}
        </p>
      )}
    </div>
  )
}
