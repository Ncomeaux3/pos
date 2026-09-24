# Move the database to us-east-1

Status: not started. Owner task, one evening. Written 2026-09-24.

## Why

Vercel functions run in iad1 (Virginia). The Supabase project is in us-west-2
(Oregon). The Query Performance report on 2026-09-24 showed the app's own
queries average 0 to 4 ms inside Postgres, so almost all database time on a page
is the network round trip across the country, once per sequential query. A
project in us-east-1 cuts each trip to a few ms. Moving the functions to pdx1
instead was tried in v1.1 Phase 3 and was slower (decisions/log.md, 2026-09-15).

Supabase cannot change a project's region. The move is a new project plus a copy.

## What makes it simpler than it looks

- No app table references `auth.users`, so the owner user can be recreated with
  `pnpm setup` and every row still lines up.
- The schema comes from migrations (`supabase db push`), so only data is copied.
- Provider keys in `core.connections` are encrypted with `ENCRYPTION_KEY` in the
  Vercel env. The rows copy as-is and the same key still decrypts them. Do not
  change that key during the move.
- The app URL does not change, so the Health Auto Export webhook, the Google and
  Strava OAuth callbacks and the MCP server keep working.
- The old project is not touched. Rolling back is putting the old env values back.

## Before the evening

- [ ] Check the free plan has room: two active projects per organization. Note
      which org POS is in. Check: the dashboard lets you create the project.
- [ ] Pick a window away from 04:10 UTC (backup) and 09:00 UTC (nightly cron).
      Check: no job runs in the next two hours.
- [ ] Measure TTFB on `/`, `/tasks` and `/finance` in Chrome, three loads each,
      keep the middle number. Check: numbers written in this file under Results.

## Steps

1. [ ] **Create the project.** Supabase dashboard, New project, region **East US
   (North Virginia)**, same org, a strong database password saved in your
   password manager. Check: project shows Healthy.
2. [ ] **Apply the dashboard settings** from docs/SETUP-SUPABASE.md section 5:
   signups off, exposed schemas only `public` and `graphql_public`, Site URL and
   redirect URLs set to `https://pos-gilt-rho.vercel.app`. Also Authentication
   > passkeys or WebAuthn settings, SMTP and email templates if you changed any
   on the old project (compare the two dashboards side by side). JWT Keys:
   create an ECC (P-256) standby key and rotate so it is Current. Check: each
   setting matches the old project.
3. [ ] **Push the schema.** `supabase link --project-ref <new ref>` then
   `supabase db push`. Check: `supabase migration list` shows every migration on
   the remote.
4. [ ] **Freeze writes on the old project.** Nothing enforces this; just do not
   use the app or log a workout until step 9. Health Auto Export data sent in
   this window lands in the old database; resend it from the app afterwards if
   any arrives.
5. [ ] **Copy the data.** From your laptop, using each project's session mode
   pooler URL (port 5432):
   ```bash
   pg_dump "$OLD_URL" --data-only --no-owner --no-privileges \
     --schema=core --schema=brain --schema=calendar --schema=finance \
     --schema=fitness --schema=goals --schema=health --schema=home \
     --schema=ideas --schema=insurance --schema=meals --schema=skills \
     --schema=tasks --schema=travel > pos-data.sql
   psql "$NEW_URL" --single-transaction -v ON_ERROR_STOP=1 -f pos-data.sql
   ```
   If a row fails on a seeded default (a category or setting the migrations
   already inserted), truncate that table on the new project and rerun. Check:
   `select count(*)` on `finance.transaction`, `tasks.task`, `core.events` and
   `fitness.workout` match between the two projects.
6. [ ] **Copy storage.** Mirror the old buckets down and push them up, the way
   docs/RESTORE.md does:
   ```bash
   supabase storage cp -r ss:/// ./storage --experimental --project-ref <old ref>
   supabase storage cp -r ./storage/<bucket> ss:///<bucket> --experimental --project-ref <new ref>
   ```
   Then set every bucket to private in the dashboard. Check: file counts match.
7. [ ] **Recreate the owner.** Put the new URL and keys in `.env` locally and run
   `pnpm setup`. It only adds defaults and the owner user, never overwrites.
   Check: it prints that the owner was created.
8. [ ] **Swap the Vercel env vars** (Production and Preview):
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` (transaction pooler, port 6543).
   Then redeploy production. Check: the deploy is Ready.
9. [ ] **Sign in again.** The old session and passkey belong to the old project.
   Sign in by magic link, then add a new passkey in Settings. Check: the
   dashboard loads with your data.
10. [ ] **Update the backup secrets** on the `pos` repo: `BACKUP_DATABASE_URL`
    (new session pooler URL), `SUPABASE_PROJECT_REF`, and
    `SUPABASE_ACCESS_TOKEN` if the org changed. Run the Backup workflow by hand.
    Check: it goes green and a new dump lands in `pos-backups`.
11. [ ] **Relink the CLI and the MCP connector** to the new project so
    `supabase db push` and the Claude connector point at it.
12. [ ] **Measure again** the same three pages the same way. Check: numbers
    written under Results.
13. [ ] **Keep the old project for a week**, then pause it. Delete it only once
    a nightly and a backup have both run cleanly on the new one.

## Rollback

Put the four old env values back in Vercel and redeploy. Anything written to the
new project since step 8 stays there and has to be re-entered.

## Results

| Page | Before (ms) | After (ms) |
|---|---|---|
| / | | |
| /tasks | | |
| /finance | | |
