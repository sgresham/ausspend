# SOC ingestion — PNFC benchmark + first NSW SOC (Sydney Water)

**Status:** the ABS GFS Public Non-Financial Corporations (PNFC) sector
benchmark is implemented, and the first NSW per-entity State Owned Corporation
(SOC) adapter — **Sydney Water Corporation only** — is implemented. Per-entity
NSW SOC extraction for any other entity, BP1 Chapter 9, VIC/QLD SOC and any
synthetic SOC rows are out of scope and are not implemented.

`npm run ingest:soc` runs **PNFC first, then Sydney Water**, logging each
source's success/failure and continuing after a source error.

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

### PNFC ingested rows

Only the two published operating-statement totals are ingested:

- `Total GFS revenue`
- `Total GFS expenses`

Component lines are not ingested, so the totals cannot be double counted.
Revenue and expense are stored as separate `gfs_flow` values, both with
`measure_type: "actual"`. The flow is never encoded in `measure_type`.

## 2. Source: Sydney Water (first NSW SOC entity)

### Legal and entity basis

Sydney Water Corporation is a NSW statutory state-owned corporation established
on 1 January 1999 under the _Water Legislation Amendment (Drinking Water and
Corporate Structure) Act 1998_, operating under the _Sydney Water Act 1994_. Its
ultimate parent is the NSW Government and its financial statements form part of
the NSW Total State Sector Accounts. The statements are general-purpose
financial statements prepared under Australian Accounting Standards, the
_Government Sector Finance Act 2018_ and NSW Treasury mandates, and are audited
by the NSW Auditor-General.

The entity-level statement is **not** a level of government, **not** project
spending, **not** geographically disaggregated (no LGA, SA2, postcode or
coordinate) and **not** the ABS PNFC sector aggregate. It is stored with
`jurisdiction_level: "soc"` and `aggregation_role: "agency_detail"`.

### PDF discovery (no hard-coded URL)

The connector starts at Sydney Water's official annual-report page:

`https://www.sydneywater.com.au/about/policies-publications/reports-publications/annual-report.html`

It parses every `href` on that page and accepts only filenames matching
`annual-report-YYYY-YY.pdf` (for example
`sydney-water-annual-report-2024-25.pdf`). It ignores the climate-related
financial disclosure and other PDFs, sorts the annual reports by fiscal year and
selects the latest. There is no hard-coded PDF URL and the test fixture proves
the parser selects `2024-25` from a page that also lists `2023-24`, `2020-21`
and a climate PDF.

Latest source found on 2026-11-17 (Annual Report 2024–25, released November
2025):

- URL: `https://www.sydneywater.com.au/content/dam/sydneywater/documents/sydney-water-annual-report-2024-25.pdf`
- SHA-256: `836f4e6b05ec966b58b3234d9acacdf61cadb24a5ec539704adb9420118c5017`
- Bytes: `12,000,968`
- Archive: outside the repo (`AUSSPEND_SOURCE_ARCHIVE` /
  `~/ausspend-source-archive/sydney-water/`)

The exact bytes are SHA-256 archived outside the repository; the repo holds only
the metadata manifest `docs/source-archive/sydney-water-annual-report.json`
(written by the runner) and the persisted `source_documents` row.

### Printed unit detection and the `$’000` guard

Every financial-statement column header prints `$’000`, and the Basis of
preparation states all values are rounded to the nearest thousand dollars. The
adapter does **not** infer a unit from magnitude:

1. It reads the statement header/unit row and calls the shared
   `detectMoneyUnit` on the printed text.
2. The only accepted unit is `thousands`. A statement whose header prints `$`
   (dollars) is rejected with `phase: "unit"` and no rows are ingested. This is
   the regression test that fails if a `$’000` table is read as dollars.
3. One `$’000` unit = 1,000 dollars = **100,000 cents**.
   `Math.round(value × 100,000)` is checked with `Number.isSafeInteger`; zero is
   a printed nil, never a placeholder.

### Statement and total-expenses reconciliation (zero tolerance)

The face statement is titled **“Statement of profit or loss and other
comprehensive income for the year ended 30 June 2025”** (PDF page 151 / printed
page 3). It prints, in `$’000`:

| Printed line               | 2025        | 2024        |
| -------------------------- | ----------- | ----------- |
| Revenue                    | 3,479,667   | 3,214,568   |
| Other income               | 5,271       | 3,306       |
| Finance costs              | (867,538)   | (752,704)   |
| Other expenses             | (2,082,002) | (1,987,929) |
| Profit before income tax   | 535,398     | 477,241     |
| Income tax expense         | (160,889)   | (141,946)   |
| Profit for the year        | 374,509     | 335,295     |
| Total comprehensive income | 1,042,922   | 746,181     |

There is no single printed “Total expenses” caption. **Total expenses is
DERIVED from the two printed expense totals**, not invented:

- Note 2(a) prints `Total finance costs recognised in profit or loss` =
  **867,538**
- Note 2(b) prints `Total other expenses recognised in profit or loss` =
  **2,082,002**
- Derived total expenses = 867,538 + 2,082,002 = **2,949,540**

The adapter accepts this only when all of the following are exact (zero
tolerance):

1. Statement bridge:
   `3,479,667 + 5,271 − 867,538 − 2,082,002 = 535,398` (printed profit before
   income tax).
2. Note 1(a) `Total revenue` = statement Revenue (3,479,667).
3. Note 2(a) total finance costs = |statement Finance costs| (867,538).
4. Note 2(b) total other expenses = |statement Other expenses| (2,082,002).
5. Note 2(b) printed subtotals reconcile:
   `448,306 + 1,074,744 + 521,009 + 26,028 + 11,915 = 2,082,002`.

If any check differs by even one `$’000` unit, the whole document is deferred to
`deferred_soc_documents` with the failing reason and **no row is ingested**. The
tests cover a one-unit PBT mismatch and a one-unit Note 2(b) mismatch.

`Total revenue` is the printed `Total revenue` (3,479,667). `Other income`
(5,271) is kept as its **own separate row** and is never added to total revenue;
it participates only in the printed PBT bridge.

### Extracted rows

Every row is provisional, `verified: false`, `measure_type: "actual"`,
`extraction_confidence: "high"` for the exactly reconciled statement/note totals
(medium for the small grant/transfer lines), `jurisdiction_level: "soc"`,
`jurisdiction: "NSW"`, `delivery_entity: "Sydney Water"`,
`location: { state: "NSW" }`, `source_dataset: "Sydney Water Annual Report
2024-25"`, `source_url` the exact PDF, and a natural key
`sha256(entity + fiscal_year + line_item + document_url)` prefixed
`sydney-water:`.

| `soc_line_item`                         | Printed source                        | 2025 `$’000`  | funding_source                       | `potential_double_count` |
| --------------------------------------- | ------------------------------------- | ------------- | ------------------------------------ | ------------------------ |
| `total_revenue`                         | Statement Revenue / Note 1(a) Total   | 3,479,667     | Sydney Water                         | false                    |
| `other_income`                          | Statement Other income / Note 1(b)    | 5,271         | Sydney Water                         | false                    |
| `total_expenses`                        | Derived: Note 2(a) + Note 2(b) totals | **2,949,540** | Sydney Water                         | false                    |
| `employee_expenses`                     | Note 2(b) Total employee-related      | 448,306       | Sydney Water                         | false                    |
| `depreciation_amortisation`             | Note 2(b) Total D&A                   | 521,009       | Sydney Water                         | false                    |
| `net_result`                            | Statement Profit for the year         | 374,509       | Sydney Water                         | false                    |
| `nsw_government_grants_social_programs` | Note 1(a)                             | 143,773       | NSW Government                       | **true**                 |
| `other_nsw_government_grants`           | Note 1(a)                             | 373           | NSW Government                       | **true**                 |
| `commonwealth_government_grants`        | Note 1(a) (printed nil in 2025)       | 0             | Commonwealth Government              | **true**                 |
| `contribution_nsw_climate_change_fund`  | Note 2(b) (expense/transfer)          | 3,550         | NSW Government — Climate Change Fund | **true**                 |

No project, LGA, SA2, postcode or coordinate is written. No line item is
invented: every value is a printed statement/note line except total expenses,
which is the exact sum of two printed totals and is documented as derived.

### Two line items flagged for human spot-check (not verified)

1. **`total_expenses` (2,949,540 $’000)** — derived rather than a single printed
   caption. Confirm it equals the intended “total expenses” definition
   (finance costs + other expenses) and that no other expense line is outside
   those two note totals.
2. **`nsw_government_grants_social_programs` (143,773 $’000)** — a
   government-named funding row that is already inside Total revenue and may
   overlap NSW government program spending. Confirm the funding-source label and
   the double-count flag before any additive use.

Both rows carry `human_spot_check: required` in their notes. No SOC row is
marked verified in this phase.

### Confidence

`extraction_confidence` is **high** only where a printed total was read and
reconciled exactly (statement/Note 1(a)/Note 2(a)/Note 2(b) totals). It is
**medium** for the two small government funding/transfer lines and the printed
nil Commonwealth grant line. It is never a substitute for human verification.

## 3. Mapping (PNFC and SOC)

| Field                    | PNFC benchmark                                  | Sydney Water SOC                                         |
| ------------------------ | ----------------------------------------------- | -------------------------------------------------------- |
| `jurisdiction_level`     | `pnfc`                                          | `soc`                                                    |
| `jurisdiction`           | `Australia` or `NSW`/`VIC`/…                    | `NSW`                                                    |
| `location`               | absent for national; `{ state }` for state rows | `{ state: "NSW" }` (statewide only)                      |
| `function_code`          | absent                                          | absent                                                   |
| `amount_cents`           | `$m × 100,000,000`                              | `$’000 × 100,000`                                        |
| `measure_type`           | `actual`                                        | `actual`                                                 |
| `aggregation_role`       | `benchmark`                                     | `agency_detail`                                          |
| `verified`               | `true`                                          | `false`                                                  |
| `data_quality_flag`      | `verified`                                      | `provisional`                                            |
| `gfs_flow`               | `revenue` / `expense`                           | absent (`soc_line_item` carries the line)                |
| `soc_line_item`          | absent                                          | stable line key (table above)                            |
| `soc_unit`               | absent                                          | `AUD_thousands`                                          |
| `potential_double_count` | absent                                          | `true` for government-named rows, `false` for own-source |
| `natural_key`            | `abs-gfs-pnfc:` + 40 hex                        | `sydney-water:` + 40 hex                                 |

## 4. No-sum and double-count invariants (critical)

- `jurisdiction_level: "pnfc"` is a sector benchmark; `jurisdiction_level: "soc"`
  is an entity statement. Neither is a level of government.
- Generic `/api/spending`, `/api/search`, region/function/state totals query
  `jurisdiction_level: { $ne: "soc" }` and `aggregation_role: { $ne:
"benchmark" }`. SOC and PNFC rows can never enter a government program total.
- `GET /api/soc` returns published SOC rows and computes **no total**: no sum
  across line items, entities or years. `total_revenue` already includes the
  separately shown grants; `total_expenses` already includes employee,
  depreciation/amortisation and transfer lines; `net_result` is a result, not an
  expense. Summing any of them is invalid.
- `GET /api/benchmark/pnfc` returns PNFC cells only and computes no total.
- Rows with `potential_double_count: true` name a government agency or a
  government contribution/transfer. The API/UI warn explicitly. They are never
  added to government program spending.
- The UI labels SOC as **“SOC entity statement — never add to government program
  spending”** and shows the unit (`$’000`/`AUD_thousands`), measure-type and
  provenance badges plus the double-count warning.

## 5. Deferred SOC documents

`deferred_soc_documents` records any SOC report that is not ingested because its
printed unit is not explicit, its statement/table is ambiguous, its required
lines cannot be parsed, or any zero-tolerance reconciliation fails. Fields:
`source_id`, `entity`, `jurisdiction`, `fiscal_year`, `title`, `document_url`,
`sha256`, `reason`, `discovered_at`, `status`, `notes`. A deferred document is
never a source of measures. The `/api/soc` response and the SOC UI show
deferred documents with their reason and URL.

## 6. Runner and archive

```bash
MONGO_URL=mongodb://10.10.10.30:27017/ausspend_dev \
AUSSPEND_SOURCE_ARCHIVE=/path/outside/repo \
npm run ingest:soc
```

The runner:

1. Runs the PNFC connector first, then the Sydney Water connector, in order.
2. Logs per-source `success`/`partial`/`error`, continuing after a source error.
3. Upserts on `natural_key`, so re-running updates the same rows and creates
   none (idempotency test).
4. Never deletes any row and never touches any other source.
5. Writes `docs/source-archive/abs-gfs-pnfc-2024-25.json` and
   `docs/source-archive/sydney-water-annual-report.json`. The exact bytes stay
   outside the repo.
6. Prints per-source counts only (never a combined SOC or PNFC total).

## 7. How the remaining SOCs will plug in later

`scripts/ingest-soc.ts` exposes `SOC_SOURCE_IDS` (PNFC, then Sydney Water) and an
intentionally empty `FUTURE_SOC_SOURCE_IDS`. A later phase should:

1. Add one adapter per source/edition under `server/src/connectors/soc/<state>/`,
   register it in `registry.ts`, and use a distinct `source_id`,
   `jurisdiction_level: "soc"` and `aggregation_role: "agency_detail"`.
2. Do the same source gate first: discover (no hard-coded URL), archive exact
   bytes with SHA-256 outside the repo, require an explicit printed unit, and
   reconcile every total with zero tolerance or defer to
   `deferred_soc_documents`.
3. Add its id to `FUTURE_SOC_SOURCE_IDS`; the runner already logs each source and
   continues after an error.
4. Keep SOC entity rows additive only within their own source/level and never add
   them to PNFC benchmark, government aggregates, charity rows or project rows.
5. Add tests for unit detection, exact totals, entity-vs-aggregate separation,
   double-count flags and no-sum.

No other NSW SOC, no VIC/QLD SOC and no BP1 Chapter 9 adapter is implemented in
this phase.
