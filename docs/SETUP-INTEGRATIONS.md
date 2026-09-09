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
| **Strava** | oauth2 | free | **Client and sync job built. Needs your app registration.** |
| **Obsidian vault** | token | free | **Client built. Needs a repo and a token.** |
| **SimpleFIN** | token | ~$1.50/mo | **Client, real Test and nightly sync built. Needs a bridge subscription.** |
| Health Auto Export | webhook | paid iOS app | Manifest only |

Everything in bold has a client and a real Test button. None of them is
connected, because each needs an account only you have. Health Auto Export is
the last stub.

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

Nothing automatic yet, and this is the honest gap. The client can list every
markdown file in one call and read any of them by blob sha. What is not built is
the Second Brain job that walks that list, drafts summaries, and proposes
commits back. That is the next real piece of work on this module, and connecting
the vault now is what unblocks it.

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

## The one left

### Health Auto Export

Apple Health metrics by webhook. Needs the paid iOS app, which pushes JSON to a
URL the Connections page generates for you, protected by a shared secret.

Manifest only. Worth doing after Strava, since the two overlap on workouts and
Health Auto Export is the better source for sleep and resting heart rate.

---

## If a credential leaks

Delete the connection on Settings > Connections, revoke the token at the
provider, and make a new one. Deleting the row is enough on this end: nothing
caches a credential, `getCredentials()` reads and decrypts on every call.

Rotating `ENCRYPTION_KEY` is different and heavier. It makes every stored
credential unreadable at once, so it means re-entering all of them. Only do it
if the key itself is what leaked.
