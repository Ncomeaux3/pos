# Travel globe: filled land, level home, pin taps, city geocoding

Three phases, each its own branch and PR. Phase 1 is the biggest. Nick builds one phase per session.
First task of Phase 1: log the decisions listed at the end in `decisions/log.md`.

## Context

The Travel screen's globe (`modules/travel/ui/Globe.tsx`, math in `modules/travel/globe.ts`) is a hand-rolled orthographic SVG. The continents are 4,859 dots (`modules/travel/land.json`, sampled once from Natural Earth by `scripts/land-dots.mts`). Nick's four asks, with answers from the clarifying rounds:

1. **More realistic, more definition.** Chosen: filled continents as vectors from the same Natural Earth 110m data, plus country borders, a lit-sphere gradient, a keep of the 30 degree grid, and an ocean tint. No photo texture, no three.js, no new dependency. This departs from the artboard's dot matrix (decision 2026-09-11) by the owner's choice; it keeps the 2026-09-07 rule that d3-geo, topojson and world-atlas stay out of the bundle and nothing loads from a CDN at runtime.
2. **Open level and centred on the US.** Today `home()` (`Globe.tsx:61-66`) centres on the next upcoming trip and tilts to its latitude. Chosen: always centre on the continental US at 98 W with no tilt, and reset goes there too.
3. **Tapping a pin opens the item.** The code already routes a pin click to the trip drawer or place drawer (`modules/travel/ui/Travel.tsx:229-236`) and a desktop e2e proves it. Nick sees nothing happen or the globe turn instead. The pin is an 8 px circle and any pointer movement starts a rotation, so the fix is a bigger hit area and a drag threshold, after reproducing it first.
4. **Typing a city fills Lat and Lon** in the New trip, Add to wishlist and Edit details form (`modules/travel/ui/TripDrawer.tsx:690-702`, three plain inputs today). Chosen: Open-Meteo geocoding, suggestions while typing, picking one fills Destination, Lat and Lon. Lat and Lon stay editable so a typed value wins.

Endpoint verified 2026-09-13 from the Open-Meteo docs page: `GET https://geocoding-api.open-meteo.com/v1/search?name=<q>&count=5&language=en`. Two or more characters required (two match exactly, three or more prefix match). Result fields used: `name, latitude, longitude, country, admin1`. Attribution "Location data based on GeoNames". The page separates non-commercial and commercial use; rate limits were not on the page (verify in the Phase 3 research note).

## Platform concerns

- **Bundle size.** The rings file replaces `land.json` (56 KB) and is imported by the client. Estimate 140 to 200 KB at one decimal place (about 11 km, coarser than the 110m data itself). Cap: 200 KB, asserted by a test. Vercel serves it gzipped; a coordinate list compresses to roughly a third.
- **Per-frame work.** Today 4,859 points are projected on every drag frame. Rings are roughly 10k vertices (verify at generation). Same order; no memoisation added unless the ui-verifier run shows dropped frames on the phone viewport.
- **Horizon clipping is the one hard piece.** A filled polygon that straddles the edge of the sphere must be cut at the horizon, or a chord draws through the globe. Solved in pure math in `globe.ts` (below), tested before the renderer uses it.
- **Flat mode.** Filled rings cannot wrap the antimeridian one point at a time the way the dots did. The flat land is drawn once at zero pan and shifted with a transform, with two extra copies so the seam is covered, all inside a clip rect.
- **Themes.** Land, ocean and border colours come from tokens in `app/globals.css` and must read in both themes. There is no blue token; the ocean tint is `color-mix` of `--accent` into `--bg-deep`.
- **Vercel runtime fetch.** Geocoding is a server action in the module calling Open-Meteo with `AbortSignal.timeout`, the same shape as `integrations/resend/manifest.ts`. No key, so nothing in `core.connections` or `.env`. Not an integration folder: the integration contract only knows token, oauth2 and webhook auth.
- **Phone.** The suggestion list is a native `<datalist>` (iOS Safari 12.2+ supports it). Pin hit areas are sized for a finger.
- **e2e.** `e2e/screens.spec.ts:1824-1883` asserts the land path has more than 500 `M` commands and clicks the first past pin. Both change; the seeded past places Lisbon, Mexico City, Austin and Vancouver are on the near side of a US-centred globe, so a past pin is still clickable.

## Phase 1: filled continents, borders, shading, level home

Branch `travel-globe-land`. Complexity medium. Model Opus.

### 1.1 Rings data

- `scripts/land-dots-lib.ts`: keep `decodeTopology` and `pointInRings`, delete `sampleLand` (unused after this phase). Widen `Topology.objects` to accept a `countries` object as well as `land`.
- Rename `scripts/land-dots.mts` to `scripts/land-rings.mts`. It fetches `https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json` (or a local path), decodes to rings, rounds each `[lon, lat]` to one decimal, drops consecutive duplicates, and writes `modules/travel/land.json` as `Ring[]` (a flat list of rings, country identity not kept). Prints ring count, vertex count, bytes, and the Denver check as today. Countries rather than land because filling every country polygon and stroking it gives coastline plus borders from one file and one path.
- `scripts/land-dots.test.ts` becomes `scripts/land-rings.test.ts`: every ring closed and inside the world; file under 200 KB; Denver and Tokyo inside some ring, a mid-Pacific point in none (`pointInRings`); more than 150 rings.
- Antarctica stays in (it fills cleanly as a cap; the dot sampler had skipped it only because dots at the pole looked wrong).

Verify: `pnpm exec tsx scripts/land-rings.mts` prints counts; `pnpm test scripts/land-rings`.

### 1.2 Horizon clipping in `modules/travel/globe.ts`

New export `ringPath(ring: Ring, rotation: Rotation): string` and `landPath(rings, rotation, mode)` replaces the dot version. Algorithm, all in existing terms (`project`, `visible`):

1. Compute each vertex's near-side test (`visible`) and projected point.
2. Sutherland-Hodgman against the horizon: walk edges; both visible emit the end; visible to hidden emit the crossing; hidden to visible emit the crossing then the end; both hidden emit nothing. The crossing is found by linear interpolation of the two 3D unit vectors at the point where z crosses zero, normalised, then projected (at 110m spacing this is within a pixel of the great-circle intersection).
3. Each edge that joins an exit crossing to the next entry crossing is written as an SVG arc `A 1 1 0 <large> <sweep> x y` along the unit circle instead of a straight line. Sweep follows the polygon's winding on screen (sign of the shoelace area of the clipped polygon): the horizon arc continues in the same rotational direction as the ring, which keeps the interior on the same side. Large-arc flag from the angle between the two crossing points measured in that direction.
4. No visible vertex: empty string. Path closes with `Z`. Rendered with `fillRule="evenodd"` so lakes and enclaves work regardless of ring direction.

Flat mode: `flat()` is called with `lambda: 0` for land only; the pan is a transform in the renderer (1.3).

Tests in `modules/travel/globe.test.ts`, written first:
- a small ring fully on the near side: `M`, `L`s, `Z`, no `A`
- the same ring rotated to the far side: `''`
- a ring straddling the horizon: exactly one `A`, every emitted point within the unit circle (norm <= 1 + 1e-9), no `NaN`
- the same ring with reversed winding: the `A` sweep flag flips
- a ring with a run of vertices at latitude -90 viewed at `phi: 0`: well formed, no `NaN`

### 1.3 Renderer `modules/travel/ui/Globe.tsx`

- `home()` returns `{ lambda: 98, phi: 0 }` always; the `pins` argument to it goes. Reset unchanged (it calls `home()`).
- Globe mode layers, in order inside the existing transform group: ocean circle (`fill: color-mix(in srgb, var(--accent) 18%, var(--bg-deep))`), graticule (kept), land path (`data-land`, `fill="var(--ink-4)"`, `stroke="var(--ink-3)"`, `strokeWidth 0.6`, `vectorEffect="non-scaling-stroke"`, `fillRule="evenodd"`), then the lit-sphere overlay: one `<circle r={R}>` filled with a `radialGradient` centred at 35%/35%, transparent to `--bg-deep` at 55% opacity at the rim, `pointer-events: none`; then a rim glow: `<circle r={R + 5}>` with a radial gradient transparent inside R, `--accent` at 25% at R, transparent at the outer edge. Exact stops are the builder's call against the ui-verifier screenshots; the constraint is tokens only and readable in light mode.
- Flat mode: `<clipPath>` of the map rect; ocean rect; `<path id="flat-land">` built with `lambda: 0`; three references (`<use href="#flat-land">` at x offsets `-4R`, `0`, `+4R`) inside a `<g transform="translate(lambda / 180 * 2R)">`. Pins keep using `flat(lon, lat, rotation)` as today; the result lines up because both are the same shift.
- Pins, labels, controls, legend, alert: unchanged in this phase.
- Update the header comment (no longer a dot matrix).

### 1.4 Docs and tests

- `modules/travel/README.md` section "The globe is hand rolled": rewrite to say the land is committed rings from Natural Earth countries, filled and clipped at the horizon in `globe.ts`, still with no d3. Drop the stale "graticule instead of coastlines" sentence.
- `docs/STATUS.md` travel lines 333 to 350: update the globe description.
- `e2e/screens.spec.ts` globe test: replace the "more than 500 `M`" assertion with: `[data-land]` `d` contains `Z` more than 100 times and contains at least one `A`; add: the globe opens with a US pin visible (Austin's title in `[data-pin="past"]` list) and `[data-land]` `d` unchanged before and after a Reset click that follows a drag (proves reset returns home).
- Run `ui-verifier` at 402 and 1440, both themes, globe and flat, zoom 1 and 4.

Verify: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm test:e2e` travel tests, ui-verifier screenshots, `spec-reviewer` before the PR.

## Phase 2: pin tap opens the item

Branch `travel-globe-tap`. Complexity low. Model Opus (the repro step needs judgement); the edits alone are quick-builder sized.

### 2.1 Reproduce first

Playwright at 402 px with `hasTouch`, tap the first past pin's centre with `page.touchscreen.tap`, record whether `?place=` or `?trip=` lands in the URL. Then tap 6 px off centre. Then tap and move 3 px. Write the result into the PR description. If the centre tap already works, the fix is the hit area and the threshold; if it does not, debug before editing (systematic-debugging skill).

### 2.2 Fix in `Globe.tsx`

- Each pin group gets a first child `<circle r={12 / zoom} fill="transparent" />` so the target is 24 px on screen at every zoom. Keep the visible circle as it is.
- Drag threshold: on pointer down record the start; in `move`, only start rotating once the pointer has travelled 4 px (client) from the start; set a `dragged` ref. In the pin `onClick`, return early when `dragged` is set. Clear it on pointer down. Double-click to fly stays.
- Labels are inside the group already, so they are clickable once the group is.
- Copy at `Travel.tsx:208-209`: "Drag to rotate, scroll to zoom, tap a pin to open it, double-click to fly in."

### 2.3 Tests

- e2e (both viewports): tap or click the hit circle of a past pin opens the place or trip dialog; a 40 px drag that starts on a pin does not open it and the URL has no `place=`.
- Existing drag assertion (40 px) still passes the threshold.

Verify: `pnpm test:e2e` travel, ui-verifier at 402 with a tap recorded, spec-reviewer.

## Phase 3: destination geocoding

Branch `travel-geocode`. Complexity medium. Model Opus.

### 3.1 Research note

`/research` Open-Meteo geocoding into `docs/research/open-meteo-geocoding.md`: terms for non-commercial use, any daily or per-second limit, attribution wording, response shape. Log the decision. If the terms turn out unfit, stop and say so; Nominatim is the fallback and the plan below changes only `geocode.ts`.

### 3.2 `modules/travel/geocode.ts`

`geocode(query: string): Promise<Hit[]>` with `Hit = { label: string; lat: number; lon: number }`, `label` as "Austin, Texas, United States" (name, admin1 when present, country). Returns `[]` for fewer than 2 characters without a request. Fetches `https://geocoding-api.open-meteo.com/v1/search?name=<encoded>&count=5&language=en` with `AbortSignal.timeout(5_000)`; any failure returns `[]` so a form never blocks on the geocoder. Parsing is in a pure `toHits(json)` so the test needs no network.

Test `modules/travel/geocode.test.ts`: `toHits` builds labels with and without `admin1`, drops results missing coordinates, `geocode('a')` makes no request.

### 3.3 Server action and form

- `modules/travel/ui/actions.ts`: `suggestPlaces(query)` server action that calls `geocode` and returns hits. Small and unguarded: it spends no money and writes nothing.
- `modules/travel/ui/TripDrawer.tsx` form: the Destination input gets `list="destination-hits"` and a `<datalist>` under it. Typing debounces 300 ms, then calls `suggestPlaces` and stores the hits. On change, if the input value equals a hit's label, set `destination` to the hit's name-only form and `lat`/`lon` from the hit; otherwise leave lat and lon alone. Lat and Lon remain the inputs they are, so a typed number wins and nothing overwrites a value the owner changed after picking.
- Placeholder for Destination becomes "City, country".
- Attribution: a one-line "Location search by Open-Meteo and GeoNames" in the form footer in `--ink-3`.

### 3.4 Tests

- e2e: in New trip, type "Austin" into Destination; with the server action stubbed by `page.route` to a fixed JSON, the datalist has an "Austin, Texas, United States" option; selecting it fills Lat and Lon with the stub's values.
- Manual: real request once in dev, noted in the PR.

Verify: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm test:e2e` travel, ui-verifier of the form at 402 and 1440, spec-reviewer.

## Decisions to log (Phase 1 opens the branch and logs all three)

1. 2026-09-13 | The globe's land is filled Natural Earth country polygons, committed as rings and clipped at the horizon in `globe.ts`, with borders, a lit-sphere gradient and an ocean tint | the owner found the dot matrix hard to read; the 2026-09-11 dot decision is superseded on the artboard point only, and the no-d3, no-CDN rule holds | Rejected: a photo texture on canvas or three.js (a 1 MB asset and a new dependency), denser dots.
2. 2026-09-13 | The globe opens and resets centred on the continental US at 98 W with no tilt | the tilt toward the next trip's latitude read as a broken start | Rejected: centring on the next trip level; a stored home place.
3. 2026-09-13 (Phase 3) | City coordinates come from Open-Meteo geocoding, called from a server action in the travel module with no key, shown as a native datalist | no account and no secret means no integration folder; suggestions let the owner disambiguate Paris | Rejected: Nominatim (1 request per second policy), a bundled 1 MB GeoNames list.

## Out of scope, reported as follow-ups

- `modules/travel/README.md` still says "graticule instead of coastlines" (fixed as part of 1.4 since that section is being rewritten anyway; noted here so it is not mistaken for scope creep).
- Geocoding for `place_visited` rows and itinerary items: not asked; only the trip and wishlist form gets it.
- Auto-fill from the trip name ("Tokyo · November"): not asked; Destination is the field.
