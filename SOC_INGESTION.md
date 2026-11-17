# SOC ingestion — Phase 5 skeleton

**Status:** PNFC benchmark source implemented and ingested. Per-entity NSW SOC
adapters are **not** implemented; this document and `npm run ingest:soc` leave a
clean place for them.

Scope of this phase: **ABS GFS Public Non-Financial Corporations (PNFC) only**.
NSW SOC entity extraction, Sydney Water, BP1 Chapter 9, VIC/QLD SOC and any
synthetic rows are out of scope and were not started.

## 1. Source: ABS GFS PNFC (Annual 2024-25 data cubes)

- Source id: `abs-gfs-pnfc` (separate from `abs-gfs`).
- Dataset label: `ABS GFS — Public Non-Financial Corporations`.
- Publisher: Australian Bureau of Statistics. Licence: CC BY 4.0.
- Release: `https://www.abs.gov.au/statistics/economy/government/government-finance-statistics-annual/2024-25`
- Fiscal year: `2024-25` only. Official aggregates: `verified: true`,
  `data_quality_flag: "verified"`, `aggregation_role: "benchmark"`.

### SDMX absence (verified before any mapper)

The ABS SDMX API has **no PNFC/GFS dataflow**. On 2026-11-17:

| Check                                                                  | URL                                                                     | Result                                              |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------- |
| ABS dataflow catalogue                                                 | `https://data.api.abs.gov.au/rest/v1/dataflow/ABS`                      | HTTP 200, 3,231,497 bytes, 1,228 dataflows          |
| PNFC / Public Non-Financial / GFS / COFOG / Government Finance matches | same catalogue                                                          | **0**                                               |
| ABS DSD catalogue                                                      | `https://data.api.abs.gov.au/rest/v1/datastructure/ABS?detail=allstubs` | HTTP 200, 477,968 bytes; no PNFC/GFS data structure |
| Candidate dataflow ids (`PNFC`, `ABS_GFS`, `GFS_5512`, …)              | `/rest/v1/dataflow/ABS/{id}`                                            | every id **HTTP 404**                               |

No guessed SDMX mapper, key, dimension or unit exists. The only fallback is the
official ABS GFS Annual XLSX, approved by a human. The connector never queries
SDMX.

### The nine genuine PNFC data cubes

The ABS GFS Annual 2024-25 release publishes nine separate **Public
Non-financial Corporations Operating Statement** data cubes. The connector
discovers them from the release page by their `aria-label` and validates the
workbook title row before parsing. The separate Key Tables workbook
`55120DO094` used by Phase 4 is general government only and is **not** a PNFC
source.

| File                     | Jurisdiction                         | Level    |
| ------------------------ | ------------------------------------ | -------- |
| `55120DO033_202425.xlsx` | Australia (all levels of government) | national |
| `55120DO023_202425.xlsx` | New South Wales                      | state    |
| `55120DO024_202425.xlsx` | Victoria                             | state    |
| `55120DO025_202425.xlsx` | Queensland                           | state    |
| `55120DO026_202425.xlsx` | South Australia                      | state    |
| `55120DO027_202425.xlsx` | Western Australia                    | state    |
| `55120DO028_202425.xlsx` | Tasmania                             | state    |
| `55120DO029_202425.xlsx` | Northern Territory                   | state    |
| `55120DO030_202425.xlsx` | Australian Capital Territory         | state    |

The ABS also publishes Commonwealth-only (`55120DO022`) and total-state/total-local
PNFC cubes. They are deliberately **not** ingested: the national cube already is
the all-levels aggregate, and adding overlapping aggregates invites an invalid
sum. State rows are the state government PNFCs; local and Commonwealth PNFCs
are not separately represented.

### Units and scale

Every sheet states `$m` in row 6. One `$m` = 1,000,000 dollars =
**100,000,000 cents**. The unit is read and validated per sheet; a missing or
different unit throws. There is no inference from magnitude. Conversion is
`Math.round(value × 100,000,000)` with `Number.isSafeInteger` checks; negative
values are rejected, never sign-flipped.

### Ingested rows

Only the two published operating-statement totals are ingested:

- `Total GFS revenue`
- `Total GFS expenses`

Component lines are not ingested, so the totals cannot be double counted.
Revenue and expense are stored as separate `gfs_flow` values, both with
`measure_type: "actual"`. The flow is never encoded in `measure_type`.

## 2. Mapping

| Field                | Value                                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `jurisdiction_level` | `pnfc`                                                                                                                               |
| `jurisdiction`       | `Australia` (national cube) or `NSW`/`VIC`/`QLD`/`SA`/`WA`/`TAS`/`NT`/`ACT`                                                          |
| `location`           | absent for national; `{ state }` for state rows (statewide only)                                                                     |
| `function_code`      | absent — the PNFC operating statement is not COFOG-classified                                                                        |
| `amount_cents`       | published `$m` × 100,000,000                                                                                                         |
| `measure_type`       | `actual`                                                                                                                             |
| `fiscal_year`        | `2024-25`                                                                                                                            |
| `gfs_flow`           | `revenue` or `expense`                                                                                                               |
| `gfs_line_item`      | `total_revenue` or `total_expenses`                                                                                                  |
| `gfs_line_label`     | the exact published line label                                                                                                       |
| `source_id`          | `abs-gfs-pnfc`                                                                                                                       |
| `source_dataset`     | `ABS GFS — Public Non-Financial Corporations`                                                                                        |
| `source_url`         | the exact PNFC XLSX data-cube URL                                                                                                    |
| `source_date`        | `2026-04-21`                                                                                                                         |
| `verified`           | `true`                                                                                                                               |
| `data_quality_flag`  | `verified` (official aggregate only)                                                                                                 |
| `aggregation_role`   | `benchmark`                                                                                                                          |
| `natural_key`        | `abs-gfs-pnfc:` + first 40 hex of `sha256(series_key + ␟ + fiscal_year)`; series key = file id, level, jurisdiction, flow, line item |

There is no project name, LGA, SA2, postcode or coordinate. A PNFC cell is a
sector aggregate, not a project or an entity.

## 3. No-sum invariant (critical)

- `jurisdiction_level: "pnfc"` is distinct from `soc`, `federal`, `state`,
  `local` and `charity`.
- `aggregation_role: "benchmark"` is excluded from every generic
  `/api/spending`, `/api/search`, state, function and region total. PNFC rows
  are never returned by those endpoints.
- `GET /api/benchmark/pnfc` returns the published cells only and computes **no
  total**: no sum across jurisdictions, no revenue + expense total, and no
  addition to SOC/entity, government, charity or project data.
- The UI labels it **“Sector aggregate — never add to project/entity data”**.
- Tests cover the no-sum behaviour (`server/test/abs-gfs-pnfc.test.ts`).

## 4. Runner and archive

```bash
MONGO_URL=mongodb://10.10.10.30:27017/ausspend_dev \
AUSSPEND_SOURCE_ARCHIVE=/path/outside/repo \
npm run ingest:soc
```

`npm run ingest:soc` runs the PNFC connector first and logs per-source
success/failure. It upserts on `natural_key`, so re-running updates the same 18
documents and creates none. It never deletes any row or touches any other
source. The exact XLSX bytes are SHA-256 archived **outside the repo**; the
repo holds only the metadata manifest
[`docs/source-archive/abs-gfs-pnfc-2024-25.json`](source-archive/abs-gfs-pnfc-2024-25.json)
and the persisted `source_documents` rows.

## 5. How the NSW SOC per-entity adapters will plug in later

`scripts/ingest-soc.ts` exposes `SOC_SOURCE_IDS` and an intentionally empty
`FUTURE_SOC_SOURCE_IDS`. A later phase should:

1. Add a connector in `server/src/connectors/` for the approved NSW SOC source
   (one adapter per source/edition), register it in `registry.ts`, and use a
   distinct `source_id` plus `jurisdiction_level: "soc"` for entity rows.
2. Add its id to `FUTURE_SOC_SOURCE_IDS`; the runner already logs each source's
   success/failure and continues after a source error.
3. Keep SOC entity rows additive only within their own source/level, and never
   add them to PNFC benchmark rows, government aggregates, charity rows or
   project rows.
4. Archive the exact source bytes with SHA-256 outside the repo and add tests
   for units, identity/idempotency, entity-vs-aggregate separation and no-sum.

No NSW SOC adapter is implemented in this phase.
