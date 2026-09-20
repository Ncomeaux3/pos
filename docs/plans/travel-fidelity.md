# Travel to the artboard

Superseded for styling on 2026-09-19 by the Holon redesign (docs/plans/holon-product-redesign.md, section 4): colour, type, radii, surfaces and control shapes now come from the Holon design contract and the shared components in `components/pos/`. This plan still governs what each screen shows and how it is laid out.


## Context

Screen five of the fidelity pass (method: docs/plans/weekly-review-fidelity.md). `POS Travel.dc.html` captured at 1440 (page at 1500 tall, the drawer's four tabs, light) into `/private/tmp/pos-handoff-sources/travel/`. This screen is further from the artboard than the last four: the app has page tabs (Trips, Map, Inbox, Loyalty), a wireframe globe, trip cards of another shape, an inline three-card drawer, no wishlist section, no loyalty strip, one budget figure per trip, and no way to add or remove itinerary, packing or budget rows from the screen.

The artboard: a 56px band (crumb, scoped search, "2 upcoming · 13 nights away" with a dot); a loyalty strip of program cells with balance and delta and "Manage →" on the last; the title block with "Add to wishlist" and "New trip →"; a globe card (dotted land, pins by status, legend, + − ⟲ FLAT controls, an alert band top right); Upcoming as 2-up cards; Past and Wishlist side by side; a 560px Trip drawer with Itinerary, Budget, Packing and Inbox tabs, an Edit details button, a status pill, and a footer with "Delete trip"; the same drawer in form mode for New trip, Add to wishlist and Edit details.

Decisions with Nick (append to `decisions/log.md`):
- Land is a committed point list sampled once from the world atlas; the hand-rolled projection draws it. No d3, no CDN (the 2026-09-07 decision stands).
- The page tabs go. Loyalty lives in the strip, with the balance inputs and the cents-per-point calculator behind "Manage →" in a drawer; parsed bookings are approved in the trip drawer's Inbox tab; the map is the globe on the page.
- Budget lines per trip (`travel.budget_line`, planned per category) with actuals summed from confirmed itinerary items by kind; the artboard's line about Finance transactions is not written.
- The alert band shows an unread travel notification from `core.notifications` when there is one and nothing otherwise; the Packing tab's agent box and "Suggest items" are left out.
- Not drawn because the app has no source: the HOME pin (no home coordinates exist), the "Check-in reminders: 48h + 24h" footer line unless `core.notification_rules` has such a rule (verify; if it does, name it truthfully), loyalty deltas until a second balance has been entered (a `previous_balance` column makes the delta true from the second edit on).
- The wishlist is trips with status `idea`; "Plan" sets `planned`, "✕" deletes the idea. "Why · when" is the trip's `notes`.

## Artboard measurements (POS Travel.dc.html lines 29 to 146, logic 147 to 230)

Band: eyebrow "Travel / Trips"; compact search "Search travel" (160 to 320); right, an eyebrow with a dot: "{n} upcoming · {nights} nights away" (nights = sum of upcoming trips' nights; dot accent).

Loyalty strip: full width under the band, `repeat(auto-fit, minmax(150px, 1fr))`, 1px `--rule` gaps and bottom rule, cells `padding 10px 20px` on `--bg`: 11px `--ink-3` program name (the last cell also "Manage →" in `--ink-4` on the right), 14px mono balance with a 10px delta in green or red.

Title block: `padding 20px 28px 0`, h1 28px, lede 13px `--ink-3` `margin-top 8`: "Upcoming trips in green, past in grey, wishlist dotted. Drag to rotate, scroll to zoom, double-click to fly in. Hover a pin for details." (the trailing sentence about forwarding to trips@pos.local only if the app has that address; it does not: omit). Right: "Add to wishlist" ghost (12px, `padding 8px 12px`, 1px `--rule-2`, `--ink-3`) and "New trip →" as the DS button.

Globe card: `margin 18px 28px 0`, 1px `--rule` on `--bg-elev`, `height clamp(240px, 38vh, 420px)`. Legend bottom left (10px 0.06em `--ink-3`, gap 14): 8px accent dot UPCOMING, 7px `--ink-3` dot PAST, 7px dashed `--ink-2` ring WISHLIST, 7px `--ink` square HOME (omitted). Controls bottom right, gap 4: + − ⟲ as 26px mini buttons and FLAT / GLOBE wider. Alert top right: `max-width min(360px, 70%)`, 1px amber, `padding 8px 12px`, "ALERT" 9px amber, 12px text, ✕. Pins: upcoming accent with an uppercase 9px label, past `--ink-3`, wishlist dashed ring; hover a pin for a title.

Sections: `padding 18px 28px 28px`, gap 20. Section head: 15px title, 11px mono `--ink-3` meta, `padding-bottom 8`, `border-bottom --rule-2`, then 12px (Upcoming) or 6px (lists).
- Upcoming cards: `auto-fill minmax(min(100%, 280px), 1fr)`, gap 14; card 1px `--rule` on `--bg-elev`, `padding 16px 18px`, hover lifts 2px on `--rule-2`: 16px name, 12px `--ink-3` "Nov 5 – Nov 14 · 9 nights", right "55" 18px/300 accent with a 10px " d"; `margin-top 14` four 3px segments (flight, lodging, transit, activity: coloured accent / `--ink-2` / `--ink-3` / amber when the trip has a confirmed item of that kind, `--bg-elev` otherwise) with 1px `--rule` gaps; `margin-top 8` 11px `--ink-3` "4/4 booked · 2 in inbox" and "$3,070 / $4,800"; then `margin-top 10; padding-top 10; border-top --rule` 12px "Next · " (`--ink-4`) plus the step: "Approve N parsed bookings" when the inbox has pending items, else "Book lodging" when no lodging is confirmed, else "Pack · N items left", else nothing.
- Past: rows `1fr auto`, `padding 10px 0`, rule under: 13px name, 11px `--ink-3` "Oct 17 – Oct 26 2025 · 9 nights", 12px mono `--ink-3` spent. Meta "3 trips · $6,590 total".
- Wishlist: rows as Past with the note under the name and Plan (11px, `padding 4px 9px`, accent border) and ✕ mini buttons. Meta "3 places".

Trip drawer: 560px (the shared Overlay with a `wide` option), band crumb "Travel / Tokyo · November" and the shared close. Head `padding 20px 24px 0`: h2 22px/400, 12px `--ink-3` "Tokyo · Nov 5 – Nov 14 · 9 nights · 2 travelers", right "Edit details" mini and a 9px status pill in its colour. Tabs `margin-top 14`, rule under: Itinerary, Budget, Packing, Inbox (amber 9px count). Body `padding 18px 24px`, gap 16.
- Itinerary: per day a head (13px "Day 1", 10px mono date, `padding-bottom 6`, `--rule-2`), rows `44px 1fr auto`, `padding 8px 0`: 10px mono time, 13px title with 11px `--ink-3` detail, 9px kind in its colour and a ✕; "Free day" 12px `--ink-4` for a day with nothing; an add field "Add: day 2 19:30 Dinner at Narisawa" parsed as day, time, title, plus Add. Clicking a title edits it inline (time, title, kind, day, detail).
- Budget: three cells (Planned · total as an editable 18px figure, Committed, Remaining); a header CATEGORY ACTUAL PLANNED; rows `1fr 90px 90px 20px`, `padding 8px 0`: name, actual (the summed figure, or an override you type), planned input, ✕; a 3px bar under each; "Add a category, e.g. Gifts 200" parsed as name and planned; no Finance line.
- Packing: "Packing list" with "3 / 8 packed"; a two-column list (`auto-fill minmax(200px, 1fr)`, gap 0 20px) of rows with a 14px box, the label struck when packed, and ✕; "Add an item" plus Add.
- Inbox: the sentence "Confirmation emails are parsed into itinerary items. Approve to add; nothing is added without you." (without the address); cards 1px `--rule` `padding 12px 14px`: 11px `--ink-3` source, 9px status right, 13px parsed line, 11px detail with "confidence 94%", Add / Dismiss minis; "Inbox is clear" dashed box.
- Footer `padding 14px 24px; border-top`: the reminders line if true, "Delete trip" 12px `--ink-3` (red on hover) which asks first.
- Form mode (New trip, Add to wishlist, Edit details): `padding 22px 24px`, gap 14: Name, Destination (text plus lat/lon from the places the app knows, or typed), for a trip Depart / Return / Budget / Travelers in a 2 by 2 grid, for a wish "Why · when"; footer Cancel and the DS Save button.

Loyalty drawer (Manage →): the programs as rows with an editable balance (the existing `saveLoyalty`), then the cents-per-point calculator as it is today.

## Files

- `scripts/land-dots.mts` (new, dev only): fetches `world-atlas@2/land-110m.json` once, decodes the topology's arcs, samples a lat/lon grid (2° apart, denser toward the equator by cos(lat)) with point-in-polygon, writes `modules/travel/land.json` as `[[lat, lon], ...]` rounded to one decimal. Natural Earth is public domain; the file is committed, the script is not run at build.
- `modules/travel/globe.ts`: project a point in globe and flat (equirectangular) modes at a zoom; `modules/travel/ui/Globe.tsx`: land dots, pins by status with labels, zoom, reset, flat toggle, hover title, the legend and the alert slot.
- `supabase/migrations/<ts>_travel_budget_lines.sql`: `travel.budget_line (id, trip_id, category, planned_cents, actual_override_cents null, position)`; `alter table travel.loyalty_program add previous_balance int`.
- `modules/travel/manifest.ts`: tools `write_budget_line`, `delete_budget_line`, `write_packing` (add, toggle, remove), `delete_item`, `delete_trip` (guarded); `set_loyalty` keeps the previous balance. `modules/travel/data.ts`: `listBudgetLines`, upcoming nights, per-trip inbox counts (exists as `pending_count`).
- `modules/travel/ui/actions.ts`: the actions over those tools; `modules/travel/ui/Travel.tsx` and `TravelPage.tsx`: the page; `modules/travel/ui/TripDrawer.tsx` (new): the drawer and its form mode; `modules/travel/ui/LoyaltyDrawer.tsx` (new).
- `components/pos/Overlay.tsx`: `wide` prop (560px).
- `e2e/screens.spec.ts`: the four travel tests reworked; `e2e/seed.mts` if a budget line or a travel notification is needed for the shots (seed one alert through the module's own notification path if it has one; otherwise the band is simply absent in the fixture).

## Tasks

### Task 0: Baseline
Plan to `docs/plans/travel-fidelity.md`, decisions logged. Failing e2e asserts in `travel, trips with confirmed spend only` (desktop): no tablist; a loyalty strip with a "Manage" link; the section heads "Upcoming", "Past", "Wishlist"; an upcoming card whose text matches `/\d+\/4 booked/`; the globe has `+`, `−`, `⟲` and `Flat` controls; the drawer opens from a card to a "Budget" tab that shows "Planned · total".

### Task 1: The globe
1. `scripts/land-dots.mts` run once; commit `modules/travel/land.json` (target under 60 KB). A unit test asserts a few known points are land (Denver, Tokyo) and sea (mid Pacific) using the same point-in-polygon helper exported from the script's module, or simply asserts the committed list's size and bounds.
2. `globe.ts`: `project(lat, lon, view)` for `mode: 'globe' | 'flat'`, `zoom`, `rotation`; a test for the equator at zoom 1 in both modes.
3. `Globe.tsx`: dots (1.2px, `--ink-4` at 0.9), pins by status, labels for upcoming, drag to rotate (globe) or pan (flat), wheel and buttons to zoom, ⟲ resets, FLAT/GLOBE toggles, double-click flies to the pin under the cursor; the legend; an `alert` slot rendered top right.
   Check: unit tests; the globe test in e2e updated to count visible dots and pins. Commit: `feat: the travel globe draws the land and the artboard's controls`.

### Task 2: Data and tools
Migration applied locally with `supabase migration up --local < /dev/null` (write the file by hand; `migration new` hangs off a TTY). Tools and actions listed above, each with zod input; `write_packing` and `delete_item` unguarded (the owner's own rows; an agent's item is already pending), `delete_trip` guarded. `set_loyalty` copies the old balance into `previous_balance`. Data functions for budget lines and the summed actuals by kind.
   Check: `pnpm test` (a test on the actuals-by-kind reducer, pure). Commit: `feat: travel budget lines, packing and delete tools`.

### Task 3: The page
Band summary, loyalty strip, title block with the two buttons, globe card with legend, controls and alert, Upcoming cards (segments, meta, next step by the artboard's rule), Past, Wishlist with Plan and ✕. The page tabs and the inline drawer go; `?trip=` still opens the drawer.
   Check: Task 0 asserts pass; side by side. Commit: `fix: travel page to the artboard`.

### Task 4: The drawers
`TripDrawer` with the four tabs, Edit details, Delete trip, the form mode for New trip / Add to wishlist / Edit details (destination coordinates from a typed lat/lon pair or a known place; a trip without coordinates draws no pin); `LoyaltyDrawer` behind Manage →. Overlay `wide`.
   Check: e2e: open Tokyo, the four tabs render, add a packing item and see "N / M packed" change, add a budget category, approve the parsed booking from the Inbox tab (replaces the old inbox test), the calculator test moves to the loyalty drawer. Commit: `feat: the trip drawer and the loyalty drawer to the artboard`.

### Task 5: Proof
`--grep "travel"` both widths; typecheck, lint, unit, full e2e. Pairs: page dark and light, the four drawer tabs. Phone against the shell rules. STATUS.md. Commit: `docs: travel fidelity pass`.

## Out of scope
- A fare watch, a packing suggester, a home location, forwarding bookings by email: no source in the app; each is its own feature.
- Finance transactions tagged to a trip.
- Other screens.
