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

- Node.js >= 24 (pinned in `package.json` `engines`; developed on Node 24.14.1)
- npm 11.11.0 (pinned via `packageManager`)

## Environment

Copy `.env.example` to `.env` if you want local overrides. The app database lives on host `q`:

```
MONGO_URL=mongodb://10.10.10.30:27017/ausspend_dev
PORT=3001
CLIENT_ORIGIN=http://localhost:5173
VITE_API_PROXY_TARGET=http://localhost:3001
```

Never point local development at the pool Mongo (`127.0.0.1:27018`). There is no app Mongo
container; the dev compose file has no `mongo` service.

## Install and run

```bash
npm install          # installs all workspaces and writes package-lock.json
npm run dev          # builds shared, then starts API :3001 and client :5173
```

Or run one side at a time: `npm run dev:server`, `npm run dev:client`.

- Client: <http://localhost:5173>
- API health: <http://localhost:3001/api/health> → `{"ok":true,"db":"connected"|"unavailable"}`

The Vite dev server proxies `/api` to the API on port 3001.

## Seed data

The seed resets only the `ausspend_dev` database on host `q`. It refuses to run against any other
database name, so a stray `MONGO_URL` cannot wipe unrelated data. It writes one clearly-marked
synthetic source (`source_id: synthetic-seed`, `source_url: /data-sources#synthetic-seed`,
`verified: false`), the national row plus the eight states/territories, the ten COFOG divisions
with curated subdivisions, and actual/budget/estimate measures for three fiscal years.

```bash
export MONGO_URL=mongodb://10.10.10.30:27017/ausspend_dev
npm run seed
# [seed] sources=1 regions=9 functions=53 measures=810
# [seed] verified measures: 0 (must be 0)
```

The seed refuses a missing `MONGO_URL` and any database whose name is not exactly `ausspend_dev`.

## API

All amounts are integer cents and every measure row carries `source_id`, `source_url` and
`verified`.

| Route                        | Purpose                                                            |
| ---------------------------- | ------------------------------------------------------------------ |
| `GET /api/health`            | Liveness and database status                                       |
| `GET /api/meta/coverage`     | Coverage banner: synthetic flag, counts, years, connector stubs    |
| `GET /api/data-sources`      | Source register with provenance                                    |
| `GET /api/functions`         | COFOG divisions with nested subdivisions                           |
| `GET /api/functions/:code`   | Function detail, measures by region/state, ranked state list       |
| `GET /api/regions`           | Bounded region list for directory/autocomplete (national first)    |
| `GET /api/regions/:regionId` | Region detail by region `_id`                                      |
| `GET /api/states/:code`      | State/territory detail (`NSW`, `VIC`, ...)                         |
| `GET /api/spending`          | Filtered, sorted, paginated spending search with whole-set summary |
| `GET /api/spending/:id`      | One measure row in the same shape as a search data row             |
| `GET /api/search?q=`         | Bounded search over region and function names/codes                |

`/api/functions/:code` accepts `fiscal_year`, `measure_type`, `region` and `limit`. `region` is a
region `_id` (not a code) and anything else is a `400`. When the response contains more than one
`measure_type` it sets `mixed: true`, returns `total_cents: null` and withholds `ranked_states`;
a headline total is only returned for a single measure type. Unknown codes/ids return JSON `404`,
invalid query parameters return JSON `400`.

### Coverage metadata

`GET /api/meta/coverage` returns the Phase 1 banner from the database plus the connector registry:
`phase`, `synthetic: true`, `live_ingestion: false`, `generated_at`, `counts {data_sources,
regions, functions, measures}`, distinct sorted `fiscal_years`, `measure_types`, `region_levels`,
the eight `connectors` (id/name/publisher/source_url/status `stub` only), and `limitations`/`note`
stating that the seed is synthetic, nothing is verified, there is no live ingestion, the COFOG set
is curated and regions stop at state/territory granularity. The response is generated per request
and sent with `Cache-Control: no-store`. If the database is unavailable it returns `503`.

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
| `measure_type`            | `actual`, `budget` or `estimate`                                             |
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
`total_by_measure_type`. Each data row holds the measure fields plus `function_name`,
`function_level`, `function_parent_code?`, `region_code`, `region_name`, `region_level` and a
`provenance` object (`source_id`, `source_url`, `verified`, `notes?`), so the client needs no N+1
lookups. `GET /api/spending/:id` returns one row in the same shape (`400` invalid id, `404`
unknown).

### Ingestion connector stubs

`server/src/connectors` registers eight plausible Australian public-spending sources (federal budget
portal, ABS government finance statistics, AIHW health expenditure, AOFM, and the NSW/VIC/QLD/WA
treasuries). Every connector is a stub: `status: "stub"`, `fetch()` throws a clear "not implemented"
error, and there are no network calls or credentials. The API never calls them — only
`/api/meta/coverage` lists their metadata. TODO comments name the real endpoint/format each will use
in a later milestone.

## Checks

```bash
npm ci               # install from the lockfile
npm run typecheck    # shared build then server + client TypeScript
npm run lint         # ESLint flat config
npm run format:check # Prettier
npm test             # Vitest shared + server suites
npm run build        # shared, server and client production builds
npm run test:e2e     # Playwright specs with page.route API mocks
```

The Playwright suite mocks every `/api` response with `page.route`, so it does not need the seeded
database or a running API. The dev server pair in `playwright.config.ts` still starts for the page
shell; e2e only requires installed browsers (`npx playwright install chromium`).

## Pages

Six routes render live API data. Every page shows a persistent Phase 1 coverage banner: synthetic
seed only, no live ingestion, figures unverified.

| Route                 | Purpose                                                                |
| --------------------- | ---------------------------------------------------------------------- |
| `/`                   | What ausspend is, quick links, COFOG divisions and source verification |
| `/search?q=`          | Search regions and functions, linking to their pages                   |
| `/functions/:code?`   | COFOG division index and detail with fiscal-year/measure-type filters  |
| `/regions/:regionId?` | Region directory and detail by region `_id`                            |
| `/states/:code?`      | State/territory directory and detail by abbreviation                   |
| `/data-sources`       | Source register with licence, retrieval date and verification status   |

The client has a small typed API layer in `client/src/api` (fetch + error normalisation) and shared
provenance components in `client/src/components`. Every amount and table row shows a source id,
source link and verification badge. There is no map.

### Measure-type rule

A response containing more than one measure type is **mixed**: the API returns `total_cents: null`
and withholds `ranked_states`, and the UI shows a warning plus a per-measure-type breakdown instead
of a headline total. Function, region and state detail responses (and their group summaries) now
include `total_by_measure_type: [{measure_type, count, total_cents}]` at the API level, so callers
never have to sum rows to get a per-type total. The totals are always present; a single type has one
entry equal to `total_cents`, while a mixed response has one entry per type and a null headline
total. Never sum `total_cents` across measure types. A single measure type may show a headline
total, ranked states and a bar.

## Data and provenance

Every spending value carries a `SourceRef` (`source_id`, `source_url`, `verified`) and is expressed
as integer `MoneyCents`. The development seed is synthetic and every seeded measure is
`verified: false`; the UI must never present it as real data. The seed also asserts it produced no
verified measures before reporting success.

## Docker Compose (development)

`docker-compose.yml` runs the server and client as Node containers, passing `MONGO_URL` from the
host environment and using host `q`'s Mongo. It deliberately has **no mongo service**; seed with
`npm run seed` on the host.

## Repository rule

This is the application repository. Pool/otto files (`.opencode`, `opencode.jsonc`, `plugin/`,
`runotto`, `.pool-wt`) do **not** belong here.
