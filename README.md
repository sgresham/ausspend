# ausspend

[**ausspend.com.au**](https://ausspend.com.au) is the live site for the platform.

An explorer for **published Australian government spending**, organised by COFOG function, region
and state. This repository is the Phase 1 application: an npm-workspace monorepo with a React
client, an Express API and shared TypeScript/Zod contracts.

> The app runs on **real published feeds only**. The synthetic development seed has been retired:
> the database holds real published measures only and **0 synthetic rows** (live counts are exposed
> at `/api/coverage`). Real sources include
> **AusTender federal contracts**, **data.gov.au PBS budget line items**, **GrantConnect** grant
> awards (a human-downloaded, SHA-256-archived XLSX export; no API and no scraper), NSW/VIC/QLD
> budget and project data, targeted data.nsw.gov.au CKAN rows, one Dubbo council budget plus the
> audited council GPFS sources listed in the generated source register (see
> [Current source counts](#current-source-counts)), ACNC
> charity expenses and the official ABS GFS COFOG-A benchmark. Project and charity rows are real
> published records but remain unverified (`verified: false`); only the ABS GFS benchmark rows are
> `verified: true` and they are never summed with project data. The app never sums across measure
> types. PBS line items do **not** sum to the Budget Paper 1 total general government expense.
> GrantConnect exports above the 50,000-result cap are rejected, so grant coverage is partial until
> complete date-range chunks cover the period.

<!-- BEGIN GENERATED SOURCE COUNTS (npm run generate:sources) -->

## Current source counts

Generated from the checked-in connector registry by `npm run generate:sources` and verified by
`npm run check:doc-counts`. Do not edit this block by hand.

| Current-state count                 | Value |
| ----------------------------------- | ----- |
| Registered spending connectors      | 129   |
| Active spending connectors          | 127   |
| Degraded spending connectors        | 0     |
| Stub spending connectors            | 2     |
| NSW council GPFS sources            | 67    |
| NSW local-government source ids     | 68    |
| Trade connectors (separate subtree) | 2     |
| Generated connector source docs     | 69    |

These are current registry counts, not database row counts. The landing notes in
[`docs/NSW_COUNCILS.md`](./docs/NSW_COUNCILS.md) are chronological snapshots of individual
ingests and are never rewritten by this generator. Live totals for registered `data_sources`,
spending measures and trade records are served by `GET /api/coverage`; they are not hard-coded
here or checked in CI because no stable checked-in metadata file records them.
<!-- END GENERATED SOURCE COUNTS -->

## Stack

- **Client** — React 19, Vite 7, TypeScript, MUI 7, Recharts, React Router 7.
- **Server** — Express 5, Mongoose 8, Zod 4, TypeScript.
- **Shared** — TypeScript types and Zod schemas for money, measure types, source references,
  COFOG divisions and subdivisions.
- **Tooling** — npm workspaces, ESLint flat config, Prettier, Vitest, Playwright.

## Layout

```
/client     React + Vite app (port 5173)
/server     Express API (port 3001)
/shared     Shared types and Zod contracts
/e2e        Playwright smoke tests
```

## Connector modules

Council GPFS connectors can be added as `server/src/connectors/<id>/` modules with `meta.ts`,
`config.ts`/`parse.ts`, `index.ts` and an optional fixture. The shared
`server/src/connectors/gpfs/engine.ts` provides unit detection, natural-key, unit-label and
non-additive rules. `npm run generate:connectors` discovers `connectors/*/index.ts` and writes
`generated-connectors.ts`; the registry and `npm run build` consume it, so adding a module needs no
manual registry/index/package edit. `npm run generate:sources` writes `docs/sources/<id>.md` and the
generated register. `server/test/connector-modules.test.ts` enforces the contract. The reference
migration is Blacktown: 33 rows with an unchanged natural-key/amount golden digest.

## Requirements

- **One-command flow** — Docker Engine with Compose v2 (v5.3.1 used here), plus network access to
  the database host at `localhost:27017`.
- **Local non-Docker flow** — Node.js >= 24 (pinned in `package.json` `engines`; developed on Node
  24.14.1) and npm 11.11.0 (pinned via `packageManager`).
- Ports **3001** (API) and **5173** (client) must be free before either flow starts.

## Environment

The application database is an external MongoDB, never the pool Mongo. Point `MONGO_URL` at your
own instance:

```
# MongoDB: required in production; localhost default is only for development.
MONGO_URL=mongodb://localhost:27017/ausspend_dev

# API/client ports and browser origin.
PORT=3001
SERVER_PORT=3001
CLIENT_PORT=5173
CLIENT_ORIGIN=http://localhost:5173
PUBLIC_ORIGIN=http://localhost:5173
VITE_API_PROXY_TARGET=http://localhost:3001

# Downloaded source documents and database backups (outside the repo).
AUSSPEND_SOURCE_ARCHIVE=~/ausspend-source-archive
AUSSPEND_BACKUP_ROOT=~/ausspend-backups

# Deployment paths used by deploy/render-nginx.sh and the systemd units.
AUSSPEND_DEPLOY_ROOT=~/ausspend
AUSSPEND_TLS_DIR=~/.config/ausspend/tls
```

No internal IP, production hostname or user-specific absolute path is committed. The systemd
backup unit uses `%h` and an optional mode-600 `EnvironmentFile`; the nginx config is a template
rendered by `deploy/render-nginx.sh`. `npm run check:env-leaks` fails on private IPs, the known
deployment IPs, `/home/<user>` paths, the old one-letter database hostname, and internal deploy paths outside a template.

`MONGO_URL` is required by the dev compose file (it deliberately has **no `mongo` service**). Keep
credentials in your shell or an untracked `.env`, never in the repository. The application creates
only the `ausspend_dev` database it is allowed to seed.

## One-command dev stack (Docker Compose)

From the repository root:

```bash
docker compose up --build
```

This starts three containers from the `node:24-alpine` image:

1. `seed` — one-shot: `npm ci`, builds `shared`, then `npm run seed`. The seed is **real-only and
   non-destructive by default**: it writes the taxonomy and real source register and creates no
   synthetic rows, so live AusTender contracts, other data sources and `ingestion_logs` survive
   every restart. It exits nonzero if the guard refuses the database, and `server`/`client` do not
   start unless it completes successfully.
2. `server` — API on <http://localhost:3001>, waiting for `seed` to finish.
3. `client` — Vite dev server on <http://localhost:5173>, waiting for the API healthcheck.

Restarting with `docker compose up` is therefore **non-destructive**. The destructive reset is
opt-in only: `docker compose run --rm seed sh -c "npm ci && npm run seed -- --reset"` (or
`npm run seed -- --reset` locally). Never run it against a database whose ingested rows you want
to keep.

To re-ingest AusTender into the running stack, use the opt-in `ingest` profile (it waits for the
safe seed, then runs `npm run ingest:federal`):

```bash
docker compose --profile ingest run --rm ingest
# narrow acceptance window:
AUSTENDER_START_DATE=2026-11-02T00:00:00Z \
AUSTENDER_END_DATE=2026-11-09T00:00:00Z \
INGEST_SOURCES=aus-tender \
docker compose --profile ingest run --rm ingest
```

The `ingest` service never runs on a plain `docker compose up`; it is opt-in. Ports are
env-overridable if 3001/5173 are taken: `SERVER_PORT=3101 CLIENT_PORT=5174 docker compose up`.

The source tree is bind-mounted at `/app`; `node_modules`, per-workspace `node_modules` and the
shared `dist` output live in named volumes, so the compose stack never writes root-owned
`node_modules`/`dist` into the host checkout. Healthchecks use the `node` binary already present in
the image (`/api/health` for the server, `/` for the client).

Detached flow:

```bash
docker compose up --build -d
docker compose ps
docker compose logs -f seed server client
# Client: http://localhost:5173   API: http://localhost:3001/api/health
npm run audit                      # live provenance audit against the compose stack
docker compose down -v             # stops this project and removes its volumes/network
```

`docker compose down -v` is the finish line: it removes this project's containers, network and the
named dependency/build volumes. Do not use system-wide `docker prune`, and do not stop or restart
containers from other compose projects.

## Local non-Docker flow

```bash
cp .env.example .env               # optional; set MONGO_URL explicitly to be safe
npm ci
export MONGO_URL=mongodb://localhost:27017/ausspend_dev
npm run seed                       # refuses anything except ausspend_dev
npm run dev                        # builds shared, then API :3001 + client :5173
```

Or run one side at a time: `npm run dev:server`, `npm run dev:client`. The Vite dev server proxies
`/api` to the API on port 3001. API health: <http://localhost:3001/api/health> →
`{"ok":true,"db":"connected"|"unavailable"}`.

## Seed data

The seed only ever touches the `ausspend_dev` database on the database host. It refuses to run against any
other database name, so a stray `MONGO_URL` cannot wipe unrelated data.

**Real-only default.** `npm run seed` writes the national/state/territory regions, the ten COFOG
divisions with curated subdivisions, and the real connector source register, but **0 synthetic
measure rows**. It is **non-destructive**: ingested rows, other `data_sources` and every
`ingestion_logs` document are left untouched. A normal restart or compose `up` therefore cannot
recreate synthetic rows or wipe real data. `npm run seed:real` is an explicit alias for the same
mode. The compose `seed` service defaults to `SEED_MODE=real`.

```bash
export MONGO_URL=mongodb://localhost:27017/ausspend_dev
npm run seed
# [seed] target database: ausspend_dev (mode=real, non-destructive)
# [seed] mode=real sources=… regions=9 functions=53 measures=348939 synthetic=0 synthetic_written=0 non_synthetic=348939
# [seed] verified measures: 0 (must be 0)
```

**Legacy synthetic seed (explicit opt-in).** `npm run seed:synthetic` (or
`SEED_MODE=synthetic npm run seed`) is the historical development seed. It replaces only rows whose
`source_id` is `synthetic-seed` and leaves every real row and ingestion log untouched. It exists for
isolated development only; the live database no longer contains those rows.

**Synthetic-seed retirement (executed).** On 2026-11-17 a verified backup was taken at
`~/ausspend-backups/2026-11-17T03-26-35.175Z` (349,749 measures, 810 synthetic), then
`npm run clean:synthetic -- --execute --backup <dir>` deleted exactly the 810
`source_id: synthetic-seed` measures and its one source-register document. The database is now
**348,939 measures, 0 synthetic**, and every real source count is unchanged. `npm run clean:synthetic`
remains a **dry run by default** and refuses `--execute` without a complete, recent, verified
`ausspend_dev` backup. See
[docs/SYNTHETIC_REMOVAL_READINESS.md](docs/SYNTHETIC_REMOVAL_READINESS.md) for the dependency audit,
coverage gaps and the recorded removal evidence.

The only destructive path is explicit:

```bash
npm run seed -- --reset          # or SEED_RESET=1 npm run seed
```

It deletes every measure, function, region and data source before seeding. There is no profile or
default that runs it. The seed also refuses a missing `MONGO_URL` and any database whose name is
not exactly `ausspend_dev` (for example `mongodb://localhost:27017/some_other_db`), exiting
nonzero before it changes anything.

## Backup, restore and the AusTender backfill gate

The live baseline after the QGIP earlier-years, Essential Energy, Forestry Corporation of NSW,
Landcom, Port Authority of NSW, TAHE, Sydney Trains and NSW TrainLink ingests plus the Dubbo GPFS
pilot and the City of Sydney / Blacktown / City of Parramatta / Northern Beaches / Canterbury-Bankstown / Sutherland Shire / Wollongong / Newcastle / Lake Macquarie / Maitland / Coffs Harbour / MidCoast / Port Macquarie-Hastings / Tweed / Shoalhaven / Shellharbour / Waverley / Willoughby / Inner West / Bayside / Randwick / Ryde / North Sydney / Canada Bay / Cumberland / Georges River / Fairfield / Liverpool / Ku-ring-gai / Strathfield / Lane Cove / Mosman GPFS expansion, plus VIC council pilots B, C and D (VLGGC historical), is **659,086 real measures and 0 synthetic rows**: QLD QGIP 200,387, ACNC charity 127,606,
AusTender 117,894, GrantConnect 62,128, data.nsw.gov.au CKAN 3,472, PBS 1,231, NSW Budget 1,115,
QLD Budget 1,051, Dubbo 245, Dubbo GPFS 18, City of Sydney GPFS 18, Blacktown GPFS 17, Parramatta GPFS 17, Northern Beaches GPFS 18, Canterbury-Bankstown GPFS 17, Sutherland Shire GPFS 17, Wollongong GPFS 17, Newcastle GPFS 17, Lake Macquarie GPFS 17, Maitland GPFS 7, Coffs Harbour GPFS 17, MidCoast GPFS 17, Port Macquarie-Hastings GPFS 17, Tweed GPFS 17, Shoalhaven GPFS 17, Shellharbour GPFS 17, Waverley GPFS 17, Willoughby GPFS 18, Inner West GPFS 18, Bayside GPFS 18, Randwick GPFS 17, Ryde GPFS 17, North Sydney GPFS 18, Canada Bay GPFS 17, Cumberland GPFS 17, Georges River GPFS 16, Fairfield GPFS 17, Liverpool GPFS 17, Ku-ring-gai GPFS 17, Strathfield GPFS 17, Lane Cove GPFS 17, Mosman GPFS 18, ABS GFS 169, WaterNSW 47, VIC Budget 28, VIC VLGGC VGC1 5,401 + 48,815 historical, VIC VLGGC ABS1/ABS2-3 9,059 + 82,857 historical, ABS GFS PNFC
18, Sydney Water 10, Forestry Corporation of NSW 7, TAHE 6, Landcom 6, Port Authority of NSW 5,
Sydney Trains 6, NSW TrainLink 6, Hunter Water 6 and Essential Energy 6.
Phase 6.2b replaces the superseded AIHW 1997-98..2011-12 CSV with the current AIHW 2024-25
supplementary tables: **1,747 AIHW health-expenditure rows** for 2022-23..2024-25, all COFOG 07,
covering eight states/territories × 16 leaf areas × seven detailed funding sources. Government
(991 rows, federal/state) and non-government (756 rows) funding stay separate; every row is
`agency_detail` and no total is computed. METEOR remains metadata-only; the current series comes
from the report data tables, not METEOR. Only `aihw-health-expenditure` rows are replaced; every
other source is unchanged. The live DB is the authority for the current count (it also contains the
VIC LGPRF rows landed concurrently); the latest verified snapshot is 693,148 measures.
Phase 6.3 adds **855 WA Budget EFO rows** from catalogue.data.wa.gov.au CKAN: no machine-readable
BP2 agency-expense dataset is published, so Chapter 5 major spending changes are provisional,
non-additive policy measures and Chapter 6 Table 1 asset investment is reconciled to its printed
Total. The CKAN licence is Custom (Personal & Academic Use), not an open-data licence.
Phase 6.4 adds **4,359 SA Budget GFS rows** from data.sa.gov.au CKAN: general government sector
expenses by GPC function and economic type for 2012-13..2015-16, all mapped to COFOG. The unit is
$'000 and every year reconciles to its printed TOTAL row; GPC 3450 is a non-COFOG memorandum item
and is excluded. Rows are statewide, agency-detail components, not cross-source totals.
Phase 6.6 adds **2,120 ACT Budget rows** from the data.act.gov.au Socrata resource API
(`8275-pg6z`, Budget 2021-2022 Infrastructure Investment Program), paged with `$limit`/`$offset`:
424 projects × five budgeted-financing years (2021-22..2025-26), $'000, `measure_type=budget`,
territory/ACT, with every project's year components reconciled to its printed total. The printed
project total is never emitted.
Phase 6.8 adds **10 NT Budget rows** from 2026-27 Budget Paper No. 4, The Infrastructure Program,
Table 3 (capital works by COFOG-A category): $ million budget values, territory/NT, with the ten
published categories reconciling exactly to the printed $4,253.6 million total. The PDF is
Cloudflare-gated, so it is fetched headless, hash-archived and parsed; the printed total row is
never emitted.
Phase 6.7 adds **66 TAS Budget rows** from Budget Paper No. 1 (2026-27), Table 9.16:
General Government Expenses from Transactions by Purpose, COFOG-A categories × six
`$m` columns, with all six years reconciled to the printed total. Rows are
provisional non-additive benchmark aggregates; nominal interest on superannuation
is a non-COFOG reconciliation line.
Phase 6.10 adds Blacktown GPFS depth: **6 B1-1 function-expense rows + 10 Special Schedule actual-maintenance rows**, taking `blacktown-gpfs` from 17 to **33** rows. The original 17 keys/amounts are unchanged; function labels are not COFOG, and the two cuts are never summed. DB 693,059 → 693,075 (+16; all other sources delta 0).
Phase 6.9 adds **1,590 QLD local government rows** from the QLD comparative-information
report Financial Inputs CSV (data.qld.gov.au CKAN): council-level actual `$’000` total
operating expenses, employee, depreciation/amortisation and interest, 2010-11..2015-16.
Components are components of the printed total, every row is `agency_detail`, and the
source is separate from QGIP project grants/procurement. The latest verified snapshot is
693,148 measures.
Phase 6.10 adds `npm run ingest:phase6`, which runs the Phase 6 sources in priority order with
per-source logs/status transitions, and updates `/api/meta/coverage` to report active state,
territory and local registers (WA/SA/TAS active, ACT/NT territory active, QLD local active, SA
local explicitly deferred). See [PHASE6_INGESTION.md](PHASE6_INGESTION.md) for the register, unit
decisions, degraded-SOC recovery and limitations.
The pre-removal
backup is `~/ausspend-backups/2026-11-17T03-26-35.175Z` (349,749 measures including the
810 synthetic rows; natural-key count 348,939). Take a fresh verified backup before any future
historical backfill:

```bash
export MONGO_URL=mongodb://localhost:27017/ausspend_dev
npm run db:backup -- --prune 14
# [backup] wrote ~/ausspend-backups/<timestamp>
# [backup] collection measures: 348939
# [backup] natural_key count=348939 distinct=348939 checksum=...
# [backup] data_sources abs-gfs=active acnc-charity=active aus-tender=active ... vic-budget=active
```

`db:backup` reads `MONGO_URL`, refuses anything except `ausspend_dev` (or an explicit
`--scratch` `ausspend_test_*`/`ausspend_restore_test_*` database), and writes every collection as
Extended JSON to a timestamped directory **outside the repository**. The default root is
`~/ausspend-backups` (`AUSSPEND_BACKUP_ROOT` or `--out-root` overrides it). The manifest
records every collection count and index, the `data_sources` statuses, and the `natural_key`
count, distinct count and SHA-256 checksum. `MONGO_URL` is redacted in logs and never written with
credentials. `--prune 14` removes only old timestamped backup directories under that root.

Restore into a **scratch database by default**; this is the only routine restore path:

```bash
MONGO_URL=mongodb://localhost:27017/ausspend_dev \
  npm run db:restore -- ~/ausspend-backups/2026-11-16T11-04-33.153Z \
  --target ausspend_restore_test_20261116_safety1
# [restore] verify natural_key count=2092 distinct=2092 checksum=...
# [restore] OK target=ausspend_restore_test_20261116_safety1
```

The restore verifies every collection count, `natural_key` uniqueness/checksum and the
`data_sources` statuses after writing, and exits nonzero on any mismatch. Restoring into the live
database is deliberately hard: it requires both `--target ausspend_dev` **and**
`--confirm ausspend_dev`, a backup whose manifest says `ausspend_dev`, and the user/approver's
explicit approval. Do not use it as a normal test.

### Historical backfill is gated

The historical AusTender backfill is **not** part of a normal ingestion run. `npm run
ingest:federal` with `--backfill` requires:

- `BACKFILL_CONFIRM=yes`;
- `BACKUP_DIR` (or `--backup-dir`) pointing at a complete, recent, verified `ausspend_dev` backup
  (default maximum age 60 minutes, `BACKFILL_MAX_BACKUP_AGE_MINUTES`);
- explicit `AUSTENDER_START_DATE` and `AUSTENDER_END_DATE` for a real run;
- `INGEST_SOURCES` including `aus-tender`.

The gate refuses a missing, stale, truncated or checksum-mismatched backup and records the refused
attempt in `ingestion_logs` with `records_fetched: 0`. Validate the gate without fetching any data:

```bash
BACKFILL_CONFIRM=yes BACKUP_DIR=~/ausspend-backups/2026-11-16T11-04-33.153Z \
  npm run ingest:federal -- --backfill --dry-run
# [ingest] backfill gate passed backup=... age_minutes=... natural_key=...
# [ingest] backfill gate dry run OK target=ausspend_dev backup=...
```

A real backfill additionally records the verified backup path in the `ingestion_logs.backup_path`
field and chunks the window (`AUSTENDER_CHUNK_DAYS=7`, `AUSTENDER_PAGE_LIMIT=100`). The historical
2024-25 + 2025-26 run completed on 2026-11-16 with 105/105 successful chunks, 117,033 historical
contracts upserted (117,894 AusTender rows including the pre-existing 861), 0 duplicates and 0
invalid cents; see [FEDERAL_INGESTION.md](FEDERAL_INGESTION.md#historical-austender-backfill-run-2026-11-16).
Re-running a chunk is idempotent. The gate still applies to every future re-run.

### Daily backup timer

User-level systemd units live in `scripts/systemd/` (service + timer). The installer copies them
to `~/.config/systemd/user/` and snapshots `db-backup.mjs` + `lib/backup-format.mjs` with their
own `node_modules` into `~/.local/share/ausspend-backup`, so the timer works even when
`${AUSSPEND_DEPLOY_ROOT}/node_modules` is empty and the Docker stack is down. Re-run the installer after
changing the backup script.

```bash
scripts/install-db-backup-timer.sh
systemctl --user list-timers ausspend-db-backup.timer
systemctl --user status ausspend-db-backup.service
journalctl --user -u ausspend-db-backup.service -n 20
```

The timer runs daily (`03:15` with a short randomized delay), is `Persistent=true`, keeps 14
backups via `--prune 14`, and logs to the journal. It prunes only under
`~/ausspend-backups`, never application data.

## API

All amounts are integer cents and every measure row carries `source_id`, `source_url` and
`verified`.

| Route                        | Purpose                                                            |
| ---------------------------- | ------------------------------------------------------------------ |
| `GET /api/health`            | Liveness and database status                                       |
| `GET /api/meta/coverage`     | Coverage banner: counts, connector/ingestion status                |
| `GET /api/data-sources`      | Source register with provenance and ingestion status               |
| `GET /api/source-documents`  | Read-only list of archived documents (path, SHA-256, exact URL)    |
| `GET /api/ingestion-logs`    | Newest-first ingestion run history                                 |
| `GET /api/functions`         | COFOG divisions with nested subdivisions                           |
| `GET /api/functions/:code`   | Function detail, measures by region/state, ranked state list       |
| `GET /api/regions`           | Bounded region list for directory/autocomplete (national first)    |
| `GET /api/regions/:regionId` | Region detail by region `_id`                                      |
| `GET /api/states/:code`      | State/territory detail (`NSW`, `VIC`, ...)                         |
| `GET /api/spending`          | Filtered, sorted, paginated spending search with whole-set summary |
| `GET /api/spending/:id`      | One measure row in the same shape as a search data row             |
| `GET /api/search?q=`         | Bounded search over region and function names/codes                |

Every route is mounted at both `/api` (the UI) and `/api/v1` (versioned consumers), including
`/api/v1/spending?jurisdiction_level=federal`, `/api/v1/data-sources`,
`/api/v1/source-documents`, `/api/v1/ingestion-logs` and `/api/v1/meta/coverage`.

`/api/functions/:code` accepts `fiscal_year`, `measure_type`, `region` and `limit`. `region` is a
region `_id` (not a code) and anything else is a `400`. When the response contains more than one
`measure_type` it sets `mixed: true`, returns `total_cents: null` and withholds `ranked_states`;
a headline total is only returned for a single measure type. Unknown codes/ids return JSON `404`,
invalid query parameters return JSON `400`.

### Coverage metadata

`GET /api/meta/coverage` returns the Phase 1 banner from the database plus the connector registry:
`phase`, `synthetic` (derived from the live `synthetic-seed` row count, so it becomes `false` after
`clean:synthetic`), `synthetic_measures`, `real_measures`, `live_ingestion` (derived from real
connector status: true once AusTender/PBS ingest), `generated_at`,
`counts {data_sources, regions, functions, measures, synthetic_measures, real_measures}`,
`coverage_gaps` (the real national/state actual/estimate, COFOG, region and PBS gaps), distinct sorted
`fiscal_years`, supported/observed `measure_types`, `region_levels`, the registered `connectors`
(id/name/publisher/source_url/status/jurisdiction_level/last_fetched_at/records_ingested/errors),
`connector_status_counts {active, degraded, stub}`, the latest `ingestion.latest_logs`, and
`federal_ingestion {live, degraded, pending, stubs, pbs_last_ingested_at, pbs_caveat, grantconnect_caveat, grantconnect_note}` and
`limitations`/`note` stating that no synthetic rows are present, project/charity rows are
unverified, live AusTender/PBS rows are unverified, and PBS line items are not the federal total. The COFOG set is curated and
regions stop at state/territory granularity. The response
is generated per request and sent with `Cache-Control: no-store`. If the database is unavailable it
returns `503`.

### Region list

`GET /api/regions` is the directory/autocomplete list and exposes every region `_id`, including the
national row, so callers no longer have to resolve `AUS` through `/api/search`. Query parameters:
`q` (case-insensitive name/code match, trimmed, max 100 characters), `type`
(`national|state|region`), `state` (filters sub-state rows by `parent_code`; the curated seed has no
sub-state rows, so it currently returns an empty list) and `limit` (default 50, max 200). The
response is `{ regions: [{_id, code, name, level, parent_code?}], count }`, national first then
states by code. Bad parameters are `400`.

### Spending search

`GET /api/spending` accepts:

| Parameter                 | Values / constraints                                                                                                                    |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `fiscal_year`             | `YYYY-YY`, e.g. `2024-25`                                                                                                               |
| `measure_type`            | `actual`, `budget`, `estimate`, `contract` or `grant_award`                                                                             |
| `jurisdiction_level`      | `federal`, `state`, `territory`, `local` or `other`                                                                                     |
| `function`                | two-digit division (`07`) or three-digit subdivision (`074`)                                                                            |
| `q`                       | literal project/item text match over `project_name`, `description` and `delivery_entity`; trimmed, max 100 chars, empty means no filter |
| `region`                  | a 24-character hex region `_id` (never a code)                                                                                          |
| `min_amount`/`max_amount` | non-negative integer cents, inclusive; `min <= max`                                                                                     |
| `page`                    | default 1, `>= 1`                                                                                                                       |
| `page_size`               | default 20, `1..100`                                                                                                                    |
| `sort`                    | `amount_desc` (default), `amount_asc`, `fiscal_year_desc`, `fiscal_year_asc`                                                            |

Every parameter is validated with Zod; bad values return JSON `400`, an unknown function code or
region `_id` returns `404`. The envelope is `{ data, summary, pagination, applied_filters }`.
`pagination` is `{page, page_size, total, total_pages, has_next}` and `applied_filters` echoes the
normalised query (absent filters as `null`).

The `q` filter is **tokenised AND**, not fuzzy: `q` is split on whitespace (case-insensitive,
repeated words collapsed, bounded to 8 words) and **every word** must appear in at least one of
`project_name`, `description` and `delivery_entity` (AND across words, OR across fields). Word order
therefore does not matter: `q=dubbo new bridge` and `q=bridge dubbo new` both find the New Dubbo
Bridge row. Regex metacharacters such as `.*` and `(` match themselves, and only those three fields
are searched (never `notes` or `source_url`). It composes with every other filter and contributes
**no total of its own** — the same summary rules apply. For example,
`GET /api/spending?q=New%20Dubbo%20Bridge` returns the nsw-budget New Dubbo Bridge row, and
`GET /api/v1/spending?q=New%20Dubbo%20Bridge` is the versioned alias of the same filter.

`summary` covers the **whole filtered set, not just the page**: `count`, `currency: "AUD"`,
`total_cents` (null when mixed), `total_measure_type` (null when mixed), `total_by_measure_type`,
`measure_types`, `mixed`, `breakdown_by_function` and `breakdown_by_region`. Each breakdown entry
carries the function/region reference, `count`, `measure_types`, `mixed`, `total_cents` and
`total_by_measure_type`. Each data row holds the measure fields plus optional source fields
(`natural_key`, `project_name`, `description`, `jurisdiction_level`, `jurisdiction`,
`delivery_entity`, `funding_source`, `source_dataset`, `source_date`, `data_quality_flag`,
`location`, `unspsc`), the resolved `function_name`/`function_level`/`function_parent_code?`,
`region_code`/`region_name`/`region_level`, and a `provenance` object (`source_id`, `source_url`,
`verified`, `notes?`). Source records without a curated function or region return those fields as
`null` and are omitted from the function/region breakdowns; no COFOG code or region is invented.
`GET /api/spending/:id` returns one row in the same shape (`400` invalid id, `404` unknown).

### Ingestion connectors and runner (F2 AusTender + F3 PBS + S1 NSW Budget + S2 data.nsw.gov.au CKAN live)

`server/src/connectors` registers the Australian public-spending connectors summarised under
[Current source counts](#current-source-counts), including the separate council GPFS sources (the
generated [source register](./docs/sources/README.md) lists every id). **AusTender
(`aus-tender`) is live** from the public [AusTender OCDS API](https://api.tenders.gov.au/ocds):
`GET /ocds/findByDates/contractPublished/{startDate}/{endDate}`. **data.gov.au PBS
(`data-gov-au-pbs`) is live for FY2020-21 through FY2025-26** from the six annual CKAN budget
packages (FY2022-23 uses only the October final package): `package_show` selects each year's
program-expense line-item CSV, which is streamed (Windows-1252, chunked, `csv-parse`) rather than
loaded whole.
**NSW Budget (`nsw-budget`) is live as of S1** from the official 2025-26 open-data XLSX
snapshot plus the ArcGIS `Treasury_Project_Data_20260609_gdb` capital-projects layer. Each of the
803 priced project rows carries structured `project_id`, `agency`, `sector`, `cluster`,
`electorate`, `region`, `lga`, `status`, `category` and `budget_year`; the 312 statement rows carry
none of those fields, and the 171 features whose 2025-26 budget is published as `n.a.` stay
unallocated (metadata-only, never zero-filled).
**data.nsw.gov.au CKAN (`data-nsw-ckan`) is live as of S2**: nine targeted `package_search`
queries feed a small selected dataset set (RAM school funding CSV, Budget Paper 2 DataStore,
fleet-vehicle XLSX); PDF/DOCX resources are recorded as deferred, not ingested.
**GrantConnect (`grantconnect`) is a manual, cap-safe file import as of the GrantConnect item**:
a human downloads public `DownloadResult` XLSX exports, the importer archives each with SHA-256,
rejects any file carrying the >50,000-result cap warning, combines complete date-range chunks,
de-duplicates on `GA ID` and reports partial coverage honestly. It is not an API and not a
scraper. **VIC Budget (`vic-budget`), QLD Budget (`qld-budget`), QLD QGIP
(`qld-qgip`) and ACNC charity expenses (`acnc-charity`) are live as of Phase 4**. QLD QGIP
grant/contract payment-level rows cover 2018-19 through 2024-25: `qld-qgip` streams one annual
consolidated QGIP expenditure CSV per fiscal year (2024-25 by default, and 2018-19..2023-24 via
`npm run ingest:qgip-years`; cp1252) and archives the data dictionary. Each
year keeps its own `fiscal_year` and per-year natural key; 2020-21 uses only the corrected
"updated DTMR data" file. 2019-20 is partial because the publisher left annual expenditure blank
on 22,530 of 27,308 rows (the cumulative total-to-date is never substituted) — a source gap, not
a spending fall. Only Grant (`grant_award`) and Frontline service procurement (`contract`) rows
are ingested, zero-dollar rows are rejected, and the two measure types are never summed and years
are never merged. QGIP data remain provisional and unverified. `acnc-charity` streams the latest ACNC Annual
Information Statement CSV (2024), archives the programs CSV and explanatory notes, and stores one
`expense_total` row per charity plus reconciled `expense_component` rows with an explicit
`expense_category`; charity expenses are not government spending, have no COFOG function, and total
and components are never summed together. The remaining connectors are stubs (`status: "stub"`;
`fetch()` rejects with "not implemented" and `transform()` returns no records); the
`federal-budget-portal` and `aofm` connectors remain stubs.

`npm run ingest:federal` runs `scripts/ingest-federal.ts` against `ausspend_dev`. It walks the
selected connectors sequentially, writes an `ingestion_logs` row per source, upserts on
`natural_key` and updates `data_sources` status. A stub is logged as `skipped`; a source or
per-record error is logged as `error`/`partial` and marked `degraded`, and the runner continues
with the next source. AusTender rows are contract-shaped records: `measure_type: "contract"`,
`jurisdiction_level: "federal"`, integer `amount_cents`, `natural_key` = `ocid`, and mandatory
`source_dataset` / `source_url` / `source_date` / `data_quality_flag`. AusTender uses UNSPSC, which
is stored verbatim and never mapped to COFOG. PBS rows are `measure_type: "budget"`, each row keeps
its own fiscal year (`2020-21` … `2025-26`), integer cents converted from that year's published
`$'000` column, COFOG-A only where the
portfolio is defensible (`provisional` otherwise), and `natural_key` = dataset id + stable row
hash. PBS is not geographically tagged: `location.state` is literally `"Commonwealth"`.

Narrow live week (the acceptance run):

```bash
AUSTENDER_START_DATE=2026-11-02T00:00:00Z \
AUSTENDER_END_DATE=2026-11-09T00:00:00Z \
INGEST_SOURCES=aus-tender \
MONGO_URL=mongodb://localhost:27017/ausspend_dev \
npm run ingest:federal
```

In Docker, the same run is the opt-in compose profile (it does not run on a normal `up`):

```bash
AUSTENDER_START_DATE=2026-11-02T00:00:00Z \
AUSTENDER_END_DATE=2026-11-09T00:00:00Z \
INGEST_SOURCES=aus-tender \
docker compose --profile ingest run --rm ingest
```

Ingestion is idempotent on `natural_key`, so re-running it after a seed/restart never duplicates
contracts or PBS line items.

PBS requires no date window:

```bash
INGEST_SOURCES=data-gov-au-pbs \
MONGO_URL=mongodb://localhost:27017/ausspend_dev \
npm run ingest:federal
```

`npm run ingest:nsw` runs the NSW sources (`nsw-budget`, then `data-nsw-ckan`) against
`ausspend_dev`; `--source data-nsw-ckan` runs only S2. S1 discovers the 12 official 2025-26 XLSX
links in the 14 November 2025 Wayback snapshot, caches and hashes every workbook, streams each
XLSX, fetches the 974 ArcGIS capital projects, and upserts on `natural_key`. S2 archives every
downloaded/DataStore resource with SHA-256 and upserts selected CKAN rows. Official blobs are
never committed; the metadata manifests are `docs/source-archive/nsw-budget-2025-26.json` and
`docs/source-archive/data-nsw-ckan.json`.

```bash
MONGO_URL=mongodb://localhost:27017/ausspend_dev npm run ingest:nsw
MONGO_URL=mongodb://localhost:27017/ausspend_dev npm run ingest:nsw -- --source data-nsw-ckan
```

NSW financial statements are in `$m`, historical fiscal indicators in `$b` and capital projects in
`$'000`; all are converted to integer cents with explicit, tested multipliers. Budgeted rows are
labelled **Budgeted**, never actual/spent, and measure types are never summed. Full mapping,
COFOG decisions and limitations are in [NSW_LOCAL_INGESTION.md](./NSW_LOCAL_INGESTION.md). S2 stops
before Dubbo (S3), VIC/QLD/WA, SOC/ACNC charity and any live PDF/DOCX ingestion; CKAN PDF/DOCX
resources are listed as deferred on `data-nsw-ckan`.

### Source archive and PDF foundation

`server/src/connectors/source-archive.ts` and `server/src/models/source-document.ts` provide a
source-agnostic archive: documents are copied **outside** the repository (default
`~/ausspend-source-archive`) and recorded with their exact URL, `sha256`, bytes and
content type in the `source_documents` collection. `npm run archive -- list|verify|adopt-nsw|fetch`
manages them; `GET /api/v1/source-documents?source_id=nsw-budget` and
`?source_id=data-nsw-ckan` list them read-only. S1's Wayback XLSX workbooks and ArcGIS JSON are
adopted by reference (re-hashed against the committed manifest, never copied or mutated); S2
CSV/XLSX downloads and DataStore JSON are written to the same archive with SHA-256 records.

`server/src/connectors/pdf-extract.ts` is the reusable PDF text/table extractor
(`npm run pdf:extract -- --file=…`). It detects `$`, `$'000`, `$m` and `$b`, converts to integer
cents, and refuses to ingest a table when the unit is missing/ambiguous or any row/column total
does not reconcile. All extracted rows are `provisional`; a human must review before `verified`.
See [docs/SOURCE_ARCHIVE_AND_PDF.md](./docs/SOURCE_ARCHIVE_AND_PDF.md) for the model, commands,
proof and boundaries. No CKAN/Dubbo/VIC/QLD/WA source is started by this foundation.

### Other state sources (research only)

[STATE_SOURCES.md](./STATE_SOURCES.md) is the reconnaissance map for VIC, QLD, WA, SA, TAS, ACT and
NT: official budget pages, whether statements/capital/history are XLSX, CSV or PDF, the keyless
CKAN/Socrata/ArcGIS endpoints, local-government availability, licences, cadence, archive needs and
automation risks, with verified sample URLs and a recommended order (QLD first, then VIC). It is
research only: no state connector is implemented and no state row is ingested.

[docs/SOC_MULTI_STATE.md](./docs/SOC_MULTI_STATE.md) is the entity-level companion for the same seven
jurisdictions: the legal class, regulator/act, official entity list, annual-report availability,
financial-statement unit, licence, extraction feasibility and gaps for each state. It is planning
only. It records that the states do **not** share one comparable "SOC" list — VIC GBEs and statutory
water corporations, QLD GOCs, WA GTEs, SA public corporations, TAS GBEs, ACT territory-owned
corporations and NT government-owned corporations are different legal populations and are never
summed.

[docs/DATA_GRANULARITY.md](./docs/DATA_GRANULARITY.md) is the read-only audit of what detail each
active source actually publishes versus what the app stores, including which sources are
transactional, summary-only or inherently aggregate, the unit/reconciliation rules, the licence
ambiguities and a prioritised list of follow-up items. It records the current 348,981-measure
baseline and the no-sum rules for SOC, ABS GFS/PNFC, ACNC and overlapping budget series.

[docs/NSW_COUNCILS.md](./docs/NSW_COUNCILS.md) is the planning inventory for the 128 NSW general
purpose councils (plus county councils and Joint Organisations): the OLG _Your Council_ time-series,
individual council General Purpose Financial Statements, Grants Commission allocations and data.nsw
coverage, with units, licences, reporting dates and a double-count map. It records that no single
official dataset provides GPFS statement-line granularity for all 128 councils, and recommends a
one-council GPFS pilot before any bulk council ingestion. It is research only: no council
ingestion, no cross-council totals, and council spending is never state spending.

[docs/NSW_COUNCIL_DATA_NSW_SWEEP.md](./docs/NSW_COUNCIL_DATA_NSW_SWEEP.md) is the P4 data.nsw
catalogue sweep, checked per CKAN organisation rather than by keyword. It records that data.nsw has
**no** council financial-statement dataset in any format: the only council financial content is 63
annual-report PDFs (single PDF each, agency-specified licence, archived OpenGov NSW snapshots) for
10 of the 128 councils, and 118 councils have no annual-report package naming them at all. Eight
councils have no data.nsw organisation. It recommends **no data.nsw extraction pilot**; the next step stays
individual council GPFS batches from council websites. Research only: no ingestion, no DB writes.

[docs/VIC_COUNCILS.md](./docs/VIC_COUNCILS.md) is the source inventory and pilot record for the 79
Victorian councils: the official September 2026 local government directory, the VLGGC annual
questionnaire (VGC1/ABS1/ABS2-3), the Know Your Council/LGPRF data set, individual council annual
reports/GPFS, Grants Commission allocations, data.vic and the waste dashboard, with units,
licences, reporting dates and a double-count map. It records that no single official dataset
publishes the audited GPFS for all 79, but that the VLGGC workbooks do cover all 79 at
near-statement financial granularity (council-supplied and unaudited); for Greater Bendigo
FY2024-25 the VGC1 income-statement totals reconcile to the audited GPFS at the printed $1,000
rounding. **VIC council pilot A is implemented** as source `vic-vlgc-vgc1`: 5,401 non-additive
VGC1 2024-25 rows for all 79 councils, every row provisional/local_government and unverified, the
source Totals row suppressed, no cross-council total, and VLGGC attribution/permission (not CC BY).
**VIC council pilot B** adds source `vic-vlgc-abs`: the VLGGC 2024-25 ABS1 capital-outlays and
ABS2-3 balance-sheet/cash-flow/income workbooks, 9,059 non-additive rows for the same 79 councils,
all provisional/local_government and unverified, with the four source Totals rows suppressed and no
cross-council total. Bendigo FY2024-25 balances reconcile exactly to the audited GPFS (assets
$2,595,603,000, liabilities $123,597,000, equity $2,472,006,000); ABS1 capital outlays
$56,221,353.20 carry a documented $473,353.20 accrual/cash bridge to the GPFS cash-flow payments
($55,748k) and are never forced to equality. **VIC council pilot C** adds the historical VLGGC
series FY2019-20 to FY2023-24 under the same two source ids: 27,099 VGC1 and 44,548 ABS non-additive
rows (71,647 total) across all 79 councils, each with a per-year `fiscal_year` and natural key, every
source Totals row suppressed, no cross-council or cross-year total, and VLGGC attribution/permission
(not CC BY). Council totals reconcile to each workbook Totals row within 1 cent; Bendigo FY2023-24
income-statement totals match its audited GPFS within $2,475.92 and the deltas are documented.
**VIC council pilot D** adds the remaining FY2015-16 to FY2018-19 years: 21,715 VGC1 and 35,309 ABS
non-additive rows (57,024 total) across all 79 councils, so all nine historical years are landed and
none is deferred. The older VGC1 header prints `Family & Community Service` (singular) and the older
ABS2 balance sheet has 144 columns (no lease-liability line); the connector selects an explicit legacy
layout, suppresses all Totals rows, keys each row by fiscal year, and reconciles each year to its
workbook Totals row within 1 cent. **The VIC grants overlay** adds source `vic-vlgc-fag`:
79 estimated FY2024-25 and 79 final FY2023-24 Commonwealth Financial Assistance Grant totals (158
rows) for the same 79 councils. The FY2023-24 final table reconciles to the earlier September 2023
estimate by the published $864,120 adjustment; the source Totals rows are suppressed, no component
sum or cross-council total is emitted, every row is `potential_double_count=true` against VGC1/ABS
grant revenue, and the report copyright page/licence is recorded verbatim (VLGGC
attribution/permission for the data collection; the PDF itself states CC BY 3.0 Australia for
non-logo content). The 79 individual GPFS PDFs and other states remain a later item. Council
spending is never state spending.

**PBS caveat.** The CSV is built from individual entity program-expense tables; its line items do
not sum to the Budget Paper 1 total general government expense. The UI, coverage metadata and this
document state that wherever PBS figures appear; the budget per-measure-type total is the PBS
line-item sum only.

The endpoint, the `contractPublished` nuance, the `contracts[0]`/`parties[]` mapping, the
July–June FY rule, location quality flags, pagination/rate limits, natural key and the remaining
PBS (source, CSV/resource selection, streaming/encoding, units, COFOG rule, caveat, re-ingest) and
the AusTender/GrantConnect caveats are documented in
[FEDERAL_INGESTION.md](./FEDERAL_INGESTION.md). Re-run the same command: it upserts on
`natural_key`, so counts stay stable and no duplicate natural keys appear.

## Checks

```bash
npm ci               # install from the lockfile
npm run typecheck    # shared build then server + client TypeScript
npm run lint         # ESLint flat config
npm run format:check # Prettier
npm test             # Vitest shared + server suites (122 tests + 2 opt-in/skipped)
npm run test:foundation # source-archive + PDF extraction tests (no network)
npm run build        # shared, server and client production builds
npm run test:e2e     # Playwright specs with page.route API mocks
AUSTENDER_LIVE_TEST=1 npx vitest run --project server test/aus-tender.test.ts  # opt-in real-API smoke
npm run check:env-leaks # fails on committed private IPs, home paths and deployment hostnames
npm run audit        # leak guard + live audit against an already-running seeded stack
```

The Playwright suite mocks every `/api` response with `page.route`, so it does not need the seeded
database or a running API. The dev server pair in `playwright.config.ts` still starts for the page
shell; e2e only requires installed browsers (`npx playwright install chromium`).

## Live provenance audit

`npm run audit` is a separate, live-only check. It requires a running, seeded stack and never
writes to the database or reseeds. It drives the UI with Playwright and the API with `fetch`, then
prints `PASS`/`FAIL` per check and exits nonzero on any failure or uncaught browser page error.

```bash
# against the compose stack (defaults)
npm run audit

# against a local `npm run dev` stack, or another host/port
AUDIT_WEB_URL=http://localhost:5173 AUDIT_API_URL=http://localhost:3001 npm run audit
```

It proves:

- Every route (`/`, `/search`, `/functions`, `/functions/07`, `/regions`,
  `/regions/<_id resolved from /api/regions>`, `/states`, `/states/NSW`, `/data-sources`, `/about`)
  renders without a page error.
- Mixed measure types show the warning and **no headline total** on `/search` and `/functions/07`;
  a single measure type shows a headline total.
- Rendered row tables and summary/headline footers carry the source id/link and Unverified status.
- `/data-sources` shows the synthetic source card **only if coverage metadata says synthetic rows
  are present** (they are not in the current real-only database), the connector stubs marked
  **stub — not wired**, AusTender/PBS/NSW/CKAN/VIC/QLD/ACNC/ABS/Dubbo live, GrantConnect
  degraded/partial with its manual-export caveat, and the coverage limitations plus the PBS
  line-item caveat.
- API invariants: `function=07` is mixed with `total_cents: null` and per-type totals;
  `measure_type=actual` has a numeric total; `region=NSW` is `400`; an unknown measure id is `404`;
  `/api/meta/coverage` reports `synthetic: false`, `synthetic_measures: 0`, the 348,939 real
  measures, live ingestion, the stub connectors, `pending: []`, a GrantConnect manual-export caveat and
  nonzero counts.

The mocked `npm run test:e2e` run stays database-free; the audit script is not a Playwright spec.

## Pages

Eight routes render API data, and a static `/legal` page carries the legal notices. Every page,
including `/about`, shows a persistent coverage banner
driven by `GET /api/meta/coverage`: the real sources and their counts, all project/charity figures
unverified, 0 synthetic seed rows, plus a link to the source register. If coverage metadata cannot
be loaded the banner falls back to a neutral unverified-data warning rather than disappearing.

| Route                 | Purpose                                                                      |
| --------------------- | ---------------------------------------------------------------------------- |
| `/`                   | Overview, coverage counts/limitations, autocomplete, quick links, connectors |
| `/search`             | Spending explorer over `GET /api/spending` with URL-driven filters/paging    |
| `/functions/:code?`   | COFOG division index and detail with fiscal-year/measure-type filters        |
| `/regions/:regionId?` | Region directory from `GET /api/regions` and detail by region `_id`          |
| `/states/:code?`      | State/territory directory and detail by abbreviation                         |
| `/data-sources`       | Source register, connector status/last-ingested and limitations              |
| `/legal`              | Disclaimer, copyright/attribution, data explainer and privacy notices        |
| `/about`              | What ausspend is, Phase 1 scope, provenance and mixed-measure rules          |

The client has a small typed API layer in `client/src/api` (fetch + error normalisation), a shared
coverage provider (`client/src/coverage.tsx`) and provenance components in
`client/src/components`. Every amount and table row shows a source id, source link and verification
badge. There is no map and no national headline total.

### Autocomplete

The home page and the spending explorer each include a bounded, debounced name search. It queries
`GET /api/regions?q=` for regions and `GET /api/search?q=` for functions. Region results link by
`_id` to `/regions/:id` (state rows link to `/states/:code`) and function results link to
`/functions/:code`. On the explorer the same search applies a function/region filter instead of
navigating.

### Spending explorer URL parameters

`/search` keeps all state in the query string, so reload and browser back/forward restore the same
view. Every filter change resets `page` to 1; pagination and page size preserve the filters.

| Parameter                 | UI / wire behaviour                                                                     |
| ------------------------- | --------------------------------------------------------------------------------------- |
| `function`                | two- or three-digit COFOG code from `GET /api/functions`                                |
| `q`                       | "Project or item"; every word must match project/description/delivery entity, any order |
| `region`                  | region `_id` chosen from autocomplete over `GET /api/regions`                           |
| `fiscal_year`             | one of the coverage metadata's distinct fiscal years                                    |
| `measure_type`            | `actual`, `budget`, `estimate`, `contract` or `grant_award`                             |
| `jurisdiction_level`      | `federal`, `state`, `territory`, `local` or `other`                                     |
| `min_amount`/`max_amount` | dollars in the URL/UI; converted to integer cents on the wire                           |
| `sort`                    | `amount_desc` (default), `amount_asc`, `fiscal_year_desc`, `fiscal_year_asc`            |
| `page`/`page_size`        | pagination; page size is one of 10/20/50/100                                            |

The page shows the API's whole-set summary (count, per-measure-type totals and function/region
breakdowns), then one page of rows with function, region, year, measure type, amount and per-row
source/verification. The "Project or item" field sends `q` and shows the matching row count; its
chip can be removed to clear the text filter. This is a tokenised AND match over project name,
description and delivery entity — every word must occur somewhere in one of those fields, in any
order, and it is neither a substring phrase search nor fuzzy, and never a total. Empty, loading,
`400`, `404` and network failures each render a visible state. A reset button clears the query
string. Each
function/region/state detail page has an “Explore this in the spending search” link that prefills
the relevant filters.

### Coverage, connectors and the about page

`/data-sources` shows every registered real source card with its Unverified badge; the synthetic
source card and `#synthetic-seed` anchor appear only if synthetic rows are present, and they are
absent from the current real-only register. It shows the AusTender and PBS cards with
last-ingested times/record counts and the PBS line-item caveat, and lists every connector from
coverage metadata with id, name, publisher, source URL, status, jurisdiction level, last fetch and
records ingested; stubs are marked **stub — not wired**. It also shows the API's coverage
`limitations`. The `/soc` page adds the NSW State Owned Corporation layer: entity-level statement
lines for Sydney Water, WaterNSW and Hunter Water, with a `$’000` unit badge, Unverified badge, provenance link, a
no-total rule and a **potential double count** chip for government-named funding rows. The `/about`
page explains the current real-only scope, how provenance is attached, and why mixed measures never
get a headline total. Every page also shows a site-wide footer notice linking to `/legal`, which
carries the full disclaimer, copyright/attribution (including sources that are not CC BY), the
`measure_type`/provenance and double-count explainer, and the privacy note. The notices are general
information, not legal advice, and ausspend is not an official government publication.

### Measure-type and provenance rules

A response containing more than one measure type is **mixed**: the API returns `total_cents: null`
and withholds `ranked_states`, and the UI shows a warning plus per-measure-type totals instead of a
headline total. Function, region and state detail responses and their group summaries include
`total_by_measure_type: [{measure_type, count, total_cents}]`; the client renders those API values
directly and never sums measure rows itself. The totals are always present; a single type has one
entry equal to `total_cents`, while a mixed response has one entry per type and a null headline
total. Never sum `total_cents` across measure types. Only a single measure type may show a headline
total, ranked states and a bar. Every figure, group and table row keeps its source id, link and
`verified` flag.

## Data and provenance

Every spending value carries a `SourceRef` (`source_id`, `source_url`, `verified`) and is expressed
as integer `MoneyCents`. Real project and charity rows remain `verified: false` until a human checks
them; only the ABS GFS COFOG-A and ABS GFS PNFC benchmark rows are `verified: true`, and they are
never summed with project data, SOC/entity data or each other. PNFC revenue and expense are separate
flows. Sydney Water, WaterNSW and Hunter Water SOC entity rows are provisional and `verified: false`;
they are exposed only at `/api/soc` and are never added to government program spending, the PNFC
benchmark or each other.
The seed asserts it produces no verified measures before reporting success.

## Data, secrets and forking

This repository contains **code and configuration only**. It deliberately does not contain:

- source PDFs, XLSX/CSV files or other downloaded documents;
- database dumps, backups or extracted datasets;
- API keys, tokens, private keys or `.env` files with credentials.

Connectors discover and fetch their sources at run time. Documents are archived outside the
checkout (default: `~/ausspend-source-archive`, override with `AUSSPEND_SOURCE_ARCHIVE`); the
archive is not committed. Test files under `server/test/` contain only short excerpts of public
documents, sufficient to exercise a parser — not datasets.

A fork can reproduce the data by running the documented ingest commands; it will fetch the same
official sources. See [DATA_POLICY.md](./DATA_POLICY.md) for the full rule and the checks used.

## Docker Compose (development)

`docker-compose.yml` is the authoritative one-command development flow documented above: a
one-shot, non-destructive `seed` service, then `server` and `client`, all from `node:24-alpine`.
The opt-in `ingest` profile re-runs federal ingestion after that safe seed and is never started by
a plain `up`. It requires `MONGO_URL` from the host environment and deliberately has **no mongo
service**. Dependency/build directories are named
volumes under the bind mount, so `docker compose down -v` leaves the host checkout clean.

## License

The code is MIT-licensed — see [LICENSE](./LICENSE). Downloaded source documents and the short
excerpts used as parser fixtures remain the property of their publishers and are not relicensed;
see [DATA_POLICY.md](./DATA_POLICY.md).

## Repository rule

This is the application repository. Pool/otto files (`.opencode`, `opencode.jsonc`, `plugin/`,
`runotto`, `.pool-wt`) do **not** belong here.
