# Travel

Trips, what they cost, where you have been, and the one calculation SPEC asks
for. Screen 13 of the design bundle.

## The globe is hand rolled

The plan budgeted for `d3-geo`, `topojson-client` and a world-atlas file, which
together buy country outlines and cost about 100kB of download.

`globe.ts` is an orthographic projection in about forty lines, tested, with a
lat/lon graticule instead of coastlines. The dots are the information and the
sphere is context for them, so the trade was easy. If coastlines ever matter,
`project()` is exactly the function d3 would be replacing, and the note in that
file says so.

Two things the test pins that are easy to get wrong:

**Visibility.** A point on the far side of the sphere must not be drawn, or the
back of the world shows through the front. The test uses the exact silhouette
as a case, because a point at `z = 0` that flickered would be worse than one
consistently on either side.

**Line breaking.** A grid line that passes behind the globe is broken rather
than joined. Connecting where it disappears to where it returns draws a chord
straight through the middle, which is the single artefact that makes a
wireframe look broken rather than sparse. It only happens when the rotation puts
the antimeridian in view, which is what the test rotates to.

## Cents per point

`centsPerPoint(cash, points, fees)`. Both numbers come from the owner.

SPEC is explicit that loyalty sites are not scraped, so nothing here knows what
a point is worth and nothing pretends to. The screen offers 1.5 cents as a rule
of thumb and is clear that the answer is only as good as the two numbers put in.

Loyalty balances are typed by hand, and the row shows when **you** last updated
it rather than implying anything fetched it.

## Two review gates, same shape

A booking parsed from an email arrives as `status = 'pending'` with a
confidence, and waits in the inbox. A machine reading a confirmation is
proposing, not deciding; this is the same shape as the Second Brain draft and
the Tasks review column, for the same reason.

Only **confirmed** spend counts against a trip budget. A pending booking is a
guess about an email, and a budget moved by a guess is a number that stops being
trusted.

That is also why `write_item` is unguarded while `write_trip` is guarded: an
agent-added item already lands in the inbox, so guarding it too would put one
decision behind two approvals. A trip is a commitment with a budget attached.

## Places outlive trips

`place_visited` is its own table, and `complete_trips` writes one when a booked
trip's end date passes. The map is a record of where you have been, and it
should not empty out because a trip was archived.
