# ausspend

An explorer for **published Australian government spending**, organised by COFOG function, region
and state. This repository is the Phase 1 application: an npm-workspace monorepo with a React
client, an Express API and shared TypeScript/Zod contracts.

> The app ships a **synthetic development seed** only. It is deterministic placeholder data, marked
> `verified: false`, and is not sourced from or a substitute for any published Australian
> government figure. The real/verified dataset is a later milestone.

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

## Requirements

- **One-command flow** — Docker Engine with Compose v2 (v5.3.1 used here), plus network access to
  host `q` at `10.10.10.30:27017`.
- **Local non-Docker flow** — Node.js >= 24 (pinned in `package.json` `engines`; developed on Node
  24.14.1) and npm 11.11.0 (pinned via `packageManager`).
- Ports **3001** (API) and **5173** (client) must be free before either flow starts.

## Environment

The application database is the host `q` Mongo, never a container:

```
MONGO_URL=mongodb://10.10.10.30:27017/ausspend_dev
PORT=3001
CLIENT_ORIGIN=http://localhost:5173
VITE_API_PROXY_TARGET=http://localhost:3001
```

A host or shell `MONGO_URL` overrides the compose default. Never point local development at the pool
Mongo (`127.0.0.1:27018`). The dev compose file deliberately has **no `mongo` service**; the
application creates only the `ausspend_dev` database it is allowed to seed.

## One-command dev stack (Docker Compose)

From the repository root:

```bash
docker compose up --build
```

This starts three containers from the `node:24-alpine` image:

1. `seed` — one-shot: `npm ci`, builds `shared`, then `npm run seed`. It exits nonzero if the seed
   guard refuses the database, and `server`/`client` do not start unless it completes successfully.
2. `server` — API on <http://localhost:3001>, waiting for `seed` to finish.
3. `client` — Vite dev server on <http://localhost:5173>, waiting for the API healthcheck.

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
export MONGO_URL=mongodb://10.10.10.30:27017/ausspend_dev
npm run seed                       # refuses anything except ausspend_dev
npm run dev                        # builds shared, then API :3001 + client :5173
```

Or run one side at a time: `npm run dev:server`, `npm run dev:client`. The Vite dev server proxies
`/api` to the API on port 3001. API health: <http://localhost:3001/api/health> →
`{"ok":true,"db":"connected"|"unavailable"}`.

## Seed data

The seed resets only the `ausspend_dev` database on host `q`. It refuses to run against any other
database name, so a stray `MONGO_URL` cannot wipe unrelated data. It writes one clearly-marked
synthetic source (`source_id: synthetic-seed`, `source_url: /data-sources#synthetic-seed`,
`verified: false`), the national row plus the eight states/territories, the ten COFOG divisions
with curated subdivisions, and actual/budget/estimate measures for three fiscal years. Seeded
rows deliberately have no `natural_key`: the sparse unique index only applies to ingested records.

```bash
export MONGO_URL=mongodb://10.10.10.30:27017/ausspend_dev
npm run seed
# [seed] sources=1 regions=9 functions=53 measures=810
# [seed] verified measures: 0 (must be 0)
```

Re-running is deterministic: identical counts and values. The seed refuses a missing `MONGO_URL`
and any database whose name is not exactly `ausspend_dev` (for example
`mongodb://10.10.10.30:27017/some_other_db`), exiting nonzero before it deletes anything.

## API

All amounts are integer cents and every measure row carries `source_id`, `source_url` and
`verified`.

| Route                        | Purpose                                                            |
| ---------------------------- | ------------------------------------------------------------------ |
| `GET /api/health`            | Liveness and database status                                       |
| `GET /api/meta/coverage`     | Coverage banner: counts, connector/ingestion status                |
| `GET /api/data-sources`      | Source register with provenance and ingestion status               |
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
`/api/v1/spending?jurisdiction_level=federal`, `/api/v1/data-sources`, `/api/v1/ingestion-logs` and
`/api/v1/meta/coverage`.

`/api/functions/:code` accepts `fiscal_year`, `measure_type`, `region` and `limit`. `region` is a
region `_id` (not a code) and anything else is a `400`. When the response contains more than one
`measure_type` it sets `mixed: true`, returns `total_cents: null` and withholds `ranked_states`;
a headline total is only returned for a single measure type. Unknown codes/ids return JSON `404`,
invalid query parameters return JSON `400`.

### Coverage metadata

`GET /api/meta/coverage` returns the Phase 1 banner from the database plus the connector registry:
`phase`, `synthetic: true`, `live_ingestion` (derived from real connector status, currently
`false`), `generated_at`, `counts {data_sources, regions, functions, measures}`, distinct sorted
`fiscal_years`, supported/observed `measure_types`, `region_levels`, the eleven `connectors`
(id/name/publisher/source_url/status/jurisdiction_level/last_fetched_at/records_ingested/errors),
`connector_status_counts {active, degraded, stub}`, the latest `ingestion.latest_logs`, and
`limitations`/`note` stating that the seed is synthetic, nothing is verified, no federal connector
is live yet, the COFOG set is curated and regions stop at state/territory granularity. The response
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

| Parameter                 | Values / constraints                                                         |
| ------------------------- | ---------------------------------------------------------------------------- |
| `fiscal_year`             | `YYYY-YY`, e.g. `2024-25`                                                    |
| `measure_type`            | `actual`, `budget`, `estimate`, `contract` or `grant_award`                  |
| `jurisdiction_level`      | `federal`, `state`, `territory`, `local` or `other`                          |
| `function`                | two-digit division (`07`) or three-digit subdivision (`074`)                 |
| `region`                  | a 24-character hex region `_id` (never a code)                               |
| `min_amount`/`max_amount` | non-negative integer cents, inclusive; `min <= max`                          |
| `page`                    | default 1, `>= 1`                                                            |
| `page_size`               | default 20, `1..100`                                                         |
| `sort`                    | `amount_desc` (default), `amount_asc`, `fiscal_year_desc`, `fiscal_year_asc` |

Every parameter is validated with Zod; bad values return JSON `400`, an unknown function code or
region `_id` returns `404`. The envelope is `{ data, summary, pagination, applied_filters }`.
`pagination` is `{page, page_size, total, total_pages, has_next}` and `applied_filters` echoes the
normalised query (absent filters as `null`).

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

### Ingestion connectors and runner

`server/src/connectors` registers eleven Australian public-spending sources: federal budget portal,
ABS government finance statistics, AIHW health expenditure, AOFM, the federal `aus-tender`,
`data-gov-au-pbs` and `grantconnect` ids, and the NSW/VIC/QLD/WA treasuries. Every connector is a
stub in F1: `status: "stub"`, `fetch()` rejects with a clear "not implemented" error,
`transform()` returns no records, and there are no network calls or credentials. Each connector
also carries `jurisdiction_level` and run metadata (`lastFetchedAt`, `recordsIngested`, `errors`).

`npm run ingest:federal` runs `scripts/ingest-federal.ts` against `ausspend_dev`. It walks the
connectors sequentially, writes an `ingestion_logs` row per source, upserts on `natural_key` and
updates `data_sources` status. A stub is logged as `skipped`; a source error is logged as `error`
and marked `degraded`, and the runner continues with the next source and exits cleanly. In F1 every
connector is a stub, so the run logs eleven skipped sources. No live federal source is implemented
here: AusTender is F2.

## Checks

```bash
npm ci               # install from the lockfile
npm run typecheck    # shared build then server + client TypeScript
npm run lint         # ESLint flat config
npm run format:check # Prettier
npm test             # Vitest shared + server suites (73 tests)
npm run build        # shared, server and client production builds
npm run test:e2e     # Playwright specs with page.route API mocks
npm run audit        # live audit against an already-running seeded stack (not part of test:e2e)
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
- `/data-sources#synthetic-seed` shows the synthetic source Unverified, all eleven connector stubs
  marked **stub — not wired**, and the coverage limitations.
- API invariants: `function=07` is mixed with `total_cents: null` and per-type totals;
  `measure_type=actual` has a numeric total; `region=NSW` is `400`; an unknown measure id is `404`;
  `/api/meta/coverage` reports synthetic, no live ingestion, eleven stubs and nonzero counts.

The mocked `npm run test:e2e` run stays database-free; the audit script is not a Playwright spec.

## Pages

Eight routes render API data. Every page, including `/about`, shows a persistent Phase 1 coverage
banner driven by `GET /api/meta/coverage`: synthetic seed only, no live ingestion, figures
unverified, plus counts and a link to the source register. If coverage metadata cannot be loaded the
banner falls back to the same static synthetic-data warning rather than disappearing.

| Route                 | Purpose                                                                      |
| --------------------- | ---------------------------------------------------------------------------- |
| `/`                   | Overview, coverage counts/limitations, autocomplete, quick links, connectors |
| `/search`             | Spending explorer over `GET /api/spending` with URL-driven filters/paging    |
| `/functions/:code?`   | COFOG division index and detail with fiscal-year/measure-type filters        |
| `/regions/:regionId?` | Region directory from `GET /api/regions` and detail by region `_id`          |
| `/states/:code?`      | State/territory directory and detail by abbreviation                         |
| `/data-sources`       | Source register, connector status/last-ingested and limitations              |
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

| Parameter                 | UI / wire behaviour                                                          |
| ------------------------- | ---------------------------------------------------------------------------- |
| `function`                | two- or three-digit COFOG code from `GET /api/functions`                     |
| `region`                  | region `_id` chosen from autocomplete over `GET /api/regions`                |
| `fiscal_year`             | one of the coverage metadata's distinct fiscal years                         |
| `measure_type`            | `actual`, `budget`, `estimate`, `contract` or `grant_award`                  |
| `jurisdiction_level`      | `federal`, `state`, `territory`, `local` or `other`                          |
| `min_amount`/`max_amount` | dollars in the URL/UI; converted to integer cents on the wire                |
| `sort`                    | `amount_desc` (default), `amount_asc`, `fiscal_year_desc`, `fiscal_year_asc` |
| `page`/`page_size`        | pagination; page size is one of 10/20/50/100                                 |

The page shows the API's whole-set summary (count, per-measure-type totals and function/region
breakdowns), then one page of rows with function, region, year, measure type, amount and per-row
source/verification. Empty, loading, `400`, `404` and network failures each render a visible state.
A reset button clears the query string. Each function/region/state detail page has an “Explore this
in the spending search” link that prefills the relevant filters.

### Coverage, connectors and the about page

`/data-sources` keeps the synthetic source card and its `#synthetic-seed` anchor with the Unverified
badge, and lists every connector from coverage metadata with id, name, publisher, source URL,
status, jurisdiction level, last fetch and records ingested; stubs are marked **stub — not
wired**. It also shows the API's coverage `limitations`. The
`/about` page explains the Phase 1 scope (synthetic seed, no live ingestion, curated COFOG subset,
state/territory granularity), how provenance is attached, and why mixed measures never get a
headline total. It makes no real-data claims.

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
as integer `MoneyCents`. The development seed is synthetic and every seeded measure is
`verified: false`; the UI must never present it as real data. The seed also asserts it produced no
verified measures before reporting success.

## Docker Compose (development)

`docker-compose.yml` is the authoritative one-command development flow documented above: a
one-shot `seed` service, then `server` and `client`, all from `node:24-alpine`. It passes
`MONGO_URL` from the host environment (defaulting to host `q`'s `ausspend_dev`) and deliberately
has **no mongo service**. Dependency/build directories are named volumes under the bind mount, so
`docker compose down -v` leaves the host checkout clean.

## Repository rule

This is the application repository. Pool/otto files (`.opencode`, `opencode.jsonc`, `plugin/`,
`runotto`, `.pool-wt`) do **not** belong here.
