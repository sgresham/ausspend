# ausspend

An explorer for **published Australian government spending**, organised by COFOG function, region
and state. This repository is the Phase 1 application: an npm-workspace monorepo with a React
client, an Express API and shared TypeScript/Zod contracts.

> This foundation build contains **no spending data**. Data pages are placeholders until the
> verified dataset and source register land in later milestones. Nothing here should be read as a
> real spending figure.

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

## Checks

```bash
npm run typecheck    # shared build then server + client TypeScript
npm run lint         # ESLint flat config
npm run format:check # Prettier
npm test             # Vitest shared + server suites
npm run build        # shared, server and client production builds
npm run test:e2e     # Playwright smoke test (needs browsers installed)
```

## Pages

Six routes are wired in the shell, each rendering a clearly-marked placeholder:

| Route                 | Purpose                                       |
| --------------------- | --------------------------------------------- |
| `/`                   | Home / national overview                      |
| `/search`             | Search across programs, functions and regions |
| `/functions/:code?`   | COFOG division index and detail               |
| `/regions/:regionId?` | Region index and detail                       |
| `/states/:code?`      | State/territory index and detail              |
| `/data-sources`       | Source register and verification status       |

## Data and provenance

Every spending value will carry a `SourceRef` (`source_id`, `source_url`, `verified`) and be
expressed as integer `MoneyCents`. The dataset is synthetic/curated for development until verified
against published sources; placeholders on the pages must never be presented as real data.

## Docker Compose (development)

`docker-compose.yml` runs the server and client as Node containers, passing `MONGO_URL` from the
host environment and using host `q`'s Mongo. It deliberately has **no mongo service** and no seed
service yet (seed arrives in M1b).

## Repository rule

This is the application repository. Pool/otto files (`.opencode`, `opencode.jsonc`, `plugin/`,
`runotto`, `.pool-wt`) do **not** belong here.
