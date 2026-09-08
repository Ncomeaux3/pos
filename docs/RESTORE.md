# Restore

What to do when the database is gone. RPO is 24 hours and RTO is a few hours,
which is the deal made on 2026-09-05: nightly dumps, no replication, no
point-in-time recovery.

## Where the backups are

`.github/workflows/backup.yml` runs at 04:10 UTC, dumps the hosted database over
the session mode pooler, gzips it, and commits it to the private `pos-backups`
repository under `dumps/`. Thirty days are kept.

The pooler on port 5432 is not an arbitrary choice. GitHub runners are IPv4
only and the direct database host is IPv6 only, and transaction mode on 6543
does not give `pg_dump` the session semantics it needs.

## Restoring

```bash
git clone git@github.com:<owner>/pos-backups.git
gunzip -c pos-backups/dumps/pos-YYYY-MM-DD.sql.gz | psql "$DATABASE_URL"
```

Into a database that already has content, drop it first. `--no-owner` and
`--no-privileges` are already set on the dump, so it restores into a database
owned by whoever runs it.

```bash
psql "$ADMIN_URL" -c 'drop database pos with (force)'
psql "$ADMIN_URL" -c 'create database pos'
gunzip -c dumps/pos-YYYY-MM-DD.sql.gz | psql "$DATABASE_URL"
```

## What a restore does not bring back

- **Anything since the last dump.** Up to 24 hours.
- **Auth users.** The dump covers the application schemas. Run `pnpm setup` after
  restoring to recreate the owner user.
- **Storage objects.** Files in the per-module buckets are not in a `pg_dump`.
  Health records and insurance PDFs would need Supabase's own storage backup.
  Accepted for now; the row that points at a file survives, the file may not.

## Drill

Run this against `pos_test`, never the development database: a drill that
destroys your provider keys is worse than no drill.

```bash
pnpm test                                   # rebuilds pos_test from migrations
psql "$LOCAL/pos_test" -c "insert into core.entities (module, entity_type, entity_id, title)
                           values ('notes','note','drill-1','Restore drill row')"
pg_dump "$LOCAL/pos_test" --no-owner --no-privileges | gzip -9 > drill.sql.gz
psql "$LOCAL/postgres" -c 'drop database pos_test with (force)'
psql "$LOCAL/postgres" -c 'create database pos_test'
gunzip -c drill.sql.gz | psql "$LOCAL/pos_test"
psql "$LOCAL/pos_test" -tAc "select title from core.entities"
```

Where `$LOCAL` is `postgresql://postgres:postgres@127.0.0.1:54322`.

### Drilled

- **2026-09-08.** Dumped `pos_test` at 4.7K gzipped, dropped the database,
  restored from the gzip. All 17 core tables plus the `skill_xp` view came back
  and the marker row was present. No errors on restore.

The next drill is worth doing against a real dump from the hosted project once
step 15 has deployed it, because that one has data volume this did not.
