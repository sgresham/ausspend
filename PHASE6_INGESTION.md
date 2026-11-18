# Phase 6 integration — source register, coverage and limitations

Phase 6 added the remaining state/territory and local-government sources after the
federal/NSW/VIC/QLD foundation. This document is the integration record for Phase 6.10: the
runner, the live source register, unit/reconciliation decisions, the degraded-SOC recovery and
the limits that remain.

## 1. Integration runner

`npm run ingest:phase6` runs the Phase 6 sources **in priority order, one connector at a time**.
Each source gets its own `ingestion_logs` row and its own `data_sources` status transition; a
failure is logged against that source and the loop continues so the remaining sources still run.
The runner refuses a non-`ausspend_dev` target and never deletes a measure row.

Order:

1. `aihw-health-expenditure` — federal health expenditure, COFOG 07
2. `wa-budget` — WA 2016-17 Economic and Fiscal Outlook tables
3. `sa-budget-gfs` — SA general government GFS expenses by GPC/economic type
4. `act-budget` — ACT 2021-22 infrastructure investment programme (Socrata)
5. `tas-budget` — TAS 2026-27 Budget Paper No. 1 Table 9.16
6. `nt-budget` — NT 2026-27 Budget Paper No. 4 Table 3
7. `qld-local-government` — QLD local government comparative-information Financial Inputs

Useful controls:

```bash
# print the order without fetching or writing
PHASE6_DRY_RUN=1 npm run ingest:phase6

# run one source (still updates that source's status/log)
PHASE6_SOURCES=nt-budget MONGO_URL=mongodb://localhost:27017/ausspend_dev npm run ingest:phase6
```

`PHASE6_CONTINUE_ON_ERROR=1` keeps a full run going after a source error; by default the script
exits nonzero after all sources have been attempted.

## 2. Live source register

Verified against `mongodb://localhost:27017/ausspend_dev` on 18 November 2026. Total measures:
**693,059**; 65 registered sources, 63 active, 0 degraded, 2 stubs.

| Source                    |    Rows | Status | Measure                | Unit              | Notes                                                                              |
| ------------------------- | ------: | ------ | ---------------------- | ----------------- | ---------------------------------------------------------------------------------- |
| `aihw-health-expenditure` |   1,747 | active | actual                 | $m current prices | 2022-23..2024-25, 8 states, COFOG 07, government/non-government separate           |
| `wa-budget`               |     855 | active | actual/budget/estimate | $m                | 2016-17 EFO Chapter 5 policy measures + Chapter 6 asset investment; custom licence |
| `sa-budget-gfs`           |   4,359 | active | actual                 | $'000             | 2012-13..2015-16 GPC × economic type, COFOG-mapped                                 |
| `act-budget`              |   2,120 | active | budget                 | $'000             | 424 projects × 5 years, Socrata                                                    |
| `tas-budget`              |      66 | active | budget/estimate        | $m                | 2026-27 BP1 Table 9.16, COFOG-A, provisional                                       |
| `nt-budget`               |      10 | active | budget                 | $m                | 2026-27 BP4 Table 3, COFOG-A, provisional/medium confidence                        |
| `qld-local-government`    |   1,590 | active | actual                 | $'000             | council × year operating/employee/depreciation/interest inputs                     |
| `qld-qgip`                | 200,387 | active | actual                 | AUD               | unchanged Phase 4 source; grants/contracts, never mixed with local inputs          |
| `qld-budget`              |   1,051 | active | budget                 | $'000             | unchanged Phase 4 source                                                           |

Other live sources (NSW/VIC/federal/charity/SOC/benchmarks) are unchanged. The only registered
stubs are `federal-budget-portal` and `aofm`; no state/territory source is a stub. `sa-local` is
not registered: Phase 6.5 was closed deferred, so SA local government is explicitly not covered.

## 3. Coverage response

`/api/meta/coverage` now reports:

- `state_ingestion`: NSW, VIC, QLD, WA, SA and TAS active; no state stubs.
- `territory_ingestion`: ACT and NT active; no territory stubs.
- `local_ingestion`: all NSW GPFS/Dubbo sources, VIC council pilots and `qld-local-government`
  active; SA local marked deferred in the note.
- `federal_ingestion`: AIHW current series described; the two remaining federal stubs named.
- `phase`: adds `+ Phase 6 (WA/SA/ACT/TAS/NT + QLD local)` when those sources are live.

The `/data-sources` API and page are derived from the same `data_sources` collection and show each
connector's status, row count, `fetch_strategy`, `last_successful_fetch` and `staleness_days`.

## 4. Degraded NSW SOC: diagnosis and fallback

Phase 6.1 investigated three SOC hosts that returned a Cloudflare challenge
(`HTTP/2 403`, `cf-mitigated: challenge`) to both the HTML page and PDF:

| Source                 | Recovery                           |
| ---------------------- | ---------------------------------- |
| `waternsw`             | NSW Parliament tabled paper 192122 |
| `essential-energy`     | NSW Parliament tabled paper 192060 |
| `forestry-corporation` | NSW Parliament tabled paper 192061 |

Each connector now follows `direct` → `parliament_fallback` → `headless` and records the strategy
in `data_sources.fetch_strategy`. Parliament artifacts are byte-length/SHA-256 verified on every
fetch; a mismatch defers the document instead of ingesting different bytes. All three sources are
currently **active**, with 0 degraded sources. On a later failure the runner marks only that source
`degraded`, preserves its prior rows and computes `staleness_days`; it never deletes measures. The
full recovery detail, paper ids and hashes are in `SOC_INGESTION.md` §6A.

## 5. Unit and reconciliation decisions

- **AIHW:** the current 2024-25 supplementary tables publish state × leaf area × funding source
  for 2022-23..2024-25. Unit is `$m`; government (federal/state) and non-government are separate,
  `agency_detail` series. No cross-council/indicator/year sum. The superseded 1997-98..2011-12 CSV
  is not shipped as current.
- **WA:** 2016-17 Economic and Fiscal Outlook tables use `$m`. Chapter 5 rows are non-additive
  policy measures (major spending changes); Chapter 6 Table 1 asset investment is reconciled to its
  printed total. The data.wa licence is **Custom (Personal & Academic Use)**, not an open licence.
- **SA:** the GFS workbook does not print a unit, so the unit is detected from the printed grand
  total (17,062,490 = $17.06b → `$'000`) and every year is reconciled to its printed TOTAL row.
  GPC 3450 is a non-COFOG memorandum item and is excluded.
- **ACT:** Socrata column names explicitly say `Budgeted Financing ($'000)`; 2,120 project × year
  rows, with each project's annual components reconciled to its printed total.
- **TAS:** Budget Paper No. 1 Table 9.16 is a digital PDF with `$m` columns; the 11 COFOG-A
  category lines reconcile to the printed total for every year. Rows are provisional benchmark
  aggregates; nominal superannuation interest is a reconciliation line with no COFOG function.
- **NT:** Budget Paper No. 4 Table 3 prints `$M`; the ten COFOG-A capital-works categories reconcile
  exactly to the printed $4,253.6m total. Extraction is provisional/medium-confidence.
- **QLD local:** the comparative-information Financial Inputs CSV is `$'000`, council × year
  actual financial inputs. Total operating expenses and its three components are kept separate and
  never summed; the source has no printed total row and no cross-council total is computed.

## 6. Local-government structures

- **QLD local (`qld-local-government`):** one row per council × year × measure, from the
  comparative-information report Financial Inputs CSV. Measures are total operating expenses,
  employee expenses, depreciation/amortisation and interest/borrowing costs. `agency_detail`,
  `actual`, `$'000`; components are not added to the total and no QGIP grant/procurement row is
  mixed in.
- **SA local:** **deferred** (Phase 6.5 closed deferred). No SA council source is registered and
  coverage says so explicitly rather than claiming coverage.
- **NSW/VIC local:** the existing Dubbo, eleven-council GPFS expansion and VIC VLGGC/VGC1/ABS
  sources are unchanged, non-additive and never mixed with state rows.

## 7. Regression and limitations

- Source counts before/after Phase 6.10 are unchanged; the integration run performs idempotent
  upserts only. `ingest:phase6` refuses to decrease the total measure count.
- No source deletes rows. No cross-jurisdiction, cross-measure or state+local total is created.
- AOFM and Federal Budget Portal remain stubs; no live connector was added for them.
- `sa-local` remains deferred. WA uses a non-open custom licence. TAS and NT are document-extracted
  and provisional. The NT PDF is Cloudflare-gated and fetched headlessly. AIHW's detailed
  state × area × source coverage is 2022-23..2024-25, not a longer back-series.
- Run `npm run ingest:phase6` before a release; `/api/meta/coverage` and `/data-sources` are the
  authoritative live register, not this static document.

## 8. Verification

```bash
export MONGO_URL=mongodb://localhost:27017/ausspend_dev
PHASE6_DRY_RUN=1 npm run ingest:phase6
PHASE6_SOURCES=nt-budget npm run ingest:phase6

mongosh 'mongodb://localhost:27017/ausspend_dev' --quiet --eval '
  printjson(db.measures.aggregate([{$match:{source_id:{$in:[
    "aihw-health-expenditure","wa-budget","sa-budget-gfs","act-budget",
    "tas-budget","nt-budget","qld-local-government"]}}},
    {$group:{_id:"$source_id",rows:{$sum:1}}},{$sort:{_id:1}}]).toArray());
  printjson(db.data_sources.aggregate([{$group:{_id:"$status",n:{$sum:1}}}]).toArray());
'
```

Checks: `npm run typecheck`, `npm run lint`, `npm test` (85 files, 931 passed, 2 skipped), `npm run build`, alt e2e (52 passed) and alt `npm run audit` (38/38); ports 3001/5173 are not touched.
