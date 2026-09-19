# Setting up the integrations

What each external account needs from you, and what it buys once connected.

Credentials go in on **Settings > Connections**, never in `.env`. They are
encrypted with `ENCRYPTION_KEY` and stored in `core.connections`. The one
exception is OAuth *client* credentials like `STRAVA_CLIENT_ID`, which identify
the app rather than the account and live in `.env` with the other
infrastructure secrets.

Every card runs its own Test on save and tells you what it saw.

## Where each one stands

| Provider | Auth | Cost | State |
|---|---|---|---|
| Anthropic | token | pay as you go, cents | Connected |
| Voyage | token | free tier | Connected, 3 req/min without a card |
| Resend | token | free | Connected |
| **Strava** | oauth2 | Strava subscription ($11.99/mo since June 2026, to create an API app) | **Client and sync job built. Deferred by the owner 2026-09-13; Apple Health covers watch workouts.** |
| **Obsidian vault** | token | free | **Client built. Needs a repo and a token.** |
| **SimpleFIN** | token | ~$1.50/mo | **Client, real Test and nightly sync built. Needs a bridge subscription.** |
| **Health Auto Export** | webhook | paid iOS app | **Webhook writes workouts and sixteen body metrics. Needs the app and one paste.** |
| **Apple Health (Shortcuts)** | webhook | free | **Readings from an iOS Shortcut you build once; workouts need Health Auto Export. Recipe below.** |

Everything in bold has a client and a real Test button. None of them is
connected, because each needs an account only you have.

---

## Strava

**Buys you:** every workout, synced nightly into Fitness. Workouts emit
`workout_logged`, which earns Health XP on the Skill Tree and moves any fitness
goal with a metric source. Until this is connected, Fitness only holds what you
type in.

Strava's API is free. The rate limits are generous for one person: 200 requests
every 15 minutes, 2,000 a day. The nightly sync uses one.

### Register the app

1. Go to [strava.com/settings/api](https://www.strava.com/settings/api) while
   logged into your Strava account.
2. Create an application:
   - **Application Name**: `POS` (only you ever see it)
   - **Category**: Other
   - **Website**: your Vercel URL, or `http://localhost:3000` for now
   - **Authorization Callback Domain**: this one matters. Enter the bare
     domain with **no scheme and no path**: `your-app.vercel.app`, or
     `localhost` while developing. Strava rejects the OAuth redirect if this
     does not match the host it is sent to.
3. Copy the **Client ID** and **Client Secret**.

### Wire it in

Add both to `.env` locally and to Vercel's environment:

```
STRAVA_CLIENT_ID=12345
STRAVA_CLIENT_SECRET=...
```

These are not account credentials, so they do not go on the Connections page.
They identify the application to Strava; the token that identifies *you* is what
the OAuth flow fetches and stores encrypted.

Restart the dev server so it picks up the new variables.

### Connect

Settings > Connections > Strava > **Connect**. You go to Strava, approve
`activity:read_all` and `profile:read_all`, and come back. The Test button then
calls `/athlete` and should say `Connected as <your name>`.

If it says the token was rejected, the callback domain in step 2 does not match
the host you are on.

### What happens next

The nightly run calls `fitness.sync_strava` before the digest. On the first run
it asks for a year of activities; after that it asks from the newest workout it
already has, minus a 48 hour overlap so an activity you upload late is not
missed between two runs.

Workouts upsert on `(source, external_id)`, so re-running corrects a renamed
activity rather than duplicating it. Anything you typed in by hand carries
`source = 'manual'` and is never touched.

Strava has around forty sport types and the `kind` column allows six, so
anything unrecognised lands on `other`. A windsurf is still a workout.

Access tokens last six hours. The nightly pass refreshes before any module sync,
using the refresh token, so you do not have to think about it.

---

## Obsidian vault

**Buys you:** the biggest single unlock in the app. Second Brain currently has
the draft-and-approve review step built and nothing to review, because the vault
is the source of truth and nothing reads it yet.

**Read only, by construction.** `integrations/github_vault/client.ts` has no
write path. That is how SPEC's "the app never edits the vault without a review
step" is enforced: not by a convention, but by there being no function to call.
When Second Brain proposes a commit, that goes through `core.proposals` and a
separate call that does not exist yet.

### Put the vault in a private repo

If it is not already:

```bash
cd /path/to/your/vault
git init
gh repo create obsidian-vault --private --source=. --push
```

Private matters. The Test button tells you if the repo is public, because a
vault should not be.

### Make a token

1. [github.com/settings/personal-access-tokens](https://github.com/settings/personal-access-tokens)
   > **Generate new token** > Fine-grained.
2. **Repository access**: Only select repositories, and pick the vault. Not "all
   repositories". This token should reach one repo and nothing else.
3. **Permissions**: Repository permissions > **Contents: Read-only**. That is
   the only one needed. Do not grant write; the client cannot use it and a token
   that can write to your notes is a worse thing to lose.
4. **Expiration**: your call. A token that expires is one you have to
   remember to replace; the Test button will tell you clearly when it has.

### Connect

Settings > Connections > Obsidian vault:

- **Repository**: `yourname/obsidian-vault`. A pasted browser URL or a clone URL
  works too, the client normalises all three.
- **Personal access token**: the `github_pat_...` string.

Test reads the repo and counts the markdown in it. A good result looks like
`yourname/obsidian-vault (private), 412 markdown files on main.`

If it says not found, that is GitHub's answer for both "wrong name" and "token
cannot see it". The API returns 404 for a private repo it cannot reach rather
than 403, so the message does not guess between them. Check the repo name first,
then that the token's repository access includes it.

### What happens next

`brain.pull_vault` runs nightly, first in the module's order. It lists every
markdown file in one request and reads only the ones whose git blob sha has
moved, so a settled vault costs one request a night and writes nothing.

A pulled note is **published**, not a draft: it is already in the vault, so it
is already yours. The draft state is for the other direction. Wikilinks are
parsed and resolved on the way in, so `[[DDIA]]` in one note finds the note it
points at, and a link to a note you have not written yet is kept as the useful
backlog it is.

Two things it deliberately refuses to do:

- **It never deletes.** A note whose file has gone is counted and reported, not
  removed. A rename or an accidental delete should not take your note with it.
- **It awards no XP for the backfill.** Notes register for search but emit no
  event, because four hundred notes written over five years are not four hundred
  notes of work tonight.

The first pull reads at most 300 files, so a large vault fills over a few
nights against GitHub's hourly limit. Every later run has almost nothing to do.

**Still missing, honestly:** SPEC also asks for URL and YouTube ingestion with a
model-drafted summary. The inbox, the draft state and the review step are all
built; the fetching is not.

---

## SimpleFIN Bridge

**Buys you:** balances and transactions for every account, synced nightly. SPEC
calls Finance the highest daily value module and it currently runs on rows you
type in. This is the only paid integration, about $1.50 a month or $15 a year.

### Set up the bridge

1. Create an account at [bridge.simplefin.org](https://bridge.simplefin.org)
   and pay for it.
2. Connect your banks **on the bridge**, not in this app. The bridge is what
   holds your bank logins; POS never sees them and there is no write path in
   the protocol at all.
3. The bridge gives you a **setup token**, a long base64 string.

### Connect

Settings > Connections > SimpleFIN Bridge, paste the setup token, Connect.

**The token is claimed once and cannot be claimed again.** That is a property
of the protocol, not of this app, and it shapes how the field works: the claim
happens on save and the resulting access URL is what gets stored. Pressing Test
afterwards only reads, so it is safe to press as often as you like. If you
already have an access URL rather than a token, paste that instead and it is
kept as is.

Test asks for one day of data and lists what it found, so a good result names
your accounts. A `402` means the bridge subscription has lapsed, which is a
different problem from a wrong credential and says so.

### What happens next

`finance.sync_simplefin` runs first in the nightly order, before categorising,
subscription detection and the digest, because all three read what it wrote. The
first run asks for 90 days, enough history for recurring detection to have
something to work with. Later runs re-ask for 30, because a pending transaction
changes when it posts and the upsert corrects it in place.

Two things it deliberately refuses to do:

- **It skips any account that is not in USD**, and says which. `finance.account`
  has no currency column and net worth is a plain sum over cents, so a euro
  account would be added to a dollar one as though they were the same unit.
- **It never touches a transaction you categorised by hand.** The upsert carries
  `where is_manual = false`, and the category is not in the update list at all.

The account kind (checking, savings, credit) is guessed from the account name,
because the protocol has no type field. It is set on insert only, so if you
correct one it stays corrected. A wrong guess only affects grouping on the
screen; net worth is a plain sum either way.

---

## Health Auto Export

**Buys you:** workouts from Apple Health into `fitness.workout`, the same table
and XP the Strava sync writes to, plus sixteen daily readings into
`fitness.body_metric`: weight, resting heart rate, heart rate variability, body
fat, sleep, steps, active energy, exercise minutes, stand hours, VO2 max, blood
oxygen, respiratory rate, flights climbed, walking distance, walking heart rate
and average heart rate. Fitness > Body shows the readings, Fitness > Workouts
the workouts, and a goal with a body metric source moves on its own.

The app is a paid iOS app (healthyapps.dev). It reads Apple Health on the phone
and posts JSON to a URL you give it. Nothing pulls: there is no Apple Health
API to call from a server.

### Connect

1. **Settings > Connections > Health Auto Export**, Generate. The card shows
   the inbound URL and a secret, each with a Copy button.
2. In the app, **Automations > New > REST API**. Paste the URL. Add a header
   named `x-pos-secret` with the secret as its value (the app's REST automation
   supports custom headers, per its help pages). Format JSON.
3. Enable Workouts (export version 2, the app's recommended one; the legacy
   v1 shape has no id and writes nothing) and the metrics: Body Mass, Resting
   Heart Rate, Heart Rate Variability, Body Fat Percentage, Sleep Analysis,
   Step Count, Active Energy, Apple Exercise Time, Apple Stand Hour, VO2 Max,
   Blood Oxygen Saturation, Respiratory Rate, Flights Climbed, Walking +
   Running Distance, Walking Heart Rate Average, Heart Rate (the names as a
   real export sends them, checked 2026-09-18). Anything else is accepted and
   ignored.
4. Schedule daily, aggregated by day. Hourly buckets also work: a total such
   as steps is summed across the day's buckets, a level such as blood oxygen
   keeps the last reading. Run it once by hand.
5. Back on the card, Test. It reads "Last payload received {date}" once the
   first post has landed.

### Backfill history

The REST automation cannot send a custom date range: its periods stop at the
previous seven days (help.healthyapps.dev, checked 2026-09-18). Older data
comes from a manual export and one script run:

1. In the app, **Manual Export**: Custom range (say 2026-01-01 to today),
   Time Grouping Days, JSON, the same metrics and Workouts as the automation.
   Share the file to this machine (AirDrop, Files).
2. On the card, Reveal the secret, then:

   ```
   HAE_SECRET=<secret> pnpm exec tsx scripts/hae-backfill.mts ~/Downloads/<export>.json
   ```

   Add `--dry-run` first to see the requests without sending. The script posts
   one request per month plus the workouts twenty at a time, 1.5 s apart, so
   each stays under the function's body and time limits and the app's rate
   limit. It stops at the first non-200 and prints the body. Rows upsert, so
   running it twice is safe, and a workout earns its XP once.

   The export file goes anywhere among the flags, and a flag the script does
   not know stops it rather than being ignored, so a typed `--dryrun` cannot
   become a live post.

3. Before a first backfill, read the nights the export carries:

   ```
   pnpm exec tsx scripts/hae-backfill.mts ~/Downloads/<export>.json --sleep
   ```

   It sends nothing. One line per sleep point: the span, the hours the app
   summed, time in bed, and the minutes the webhook would store for that day.
   Two points under one date is worth knowing about, because the day keeps the
   last of them, so an afternoon nap can outrank the night it shares a date
   with. Nights over 12 hours are listed at the end with their point count: more
   than one point is the day keeping the wrong one, a single point is a span
   that really is that long.

### What happens next

Each post goes through `/api/integrations/health_auto_export/webhook`. The
secret is checked, the shape is validated, then the Fitness module upserts one
row per metric per day on `(kind, measured_on)`. A second post for the same day
corrects the first. A value you typed in by hand carries `source = 'manual'`
and is never touched.

Units are converted on the way in: pounds or kilograms to grams, miles or
kilometres to metres, percentages and VO2 max to tenths, hours of sleep and
exercise minutes to minutes. Sleep is dated by the morning it ended. The day is
the phone's local day, not UTC.

A workout upserts on the app's `id`, so a re-send corrects it and earns its
`workout_logged` XP once. Its kind comes from the workout name by the same
word rules the Strava sync uses (Running is a run, Cycling a ride, Traditional
Strength Training strength, Yoga other). Distance, average heart rate and
active energy are optional; routes and per-second series are not stored.

Sleep is the span from the app's `sleepStart` to `sleepEnd`, not its summed
hours: a source that writes overlapping records (Eight Sleep) makes the sum
two to three times the night. If a metric you enabled does not appear on
Fitness > Body, the row in `core.request_log` for the route will show the post
arrived, and the payload name needs matching to the table's kinds.

---

## Apple Health (Shortcuts)

**Buys you:** the same daily readings as Health Auto Export, for nothing,
from a Shortcut on the phone that runs itself every morning. Not workouts:
see below. Apple
Health can only be read by an app on the phone, and Shortcuts is the one Apple
ships that can read it and post JSON.

**Costs you:** twenty minutes once, tapping the Shortcut together. Add three
metrics first, run it, see them on Fitness > Body, then add the rest.

### What the Shortcut posts

```json
{ "day": "2026-09-13",
  "metrics": { "weight_lb": 185.2, "resting_hr": 52, "hrv_ms": 61,
               "body_fat_pct": 18.4, "sleep_hours": 7.5, "steps": 9412,
               "active_kcal": 613, "exercise_min": 42, "stand_hours": 11,
               "vo2_max": 41.3, "spo2_pct": 97.6, "resp_rate": 14.5,
               "flights": 12, "walk_mi": 4.2, "walking_hr": 98, "hr_avg": 71 },
  "workouts": [ { "name": "Running", "start": "2026-09-13T06:00:00-05:00",
                  "minutes": 30, "miles": 3.5, "kcal": 350, "avg_hr": 150 } ] }
```

Every key is optional. `weight_kg` and `walk_km` are accepted in place of the
imperial ones. Numbers may be text; a blank is skipped. A workout needs
`start` (ISO 8601 with offset, what Format Date writes) and `minutes`; the
rest is optional. The start instant is the workout's identity, so re-running
the Shortcut corrects rather than duplicates.

### Connect, tap by tap

A Shortcut cannot be pasted as text and Apple imports only shortcut files it
has signed, so it is built once by hand. Version 1 sends weight and steps;
once that lands, add metrics by repeating steps 2 and 3.

Before you start, in POS: **Settings > Connections > Apple Health
(Shortcuts) > Generate**. Leave the page open; you come back twice for COPY.

1. **Shortcuts > +**. Tap the name at the top, call it `POS Health`.
2. **Add Action**, search `Find Health Samples`.
   - Tap *All Health Samples*, choose **Body Mass**.
   - *Add Filter* > **Start Date** > **is today**.
   - *Show More*: **Unit** `lb`.
3. **+**, search `Calculate Statistics`. It should read "Calculate Maximum of
   Health Samples"; if it says Average, tap it and choose **Maximum**.
4. Repeat 2 and 3 for **Steps** (Start Date is today), with **Sum** in step 3.
5. **+**, search `Dictionary`.
   - *Add new item* > **Text**: key `day`. Value: tap the field, tap the
     **Current Date** variable above the keyboard, tap the inserted variable
     > *Format Date* > **Custom** > `yyyy-MM-dd`.
   - *Add new item* > **Dictionary**: key `metrics`. Inside it, two
     **Number** items: `weight_lb` with value *Select Variable* > the first
     **Statistics**; `steps` with value the second **Statistics**.
6. **+**, search `Get Contents of URL`.
   - URL: switch to POS, COPY the inbound URL, switch back, paste.
   - *Show More*. Method **POST**. Headers > *Add new header*: key
     `x-pos-secret`, value: switch to POS, REVEAL, COPY, switch back, paste.
   - Request Body: **JSON**, and make the body the whole Dictionary (tap the
     body, *Select Variable* > **Dictionary**). If your iOS only offers fields
     there, choose **File** as the body type instead and select the
     Dictionary variable. This control is the one that varies by iOS version.
7. **+**, search `Show Result`, input **Contents of URL**, so the reply shows.
8. **Done**, then run it. Allow Health access, every box. `{"ok":true}` means
   it landed; POS > Fitness > Body shows Weight and Steps for today.
9. **Automation tab > + > Time of Day**, 7:00 AM, Daily, **Run
   Immediately**, choose POS Health. It runs without asking.

### Adding metrics

Repeat steps 2 and 3 for the type, then one more **Number** item under
`metrics`. Key, then the Health type, unit if it matters, and the statistic:

| key | Health type | unit | statistic |
|---|---|---|---|
| `resting_hr` | Resting Heart Rate | | Maximum |
| `hrv_ms` | Heart Rate Variability | ms | Average |
| `body_fat_pct` | Body Fat Percentage | | Maximum |
| `active_kcal` | Active Energy | kcal | Sum |
| `exercise_min` | Exercise Minutes | | Sum |
| `stand_hours` | Stand Hours | | Sum |
| `vo2_max` | VO2 Max | | Maximum |
| `spo2_pct` | Blood Oxygen Saturation | | Average |
| `resp_rate` | Respiratory Rate | | Average |
| `flights` | Flights Climbed | | Sum |
| `walk_mi` | Walking + Running Distance | mi | Sum |
| `walking_hr` | Walking Heart Rate Average | | Average |
| `hr_avg` | Heart Rate | | Average |
| `sleep_hours` | Sleep, Start Date is yesterday | | Sum of Duration, then *Calculate* divided by 3600 |

**Workouts: not from Shortcuts.** Checked on the owner's phone 2026-09-13:
*Find Health Samples* does not list Workouts as a type. The `workouts` key
stays accepted for a Shortcut that gets them from a third-party action, but
this recipe sends readings only. For workouts, Health Auto Export ($1.99 for
one month covers the webhook it already has) or a native app; a "workout
ended" automation could post a name and a rough duration, but distance and
heart rate would be guesses, and this app does not earn XP on guesses.

### What happens next

Each post goes through `/api/integrations/apple_shortcuts/webhook`. The
secret is checked, the shape is validated, then the Fitness module writes the
same way it does for Health Auto Export: one row per metric per day on
`(kind, measured_on)`, a workout upserted on its start instant and earning its
`workout_logged` XP once, and a value you typed by hand never touched. Rows
carry `source = 'apple_shortcuts'`.

---

## If a credential leaks

Delete the connection on Settings > Connections, revoke the token at the
provider, and make a new one. Deleting the row is enough on this end: nothing
caches a credential, `getCredentials()` reads and decrypts on every call.

Rotating `ENCRYPTION_KEY` is different and heavier. It makes every stored
credential unreadable at once, so it means re-entering all of them. Only do it
if the key itself is what leaked.
