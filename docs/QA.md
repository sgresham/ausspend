# QA and the live provenance audit

This is the Phase 1 acceptance checklist for the ausspend dev stack. It is evidence-oriented: paste
real command output, not a summary. The live audit is `scripts/audit.mjs` (`npm run audit`) and is
separate from the mocked Playwright suite (`npm run test:e2e`).

## Prerequisites

- Docker Engine + Compose v2, or Node 24 + npm 11.11.0 for the non-Docker flow.
- Host `q` Mongo reachable at `mongodb://10.10.10.30:27017`. **Never** use the pool Mongo
  (`127.0.0.1:27018`).
- Ports 3001 and 5173 free before starting; verify they are free again after teardown.
- The app database is `ausspend_dev` only. The seed guard refuses any other database name.

## Static and mocked checks

```bash
npm ci
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
npm run test:e2e
```

Expected: all green. `npm test` runs the shared + server Vitest suites (73 tests at M4 + F1).
`npm run test:e2e` runs the mocked UI specs (40 tests) with `page.route`; it needs no
database. The audit below is the only live check.

### Legal / About content check

The legal specs mock `/api`, so they need only the Vite client on an alt port (never 3001/5173):

```bash
node_modules/.bin/vite client --port 5174 --strictPort
npx playwright test --config=e2e/playwright.alt.config.ts legal.spec.ts
```

Expected: 3 passed. The spec asserts that the footer notice appears on `/`, `/about` and
`/data-sources` and links to `/legal`; that all five notice blocks render; and that the factual
corrections are present — source data is not created/audited but derived totals are documented and
labelled, not all sources are CC BY (publisher terms, Dubbo public-interest use, retained CC BY
example), the privacy contact is marked "contact to be confirmed", the text says it is general
information and not legal advice, `measure_type`/provenance and double-count risks are explained,
and no official-government-publication claim is made. It also asserts that visiting `/legal` makes
no non-GET `/api` request. This is a content/UI check only: it is not legal review and it does not
touch the database.

## Compose stack checks

```bash
docker compose config
docker compose up --build -d
docker compose ps
curl -s http://localhost:3001/api/health
curl -s http://localhost:3001/api/data-sources
curl -s 'http://localhost:3001/api/spending?function=07'
curl -s 'http://localhost:3001/api/spending?q=New%20Dubbo%20Bridge'
curl -s 'http://localhost:3001/api/v1/spending?jurisdiction_level=federal'
curl -s 'http://localhost:3001/api/v1/ingestion-logs'
npm run audit
docker compose down -v
```

Check by hand:

- `docker compose config` exits 0 with no error.
- `docker compose ps` shows `seed` exited 0 and `server`/`client` healthy/running.
- `/api/health` is `{"ok":true,"db":"connected"}`.
- `/api/spending?function=07` has `summary.mixed: true`, `summary.total_cents: null` and three
  entries in `summary.total_by_measure_type`.
- `npm run audit` prints `Summary: N/N checks passed, 0 failed` and exits 0.
- After `docker compose down -v`, no containers, volumes or network remain for this compose
  project.

## Local non-Docker audit

```bash
export MONGO_URL=mongodb://10.10.10.30:27017/ausspend_dev
npm run seed
npm run dev            # in another shell, or run after seed
npm run audit
```

The audit defaults to <http://localhost:5173> and <http://localhost:3001>; override with
`AUDIT_WEB_URL` / `AUDIT_API_URL`. Expected: 0 failures and 0 page errors.

## Seed guard and determinism

```bash
export MONGO_URL=mongodb://10.10.10.30:27017/ausspend_dev
npm run seed
npm run seed
# both: [seed] mode=real ... regions=9 functions=53 synthetic=0 synthetic_written=0
#       [seed] verified measures: 0 (must be 0)

npm run seed:synthetic          # explicit legacy opt-in only: synthetic_written=810

MONGO_URL=mongodb://10.10.10.30:27017/not_ausspend_dev npm run seed
# exits nonzero: Refusing to seed database "not_ausspend_dev" ...
```

The guard runs before any delete or connect, so a refused target is never touched.

## Synthetic-seed removal (executed) and real-only default

Read [SYNTHETIC_REMOVAL_READINESS.md](SYNTHETIC_REMOVAL_READINESS.md) first. The 810
`source_id: synthetic-seed` rows were removed on 2026-11-17 after a verified backup at
`/home/steve/backups/ausspend/2026-11-17T03-26-35.175Z`. The database now has **348,939 measures,
0 synthetic**, and the default seed is real-only. The commands below are still the safe way to
re-check the state and the backup gate.

```bash
export MONGO_URL=mongodb://10.10.10.30:27017/ausspend_dev

# DRY RUN: counts by type/year/region/function; no writes.
npm run clean:synthetic
# [clean:synthetic] mode=DRY RUN (no writes)
# [clean:synthetic] before measures=0 data_sources=0 total=348939 non_synthetic=348939
# [clean:synthetic] DRY RUN complete: 0 rows deleted.

# Real-only bootstrap on a scratch DB (never the live DB): 0 synthetic rows.
SEED_ALLOW_SCRATCH=1 \
MONGO_URL=mongodb://10.10.10.30:27017/ausspend_test_manual_realonly \
  npm run seed:real
# [seed] mode=real ... synthetic=0 synthetic_written=0
```

Expected: the dry run prints the same before/after inventory and deletes nothing; the live DB has
0 synthetic rows and 348,939 real measures. The scratch real-only run has 0 synthetic rows while
regions/functions and the real source register are created. `--execute` requires
`--backup <verified backup dir>` and refuses a stale, missing or incomplete backup.

## Alt-port e2e and audit

Do not stop or restart the user's 3001/5173 stack. The mocked Playwright suite and live audit can
run on alternate ports:

```bash
PW_SERVER_PORT=3101 PW_CLIENT_PORT=5174 npm run test:e2e
AUDIT_WEB_URL=http://localhost:5174 AUDIT_API_URL=http://localhost:3101 npm run audit
```

## Host cleanliness

- `git -C <worktree> status --short` before commit lists only intended changes.
- The compose bind mount uses named volumes for `node_modules` and `shared/dist`; the checkout has
  no `node_modules`/`dist` written by containers.
- `/opt/ausspend` is not the compose project directory and is untouched.
- No `.env`, secret, `node_modules`, `dist`, report or test-results output is committed.
- Ports 3001 and 5173 are free after `docker compose down -v` and after stopping the local stack.

## What the audit checks

The full list is in `scripts/audit.mjs`. In brief:

1. Every route renders with zero `pageerror` events: `/`, `/search`, `/functions`,
   `/functions/07`, `/regions`, a real `/regions/<_id>` from `/api/regions`, `/states`,
   `/states/NSW`, `/data-sources`, `/about`.
2. Mixed measure types on `/search` and `/functions/07` show the warning and no headline total;
   one measure type shows a headline total.
3. Row tables (search, function, region/state) and summary/headline footers show the source
   id/link and Unverified status.
4. `/data-sources` omits the synthetic source in the current real-only database (the audit
   asserts the card is present only when coverage says synthetic rows exist), shows the live
   `aus-tender`/`data-gov-au-pbs`/`nsw-budget`/`data-nsw-ckan`/`dubbo-council` sources active,
   GrantConnect degraded/partial with its manual-export caveat, and the remaining connectors
   marked **stub — not wired**.
5. API invariants: `function=07` mixed/null/per-type; `measure_type=actual` numeric total;
   `region=NSW` 400; unknown measure id 404; `/api/meta/coverage` reports seven stubs,
   `pending: []`, a GrantConnect manual-export caveat and nonzero counts;
   `/api/v1/spending?jurisdiction_level=federal` returns contract rows with provenance and
   integer cents; `/api/v1/spending?measure_type=grant_award` returns real grant rows when a
   complete chunk set is present and an honest empty set otherwise.

Acceptance evidence shape: paste the commands and their real output for each section above,
including the audit summary line, the compose `ps` state, `docker compose down -v` output, and the
seed counts from both runs.
