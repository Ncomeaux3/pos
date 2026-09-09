# Ideas

Effort against impact, four stages, and a graveyard that is kept. Screen 17 of
the design bundle.

## Three points, not ten

`effort` and `impact` are 1 to 3. A ten point scale invites a precision nobody
has: the difference between a six and a seven is not a judgement anyone makes
the same way twice, and two sittings a week apart would score the same idea
differently for no reason. Cheap, middling, expensive is a judgement a person
can actually repeat.

The quadrant falls out of the two scores rather than being stored, so it can
never disagree with them. `quadrant.ts` is the whole rule and it is tested.

## A killed idea is kept

`stage = 'killed'` with a `killed_reason`, never a delete. The reason is the
most useful note about an idea: it is what stops the same one arriving again in
six months and getting the same two evenings spent on it.

The killed tab is a first class view for that reason, not a bin.

## Not moving is named, not decided

An exploring idea untouched for sixty days shows in the "not moving" card with
a Kill it button next to it. The card says how long, and offers the choice. It
does not make it. An idea that goes quiet for two months is usually dead, but
usually is not always, and the module has no way to tell which this is.

Staleness reads `updated_at`, so the trigger on this table stamps the time only
when the writer did not set it. That lets the demo seed back-date a row, and it
means a re-seed does not quietly make every idea look fresh.

## The goal link goes through core

`goal_ref` points at `core.entities`, not at `goals.goal`. So an idea can name
the goal it serves before the Goals module is installed, and nothing here
changes when it lands.

## Nothing is guarded

Capturing, scoring and moving an idea are all reversible by doing the opposite,
and none of it spends money or makes a commitment. Killing one keeps the row.
