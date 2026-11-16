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
`npm run test:e2e` runs the mocked UI specs (20 tests at M4) with `page.route`; it needs no
database. The audit below is the only live check.

## Compose stack checks

```bash
docker compose config
docker compose up --build -d
docker compose ps
curl -s http://localhost:3001/api/health
curl -s http://localhost:3001/api/data-sources
curl -s 'http://localhost:3001/api/spending?function=07'
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
# both: [seed] sources=1 regions=9 functions=53 measures=810
#       [seed] verified measures: 0 (must be 0)

MONGO_URL=mongodb://10.10.10.30:27017/not_ausspend_dev npm run seed
# exits nonzero: Refusing to seed database "not_ausspend_dev" ...
```

The guard runs before any delete or connect, so a refused target is never touched.

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
4. `/data-sources#synthetic-seed` shows the synthetic source Unverified, the live `aus-tender`
   source active with a last-ingested time, the ten remaining connectors marked **stub — not
   wired**, and the coverage limitations naming AusTender live plus PBS/GrantConnect pending.
5. API invariants: `function=07` mixed/null/per-type; `measure_type=actual` numeric total;
   `region=NSW` 400; unknown measure id 404; `/api/meta/coverage` reports AusTender live,
   PBS/GrantConnect pending, ten stubs, nonzero counts; `/api/v1/spending?jurisdiction_level=federal`
   returns contract rows with provenance and integer cents.

Acceptance evidence shape: paste the commands and their real output for each section above,
including the audit summary line, the compose `ps` state, `docker compose down -v` output, and the
seed counts from both runs.
