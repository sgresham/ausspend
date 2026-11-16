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

| Route                        | Purpose                                                      |
| ---------------------------- | ------------------------------------------------------------ |
| `GET /api/health`            | Liveness and database status                                 |
| `GET /api/data-sources`      | Source register with provenance                              |
| `GET /api/functions`         | COFOG divisions with nested subdivisions                     |
| `GET /api/functions/:code`   | Function detail, measures by region/state, ranked state list |
| `GET /api/regions/:regionId` | Region detail by region `_id`                                |
| `GET /api/states/:code`      | State/territory detail (`NSW`, `VIC`, ...)                   |
| `GET /api/search?q=`         | Bounded search over region and function names/codes          |

`/api/functions/:code` accepts `fiscal_year`, `measure_type`, `region` and `limit`. `region` is a
region `_id` (not a code) and anything else is a `400`. When the response contains more than one
`measure_type` it sets `mixed: true`, returns `total_cents: null` and withholds `ranked_states`;
a headline total is only returned for a single measure type. Unknown codes/ids return JSON `404`,
invalid query parameters return JSON `400`.

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
of a headline total. Per-type totals computed from rows request `limit=1000` so the sum is not
truncated. A single measure type may show a headline total, ranked states and a bar.

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
