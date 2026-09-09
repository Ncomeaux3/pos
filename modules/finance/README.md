# Finance

Net worth, budgets, subscriptions and the ledger. Screen 04 of the design
bundle, and the module the guard exists for.

## Two conventions, both load-bearing

**Money is integer cents. Never a float.** `0.1 + 0.2` is not `0.3`, and a
budget that is a cent out every month is a budget nobody trusts. Dollars exist
only in `money.ts`, at the edge, on the way to the screen.

**Positive is money out. Income is negative.** It reads backwards for a second
and then never again, and it means a category total is a sum with no case
analysis anywhere. `transactionAmount()` is the single place that knows the
convention is inverted from what a person expects.

`balance()` and `signedMoney()` are separate functions on purpose. A card
balance of `-231000` is "-$2,310" and means debt; a 30 day change of `-64000`
is "-$640" and means it fell. Same glyph, different fact, so neither is used
for the other's job.

## Recurring detection

`recurring.ts`, written test first because SPEC names it and because a wrong
answer here is expensive in both directions.

Three occurrences minimum, every amount within ten percent of the **median**,
and every gap within slack of one cadence. Monthly gets five days of slack:
months are 28 to 31 days, billing dates land on weekends and get pushed, and a
card that posts a day late is still the same subscription.

The bias is against false positives throughout. A bill on the dashboard that is
not real teaches you to ignore the tile, and an ignored tile is worse than an
empty one. Two charges is a coincidence, not a cadence. Income is skipped
outright: a fortnightly paycheck is the most regular thing in the data and
belongs nowhere near the upcoming charges tile.

The demo seed proves it rather than asserting it. Four monthly cycles of five
merchants go in alongside twelve scattered shops and a payroll; the detector
finds exactly the five.

`isStale()` flags a subscription with no charge in **two** cycles, per SPEC. Two
rather than one because a single missed cycle is usually a billing date that
moved, and flagging on one would cry wolf every time a card was reissued. It
sets `paused`, never `cancelled`: the charge stopping might mean the card was
reissued, and this module does not get to decide you cancelled something.

## Categorisation

`categorise.ts`, also test first. Rules first, model second, and the interface
to "second" is `null`: everything in that file exists to return null less often,
because a month is hundreds of rows and sending each to a model would be the
largest line on the bill.

Ranking is manual before automatic, then longest pattern first. Manual wins
outright because the owner's correction is the one fact a job may never
overwrite. Length breaks the rest, so `amazon prime` beats `amazon`.

`learnFrom()` turns a correction into a rule, which is the compounding value of
the module: every rule learned is a model call not made next month. It strips
the processor prefix (`SQ *`, `TST*`) and then the trailing reference, and only
then drops a short token the reference was sitting behind. That last step is
what turns `WHOLEFDS ABC 10045` into `wholefds` while leaving `BIG SPOON
CREAMERY` intact, and it is the case worth reading the test for.

The nightly `categorise` job never sends anything to a model. Unmatched rows
stay uncategorised and visible; the model arm belongs behind the guard with a
confidence and a proposal, not on a sweep.

## Guarded, and what is not

`set_budget` and `write_subscription` are guarded. A budget and a subscription
are commitments, so an agent proposes changing one.

`categorise` is **not**, deliberately. It is bookkeeping, it is reversible from
the row itself, and putting hundreds of rows a month through the Review inbox
would make the inbox useless, which is the exact failure a guard has to avoid.

## Jobs

`snapshot_balances` writes one row per account per night. It is the only reason
the net worth chart can exist: a balance not recorded on the day is gone, and no
amount of transaction history recovers it. A brokerage moves on market change
with no transaction at all.

Then `categorise`, `detect_subscriptions`, and `nightly_digest`.

## Metrics

`finance.net_worth` and `finance.liquid`, both in **dollars**, not cents. A goal
target is typed in dollars, and a metric that silently returned cents would read
as a hundredfold overshoot on the Goals screen.
