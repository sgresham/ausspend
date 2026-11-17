# SOC ingestion — PNFC benchmark + NSW SOC entities (Sydney Water, WaterNSW, Hunter Water, Essential Energy, Forestry Corporation of NSW, Landcom, Port Authority of NSW, TAHE, Sydney Trains, NSW TrainLink)

**Status:** the ABS GFS Public Non-Financial Corporations (PNFC) sector
benchmark is implemented, and ten NSW per-entity State Owned Corporation (SOC)
adapters are implemented: **Sydney Water Corporation**, **WaterNSW (Water NSW)**,
**Hunter Water Corporation**, **Essential Energy**, **Forestry Corporation of
NSW**, **Landcom**, **Port Authority of NSW**, **TAHE (Transport Asset
Holding Entity of New South Wales)**, **Sydney Trains** and **NSW TrainLink**. Per-entity NSW SOC extraction for any
other entity, BP1 Chapter 9, VIC/QLD SOC and any synthetic SOC rows are out of
scope and are not implemented. The ten SOC entities are separate sources and
are never summed with each other. The multi-state entity inventory — VIC, QLD,
WA, SA, TAS, ACT and NT legal classes, official lists, annual reports,
feasibility and gaps — is in
[docs/SOC_MULTI_STATE.md](./docs/SOC_MULTI_STATE.md). It is planning only: no
other state entity is in scope and no cross-state total exists.

`npm run ingest:soc` runs **PNFC first, then Sydney Water, then WaterNSW, then
Hunter Water, then Essential Energy, then Forestry Corporation of NSW, then
Landcom, then Port Authority of NSW, then TAHE, then Sydney Trains, then NSW TrainLink**, logging each source's
success/failure and continuing after a source error.

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

## 2A. Source: WaterNSW (second NSW SOC entity)

### Legal and entity basis

Water NSW is a statutory State Owned Corporation constituted under the _Water
NSW Act 2014_, with the NSW Government as its ultimate parent. The consolidated
entity comprises Water NSW (the Parent) and its wholly owned subsidiary
WaterNSW Infrastructure Pty Ltd. Its general-purpose financial statements are
prepared under the _Government Sector Finance Act 2018_, the _State Owned
Corporations Act 1989_ and NSW Treasury directions, and are audited by the NSW
Auditor-General. The annual report is tabled in NSW Parliament (2024-25
registration 3087/4479, tabled 28 November 2025).

"WaterNSW" is the canonical `delivery_entity`; "Water NSW" is the same entity
and is an accepted alias. The entity-level statement is **not** a level of
government, **not** project spending, **not** geographically disaggregated (no
LGA, SA2, postcode or coordinate) and **not** the ABS PNFC sector aggregate. It
is stored with `jurisdiction_level: "soc"` and `aggregation_role:
"agency_detail"`. WaterNSW rows are never added to Sydney Water's rows or to any
other SOC.

### PDF discovery (no hard-coded URL)

The connector starts at WaterNSW's official annual-report page:

`https://www.waternsw.com.au/about-us/our-business/corporate-governance/annual-reports`

It parses every `href`, accepts only WaterNSW annual-report PDFs (for example
`WaterNSW-Annual-Report-2024-2025.pdf` and `WaterNSW_Annual-Report-2022-23.pdf`),
explicitly excludes the half-yearly reports and the Statement of Corporate
Intent, sorts by fiscal year and selects the latest. There is no hard-coded PDF
URL; the discovery test proves the parser selects 2024-25 from a page that also
lists half-yearly, 2023-24 and 2022-23 PDFs.

Latest source found on 2026-11-17 (Annual Report 2024–25, tabled 28 November
2025):

- URL: `https://www.waternsw.com.au/documents/publications/general-publications/annual-reports/WaterNSW-Annual-Report-2024-2025.pdf`
- SHA-256: `6240e733e2d2e5562553a15398b1dbe63c8ab454b6fe78a9d5000f354f338b09`
- Bytes: `42,917,371`
- Archive: outside the repo (`AUSSPEND_SOURCE_ARCHIVE` /
  `~/ausspend-source-archive/waternsw/`)

The official WaterNSW host presents a Cloudflare challenge to non-browser
clients (Node `fetch` and `curl` receive HTTP 403). When the operator sets
`WATERNSW_ANNUAL_REPORT_URL`, the connector skips online discovery and uses that
exact official URL as row provenance; `WATERNSW_ANNUAL_REPORT_MIRROR_URL` may
point at the same document's NSW Parliament tabled-paper artifact
(`https://files.parliament.nsw.gov.au/.../Attachment%20C1%20-%20WaterNSW%20Annual%20Report%202024-2025.pdf`).
The archive records the official URL as `original_url` and the mirror as
`retrieved_from`/`archived_from: "other"`; SHA-256 and byte length are identical
for both. The default path is still live discovery from the annual-report page.

### Printed unit detection and the `$’000` guard

Every financial-statement column header prints `$’000`, and the Basis of
preparation (PDF page 61) states all values are rounded to the nearest thousand
dollars (`$’000`). The adapter reads the statement unit row and calls the shared
`detectMoneyUnit`; the only accepted unit is `thousands`. A statement whose
header prints `$` (dollars) is rejected with `phase: "unit"` and no rows are
ingested. One `$’000` unit = **100,000 cents**; conversion uses
`Math.round(value × 100,000)` with `Number.isSafeInteger`.

The face statement has four numeric columns (Consolidated 2025, Consolidated
2024, Parent 2025, Parent 2024). The adapter stores the **consolidated
current-year** column only. It anchors that column on the printed `Total
revenue` row and matches every other row by right-edge alignment, so note numbers
("2", "3", "5", …) and the Parent/comparative columns are never read as the
current amount.

### Statement and total-expenses reconciliation (zero tolerance)

The consolidated statement is on PDF page 59 (`Statements of comprehensive
income for the year ended 30 June 2025`) and prints, in `$’000`:

| Printed line                           | 2025 consolidated | 2024 consolidated |
| -------------------------------------- | ----------------- | ----------------- |
| Revenue from water supply and delivery | 379,720           | 376,490           |
| Grants and subsidies                   | 65,336            | 67,109            |
| Other revenue                          | 49,948            | 54,089            |
| **Total revenue**                      | **495,004**       | **497,688**       |
| Employee related expenses              | (163,654)         | (141,587)         |
| Depreciation and amortisation          | (107,530)         | (105,418)         |
| Other operating expenses               | (113,348)         | (119,595)         |
| Finance costs                          | (88,299)          | (67,497)          |
| **Total expenses**                     | **(472,831)**     | **(434,097)**     |
| Operating profit                       | 22,173            | 63,590            |
| Other gains/(losses)                   | 1,607             | 384               |
| Gains/(losses) on revaluation of PP&E  | (12)              | 188               |
| Profit before income tax expense       | 23,768            | 64,163            |
| Income tax expense                     | (7,117)           | (19,224)          |
| Profit after income tax expense        | 16,651            | 44,939            |
| Total comprehensive income             | 131,244           | 99,976            |

WaterNSW prints an **explicit `Total expenses` line**; unlike Sydney Water this
is not derived. It is accepted only when all of the following are exact (zero
tolerance) in printed thousands:

1. Revenue components: `379,720 + 65,336 + 49,948 = 495,004`.
2. Expense components: `163,654 + 107,530 + 113,348 + 88,299 = 472,831`.
3. Operating-profit bridge: `495,004 − 472,831 = 22,173`.
4. Profit-before-tax bridge: `22,173 + 1,607 − 12 = 23,768`.
5. Net result: `23,768 − 7,117 = 16,651`.
6. Note 3 grants: `41,669 + 14,004 + 9,663 = 65,336` (the statement `Grants and
subsidies` line).

If any check differs by even one `$’000` unit, the whole document is deferred to
`deferred_soc_documents` with the failing reason and **no row is ingested**. The
tests cover one-unit `Total expenses`, one-unit profit-before-tax and one-unit
Note 3 grants mismatches.

Note 3 (`3 Grants and subsidies`, PDF page 64) discloses:

| Printed line                               | 2025 consolidated |
| ------------------------------------------ | ----------------- |
| NSW Government contributions to operations | 41,669            |
| NSW Government subsidies                   | 14,004            |
| Other Government grants                    | 9,663             |
| **Total**                                  | **65,336**        |

### Extracted rows

Every row is provisional, `verified: false`, `measure_type: "actual"`,
`jurisdiction_level: "soc"`, `jurisdiction: "NSW"`, `delivery_entity:
"WaterNSW"`, `location: { state: "NSW" }`, `source_dataset: "WaterNSW Annual
Report 2024-25"`, `source_url` the exact PDF, `data_quality_flag:
"provisional"`, `aggregation_role: "agency_detail"`, and a natural key
`sha256(entity + fiscal_year + line_item + document_url)` prefixed `waternsw:`.

| `soc_line_item`                              | Printed source                      | 2025 `$’000` | funding_source                                                                   | `potential_double_count` |
| -------------------------------------------- | ----------------------------------- | ------------ | -------------------------------------------------------------------------------- | ------------------------ |
| `total_revenue`                              | Statement Total revenue             | 495,004      | WaterNSW                                                                         | false                    |
| `total_expenses`                             | Statement Total expenses (explicit) | **472,831**  | WaterNSW                                                                         | false                    |
| `employee_expenses`                          | Employee related expenses           | 163,654      | WaterNSW                                                                         | false                    |
| `depreciation_amortisation`                  | Depreciation and amortisation       | 107,530      | WaterNSW                                                                         | false                    |
| `net_result`                                 | Profit after income tax expense     | 16,651       | WaterNSW                                                                         | false                    |
| `nsw_government_contributions_to_operations` | Note 3                              | 41,669       | NSW Government — Department of Climate Change, Energy, the Environment and Water | **true**                 |
| `nsw_government_subsidies`                   | Note 3                              | 14,004       | NSW Government                                                                   | **true**                 |
| `other_government_grants`                    | Note 3                              | 9,663        | Government grants (agency not itemised)                                          | **true**                 |

No project, LGA, SA2, postcode or coordinate is written. No line item is
invented: every value is a printed statement/Note 3 line, and `total_expenses`
is the explicit printed total.

### Two line items flagged for human spot-check (not verified)

1. **`total_expenses` (472,831 $’000)** — explicit printed consolidated total.
   Confirm it is the intended “total expenses” definition and that the
   consolidated (not Parent) column is the desired entity view.
2. **`nsw_government_contributions_to_operations` (41,669 $’000)** — a
   government-named funding row that is already inside Total revenue and may
   overlap NSW government program spending. Confirm the funding-source label
   (NSW DCCEEW) and the double-count flag before any additive use.

Both rows carry `human_spot_check: required` in their notes. No WaterNSW row is
marked verified in this phase.

### Confidence

`extraction_confidence` is **high** for the exactly reconciled statement and
Note 3 total lines (revenue, expenses, employee, depreciation/amortisation, net
result, NSW Government contributions). It is **medium** for the two smaller
grant components. It is never a substitute for human verification.

### Deep detail — note-level breakdown (2024-25)

The premise for deep detail is satisfied by the published tables, not assumed
from a narrative. The archived PDF (SHA-256
`6240e733e2d2e5562553a15398b1dbe63c8ab454b6fe78a9d5000f354f338b09`) contains
parseable, **reconciling** line-item tables beyond the face statement. Each
table below is printed in `$’000`, read from the **consolidated current-year
(2025)** column, and accepted only when its printed signs sum exactly to its
printed subtotal. Every subtotal is itself a printed component of the face
statement. No amount is inferred from magnitude and no allocation is invented.

Pages are PDF pages (the printed page numbers are in the footer): statement
page 59, cash-flow page 61, Note 2 page 63, Note 3 page 64, Notes 4–6 page 65,
Notes 7–8 page 66.

| Note / table                                  | Line items | Printed subtotal `$’000` | Exact reconciliation (signed)                                                                                           | Face-statement link                |
| --------------------------------------------- | ---------: | -----------------------: | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Note 2 Revenue from water supply and delivery |          5 |                  379,720 | 224,540 + 96,158 + 24,204 + 25,304 + 9,514 = 379,720                                                                    | Revenue from water supply (line 2) |
| Note 4 Other revenue                          |          7 |                   49,948 | 12,820 + 1,401 + 639 + 4,199 + 4,624 + 14,750 + 11,515 = 49,948                                                         | Other revenue (line 4)             |
| Note 5 Employee related expenses              |          4 |                  163,654 | 186,924 − 43,838 + 2,827 + 17,741 = 163,654                                                                             | Employee related expenses          |
| Note 6 Other operating expenses               |         14 |                  113,348 | 26,927 + 3,535 + 21,943 + 5,490 + 6,753 + 7,391 + 6,762 + 7,457 + 1,074 + 3,638 + 484 + 5,073 + 7,579 + 9,242 = 113,348 | Other operating expenses           |
| Note 7 Depreciation and amortisation          |          3 |                  107,530 | 100,461 + 4,818 + 2,251 = 107,530                                                                                       | Depreciation and amortisation      |
| Note 8 Finance costs                          |          5 |                   88,299 | 66,265 + 388 + 24,567 − 3,660 + 739 = 88,299                                                                            | Finance costs                      |
| Statement of cash flows — investing           |          1 |                  170,828 | −170,828 + 3,267 = −167,561 (printed net cash used in investing activities)                                             | Investing cash outflow (not P&L)   |

The note components add **39 rows** (38 note lines plus the capital-expenditure
cash outflow) to the existing 8 WaterNSW rows, for **47 WaterNSW rows**. They
are not additional spending:

- every note row carries `soc_component_of` naming the printed subtotal it sums
  to (`revenue_from_water_supply_and_delivery`, `other_revenue`,
  `employee_expenses`, `other_operating_expenses`,
  `depreciation_amortisation`, `finance_costs`);
- `soc_section`, `soc_note` and `soc_breakdown` expose the grouping for the API
  and UI (revenue segments, other-revenue categories, employee components,
  other-operating categories, depreciation components, finance-cost components,
  capital);
- `aggregation_role` remains `agency_detail` and `potential_double_count` stays
  false for own-source rows, so no note row can enter an additive total;
- the printed deductions in Note 5 (capitalisation of employee expenses,
  43,838) and Note 8 (borrowing costs capitalised, 3,660) are stored as
  non-negative magnitudes with `soc_printed_sign: "negative"` because the model
  money type is non-negative. The reconciliation uses their printed signs. The
  UI shows a leading minus and a “printed deduction” caption.

**Deliberate exclusions** (to avoid double counting or unit ambiguity):

- Note 4 `Intra-group revenue – pipeline services` is parent-only (consolidated
  column is nil), so it is not a consolidated note row.
- Note 8 `Unwinding of discounts on provisions` is nil in 2025 (printed `-`), so
  it is not emitted.
- The Note 6 maintenance reconciliation (33,681) is a cross-cut of employee and
  other operating expenses required by TPP06-6, not a separate expense, so it is
  not ingested.
- Note 31 equity transfer (669) is an equity contribution/asset transfer, not
  revenue or expense; it is not ingested.
- Cash-flow `Receipts of grants and subsidies` (66,146) is a cash receipt, while
  Note 3 grants (65,336) are accrual revenue; ingesting both would double count,
  so only Note 3 is stored.
- The unaudited `$million` summary table (including the 160.6m accrual capital
  expenditure) is rounded and not the audited `$’000` statement; the audited
  cash-flow capex is stored instead.

### Two additional lines flagged for human spot-check (not verified)

1. **`water_supply_regulated_broken_hill_pipeline` (24,204 $’000)** — the
   parent column is nil; confirm the consolidated current-year column is the
   intended view and that the Broken Hill segment belongs to the consolidated
   entity.
2. **`capital_expenditure_cash` (170,828 $’000, printed as a cash outflow)** —
   confirm the cash-flow capex definition is the intended capital measure
   (it differs from the unaudited summary’s 160.6m accrual capital expenditure).

Both carry `human_spot_check: required`. No WaterNSW row is marked verified.

The API `/api/soc` returns `soc_section`, `soc_note`, `soc_component_of`,
`soc_breakdown` and `soc_printed_sign` per row, plus counts by section and note.
It still computes **no total**; the UI groups the rows by note in expandable
sections and labels every group “no total”. Tests cover unit detection, exact
subtotal reconciliation, the two-row deduction signs, zero-tolerance deferral on
a one-unit mismatch, natural-key uniqueness/idempotency, and the no-sum API
shape.

## 2B. Source: Hunter Water (third NSW SOC entity)

### Legal and entity basis

Hunter Water Corporation is a NSW statutory State Owned Corporation that
provides water, wastewater, recycled water and stormwater services in the Lower
Hunter region. Its general-purpose financial statements are prepared under the
_Government Sector Finance Act 2018_, the _State Owned Corporations Act 1989_
and NSW Treasury directions, and are audited by the Audit Office of New South
Wales. The annual report for 2024-25 was authorised for issue on 28 August 2025.

"Hunter Water" is the canonical `delivery_entity`. The entity-level statement is
**not** a level of government, **not** project spending, **not** geographically
disaggregated (no LGA, SA2, postcode or coordinate) and **not** the ABS PNFC
sector aggregate. It is stored with `jurisdiction_level: "soc"` and
`aggregation_role: "agency_detail"`. Hunter Water rows are never added to Sydney
Water's, WaterNSW's or any other SOC's rows.

### PDF discovery (no hard-coded URL)

The connector starts at Hunter Water's official reports-and-publications page:

`https://www.hunterwater.com.au/about/publications/reports-and-publications`

It parses the annual-report sub-page links, selects the latest report year,
then parses the PDF links on that sub-page. The CRFD, half-yearly and Statement
of Corporate Intent documents are explicitly excluded. There is no hard-coded
PDF URL; the discovery test proves the parser selects 2024-25 from a page that
also lists the CRFD and 2023-24.

Latest source found on 2026-11-17 (Annual Report 2024–25):

- URL: `https://www.hunterwater.com.au/documents/assets/src/uploads/documents/Annual-Reports-Past-Reports/Annual-report-2024-25.pdf`
- Discovery page: `https://www.hunterwater.com.au/about/publications/reports-and-publications/annual-report-2025`
- SHA-256: `2040f377e551769e102fa6f792b215abe5efa2dda558caf0b2d4639f5668b23a`
- Bytes: `13,658,943`
- Archive: outside the repo (`AUSSPEND_SOURCE_ARCHIVE` /
  `~/ausspend-source-archive/hunter-water/`)

### Printed unit detection and the `$'000` guard

The audited Income Statement (PDF page 77) prints `$'000` in both column
headers, and the Basis of preparation (PDF page 82) states all amounts are
rounded to the nearest thousand dollars. The adapter reads the statement unit
row and calls the shared `detectMoneyUnit`; the only accepted unit is
`thousands`. A statement whose header prints `$` (dollars) or no unit is
rejected with `phase: "unit"` and no rows are ingested. One `$'000` unit =
**100,000 cents**.

### Zero-tolerance reconciliation

The Income Statement prints (2025, `$'000`):

| Printed line                            | 2025          |
| --------------------------------------- | ------------- |
| Services                                | 446,759       |
| Other income                            | 290           |
| **Total revenue**                       | **447,049**   |
| Operational expenses                    | (198,606)     |
| Depreciation and amortisation           | (107,778)     |
| Finance costs                           | (88,870)      |
| Superannuation expense                  | (9,489)       |
| Asset revaluation increment/(decrement) | 7             |
| Other                                   | (13,590)      |
| **Total expenses**                      | **(418,326)** |
| **Profit before income tax**            | **28,723**    |
| Income tax expense                      | (9,316)       |
| Profit after income tax                 | 19,406        |
| Profit for the year                     | 19,406        |
| Notes 3 operational expenses            | 198,606       |
| Note 2 Government grants and rebates    | 19,901        |

The adapter accepts the explicit printed `Total expenses` only when:

- revenue components: 446,759 + 290 = 447,049 exactly;
- expense components: −198,606 −107,778 −88,870 −9,489 + 7 −13,590 = −418,326
  exactly (the +7 is the printed revaluation increment, a signed reduction);
- profit before tax: 447,049 + (−418,326) = 28,723 exactly;
- Note 3 operational expenses: 69,617 + 24,862 + 54,272 + 7,010 + 41,958 + 887
  = 198,606 exactly.

A one-unit mismatch in any of these bridges defers the whole document with
`phase: "reconciliation"`. The audited statement itself prints a one-dollar
tax/NPAT arithmetic rounding: PBT 28,723 − income tax 9,316 = 19,407, but the
printed Profit for the year is 19,406 (Note 5 also totals 9,316). The adapter
keeps the printed NPAT as the net-result line, records the difference as a
warning, does not use it in any reconciliation, and flags it for a human
spot-check. No figure is invented.

### Extracted rows

Every row is provisional, `verified: false`, `measure_type: "actual"`,
`jurisdiction_level: "soc"`, `jurisdiction: "NSW"`, `delivery_entity:
"Hunter Water"`, `location: { state: "NSW" }`, `source_dataset: "Hunter Water
Annual Report 2024-25"`, `source_url` the exact PDF, `data_quality_flag:
"provisional"`, `aggregation_role: "agency_detail"`, and a natural key
`sha256(entity + fiscal_year + line_item + document_url)` prefixed
`hunter-water:`.

| `soc_line_item`                 | Printed source                                 | 2025 `$'000` | funding_source                       | `potential_double_count` |
| ------------------------------- | ---------------------------------------------- | ------------ | ------------------------------------ | ------------------------ |
| `total_revenue`                 | Statement Total revenue                        | 447,049      | Hunter Water                         | false                    |
| `total_expenses`                | Statement Total expenses (explicit)            | **418,326**  | Hunter Water                         | false                    |
| `employee_expenses`             | Note 3 Operational expenses — Employee related | 69,617       | Hunter Water                         | false                    |
| `depreciation_amortisation`     | Statement Depreciation and amortisation        | 107,778      | Hunter Water                         | false                    |
| `net_result`                    | Statement Profit after income tax              | 19,406       | Hunter Water                         | false                    |
| `government_grants_and_rebates` | Note 2 Revenue                                 | 19,901       | NSW Government (agency not itemised) | **true**                 |

No project, LGA, SA2, postcode or coordinate is written. No line item is
invented: every value is a printed statement or note line.

### Two line items flagged for human spot-check (not verified)

1. **`total_expenses` (418,326 $'000)** — explicit printed total. Confirm it is
   the intended "total expenses" definition and that the signed revaluation
   increment is correctly treated as reducing expenses.
2. **`net_result` (19,406 $'000)** — the printed Profit for the year, retained
   despite the audited one-dollar tax/NPAT arithmetic rounding. Confirm the
   printed NPAT is the intended net result and not the derived 19,407.

Both rows carry `human_spot_check: required` in their notes. No Hunter Water row
is marked verified in this phase.

## 2C. Source: Essential Energy (fourth NSW SOC entity)

### Legal and entity basis

Essential Energy (the Corporation) is a NSW statutory State Owned Corporation
incorporated under the _State Owned Corporations Act 1989_. It distributes
electricity across regional NSW and delivers water services in Far West NSW
through Essential Water. Its consolidated general-purpose financial statements
are prepared under the _Government Sector Finance Act 2018_ and NSW Treasury
directions and are audited by the Audit Office of New South Wales. The 2024-25
consolidated statement of comprehensive income covers the year ended 30 June 2025.

"Essential Energy" is the canonical `delivery_entity`. The entity-level
statement is **not** a level of government, **not** project spending, **not**
geographically disaggregated (no LGA, SA2, postcode or coordinate) and **not**
the ABS PNFC sector aggregate. It is stored with `jurisdiction_level: "soc"` and
`aggregation_role: "agency_detail"`. Essential Energy rows are never added to
Sydney Water's, WaterNSW's, Hunter Water's or any other SOC's rows.

### PDF discovery (no hard-coded URL)

The connector starts at Essential Energy's official annual-report page:

`https://www.essentialenergy.com.au/about-us/corporate-governance/annual-report`

It parses every annual-report PDF link on that page — both the legacy
`/-/media/.../AnnualReportYYYY-YY.pdf` paths and the newer
`/ext/arYYYY/files/.../Essential-Energy_Annual-Report_YYYY-YY.pdf` paths —
ignores CRFD, pricing, GIPA, ENSMS and other non-annual PDFs, and selects the
latest fiscal year. There is no hard-coded PDF URL; the discovery test proves
the parser selects 2024-25 from a page that also lists 2023-24, GIPA, pricing
and an ENSMS report.

The html page is reachable in a normal browser but is behind a Cloudflare HTML
challenge from the ingestion host (the PDF endpoint itself returns 200). The
live ingest therefore uses the same operator escape hatch as WaterNSW:
`ESSENTIAL_ENERGY_ANNUAL_REPORT_URL` supplies the exact official PDF URL without
hard-coding it in source. The default path is live page discovery.

Latest source found on 2026-11-17 (Annual Report 2024–25):

- URL: `https://www.essentialenergy.com.au/ext/ar2025/files/2025/11/Essential-Energy_Annual-Report_2024-25.pdf`
- Discovery page: `https://www.essentialenergy.com.au/about-us/corporate-governance/annual-report`
- SHA-256: `eab0a3f4f3c7b8f53a636cd53eef0d375618c2c77035a236fe353cc7e90bec1d`
- Bytes: `19,147,042`
- Archive: outside the repo (`AUSSPEND_SOURCE_ARCHIVE` /
  `~/ausspend-source-archive/essential-energy/`)

### Printed unit detection and the `$M` guard

The consolidated statement of comprehensive income (PDF page 81) prints `$M` in
both column headers, and the Basis of Preparation (PDF page 86) states amounts
are rounded to the nearest tenth of a million dollars. The adapter reads the
statement unit row and calls the shared `detectMoneyUnit`; the only accepted
unit is `millions`. A statement whose header prints `$` (dollars), `$'000`
(thousands) or no unit is rejected with `phase: "unit"` and no rows are
ingested. One `$M` unit = **100,000,000 cents**; the printed one-decimal
precision is one tenth of a million = **10,000,000 cents**.

### Zero-tolerance reconciliation

The consolidated statement prints (2025, `$M`):

| Printed line                                          | 2025        |
| ----------------------------------------------------- | ----------- |
| Network revenue from contracts with customers         | 1,582.6     |
| Other revenue from contracts with customers           | 293.4       |
| Total revenue from contracts with customers           | 1,876.0     |
| Other revenue                                         | 30.0        |
| **Total revenue**                                     | **1,906.0** |
| Pass through costs                                    | (424.1)     |
| Operating expenses                                    | (723.7)     |
| Loss on disposal or write-off of non-financial assets | (59.0)      |
| EBITDA                                                | 699.2       |
| Depreciation, amortisation and impairment             | (497.2)     |
| EBIT                                                  | 202.0       |
| Net finance costs                                     | (338.7)     |
| **Loss before income tax**                            | **(136.7)** |
| Income tax benefit                                    | 40.9        |
| **Loss for the year**                                 | **(95.8)**  |
| **Derived total expenses** (five lines above)         | **2,042.7** |
| Note 2(c) Government grants and subsidies             | 25.4        |
| Note 3(b) Employee benefits (three lines)             | 399.3       |

The consolidated statement has **no single printed Total expenses subtotal**.
Following the Sydney Water precedent, `total_expenses` is the exact sum of the
printed entity-level expense lines — pass through costs, operating expenses,
loss on disposal/write-off, depreciation/amortisation/impairment and net finance
costs — and is accepted only when every printed bridge reconciles with zero
tolerance:

- revenue from contracts: 1,582.6 + 293.4 = 1,876.0 exactly;
- total revenue: 1,876.0 + 30.0 = 1,906.0 exactly;
- EBITDA: 1,906.0 − 424.1 − 723.7 − 59.0 = 699.2 exactly;
- EBIT: 699.2 − 497.2 = 202.0 exactly;
- expense components: −424.1 − 723.7 − 59.0 − 497.2 − 338.7 = −2,042.7
  exactly;
- profit before tax: 1,906.0 + (−2,042.7) = −136.7 exactly;
- net result: −136.7 + 40.9 = −95.8 exactly;
- Note 2(c): 25.4 + 4.6 = 30.0 = statement Other revenue exactly;
- Note 3(b): 70.2 + 1.3 + 327.8 + 323.1 + 1.3 = 723.7 exactly, with employee
  benefits 70.2 + 1.3 + 327.8 = 399.3;
- Note 3(d): 466.1 + 16.3 + 14.8 = 497.2 exactly.

A one-tenth-of-a-million mismatch in any bridge defers the whole document with
`phase: "reconciliation"`. No figure is invented and no component is summed into
the total except the five printed expense lines that form the derived total.

### Extracted rows

Every row is provisional, `verified: false`, `measure_type: "actual"`,
`jurisdiction_level: "soc"`, `jurisdiction: "NSW"`, `delivery_entity:
"Essential Energy"`, `location: { state: "NSW" }`, `source_dataset: "Essential
Energy Annual Report 2024-25"`, `source_url` the exact PDF, `data_quality_flag:
"provisional"`, `aggregation_role: "agency_detail"`, and a natural key
`sha256(entity + fiscal_year + line_item + document_url)` prefixed
`essential-energy:`.

| `soc_line_item`                   | Printed source                                      | 2025 `$M`   | funding_source                       | `potential_double_count` |
| --------------------------------- | --------------------------------------------------- | ----------- | ------------------------------------ | ------------------------ |
| `total_revenue`                   | Statement Total revenue                             | 1,906.0     | Essential Energy                     | false                    |
| `total_expenses`                  | Exact sum of the five printed expense lines         | **2,042.7** | Essential Energy                     | false                    |
| `employee_expenses`               | Note 3(b) Operating expenses — Employee benefits    | 399.3       | Essential Energy                     | false                    |
| `depreciation_amortisation`       | Statement Depreciation, amortisation and impairment | 497.2       | Essential Energy                     | false                    |
| `net_result`                      | Statement Loss for the year (printed negative)      | −95.8       | Essential Energy                     | false                    |
| `government_grants_and_subsidies` | Note 2(c) Other revenue                             | 25.4        | NSW Government (agency not itemised) | **true**                 |

The printed loss is stored as a non-negative `amount_cents` magnitude with
`soc_printed_sign: "negative"`, the same convention used for WaterNSW note
deductions. No project, LGA, SA2, postcode or coordinate is written. No line
item is invented: every value is a printed statement or note line.

### Two line items flagged for human spot-check (not verified)

1. **`total_expenses` (2,042.7 $M)** — derived, because the statement has no
   single printed Total expenses subtotal. Confirm that the five printed expense
   lines are the intended total-expenses definition and that pass through costs
   belong in total expenses.
2. **`net_result` (−95.8 $M)** — the printed Loss for the year, stored as a
   magnitude with a negative printed sign. Confirm the printed loss is the
   intended net result.

Both rows carry `human_spot_check: required` in their notes. No Essential Energy
row is marked verified in this phase.

## 2D. Source: Forestry Corporation of NSW (fifth NSW SOC entity)

Forestry Corporation of New South Wales is an NSW statutory State Owned
Corporation (the Corporation). Source id: `forestry-corporation`. Name:
`Forestry Corporation of NSW — Annual Report`. Publisher: Forestry Corporation
of NSW. Canonical `delivery_entity`: `Forestry Corporation of NSW`.

The connector starts at the official annual-report page
(`https://www.forestrycorporation.com.au/about/pubs/corporate/annual-report`) and
selects the latest annual-report PDF. No PDF URL is hard-coded. The site's HTML
pages sit behind a Cloudflare challenge from the ingestion host, so the live
ingest can supply the exact official PDF URL through
`FORESTRY_CORPORATION_ANNUAL_REPORT_URL`.

- Document: `Annual Report 2024–25`
- Official PDF: `https://www.forestrycorporation.com.au/__data/assets/pdf_file/0009/1650285/annual-report-2024-25.pdf`
- Bytes: `6,448,775` (SHA-256
  `18f9fa57718cd6177d505298d0fd214f897028b2db76e8a3e257376aa392be10`)
- Printed unit: **`$‘000`** (thousands), stated on the face statement. The Basis
  of Preparation (Note 2) states all values are rounded to the nearest thousand
  dollars. `AUD_thousands`; `amount_cents = $'000 × 100,000`. A table read as
  dollars or millions is rejected and the document is deferred.
- Income statement: _Statement of profit or loss and other comprehensive income_
  for the year ended 30 June 2025.

### Exact reconciliation (zero tolerance, printed 2025 column, $‘000)

| Printed line                                    | 2025 ($‘000) |
| ----------------------------------------------- | -----------: |
| Revenue from contracts with customers           |      335,995 |
| Other income (Note 5)                           |       48,833 |
| Investment revenue (Note 6)                     |        3,729 |
| **Total revenue**                               |  **388,557** |
| Other operating expenses (Note 8)               |      279,691 |
| Employee benefits expense (Note 9)              |       89,610 |
| Depreciation and amortisation expense           |       12,163 |
| Finance costs (Note 10)                         |        3,068 |
| **Total expenses** (explicit printed)           |  **384,532** |
| Other gains/(losses)                            |       33,809 |
| Net impairment of right-of-use asset            |           82 |
| Net impairment of property, plant and equipment |        8,274 |
| Fair value loss on revaluation                  |          171 |
| Impairment loss on receivables                  |          474 |
| **Net profit before income tax**                |   **28,833** |
| Income tax expense                              |        8,995 |
| **Net profit after income tax**                 |   **19,838** |

1. Revenue components: `335,995 + 48,833 + 3,729 = 388,557` (Total revenue).
2. Expense components: `279,691 + 89,610 + 12,163 + 3,068 = 384,532` (printed
   Total expenses).
3. Profit before tax: `388,557 − 384,532 + 33,809 − 82 − 8,274 − 171 − 474 + 0
= 28,833`.
4. Net result: `28,833 − 8,995 = 19,838`.
5. Note 5 Other income: `31,511 + 12,192 + 0 + 5,130 = 48,833`.
6. Note 8 Other operating expenses: the ten printed components sum to `279,691`.
7. Note 9 Employee benefits: `80,800 + 7,255 + 1,555 = 89,610`.
8. Note 10 Finance costs: `−101 + 950 + 1,982 + 237 = 3,068`.

Any one-thousand-dollar mismatch defers the whole document; no partial rows are
ingested.

### Ingested line items (7 rows)

| `soc_line_item`                                   | Printed source                          | 2025 ($‘000) | `funding_source`                     | `potential_double_count` |
| ------------------------------------------------- | --------------------------------------- | -----------: | ------------------------------------ | ------------------------ |
| `total_revenue`                                   | Statement Total revenue                 |      388,557 | Forestry Corporation of NSW          | false                    |
| `total_expenses`                                  | Statement Total expenses (explicit)     |  **384,532** | Forestry Corporation of NSW          | false                    |
| `employee_expenses`                               | Statement Employee benefits expense     |       89,610 | Forestry Corporation of NSW          | false                    |
| `depreciation_amortisation`                       | Statement Depreciation and amortisation |       12,163 | Forestry Corporation of NSW          | false                    |
| `government_grants_community_service_obligations` | Note 5 Grants revenue — CSO             |       31,511 | NSW Government (agency not itemised) | **true**                 |
| `government_grants_other_state_government`        | Note 5 Grants revenue — other state     |       12,192 | NSW Government (agency not itemised) | **true**                 |
| `net_result`                                      | Statement Net profit after income tax   |   **19,838** | Forestry Corporation of NSW          | false                    |

`total_revenue` includes both grant lines; `total_expenses` includes employee
benefits and depreciation; `net_result` is a result. None of the seven rows may be
added to another SOC row, the PNFC benchmark or government program spending.

### Two line items flagged for human spot-check (not verified)

1. **`total_expenses` (384,532 $‘000)** — confirm the four printed expense lines
   are the intended total-expenses definition.
2. **`net_result` (19,838 $‘000)** — confirm the printed profit after income tax
   is the intended net result.

Both rows carry `human_spot_check: required` in their notes. No Forestry
Corporation row is marked verified in this phase.

## 2E. Source: Landcom (sixth NSW SOC entity)

Landcom is an NSW State Owned Corporation. Source id: `landcom`. Name:
`Landcom — Annual Report`. Publisher: Landcom. Canonical `delivery_entity`:
`Landcom`.

The connector starts at the official corporate-publications page
(`https://www.landcom.com.au/about-us/corporate-publications`) and selects the
latest annual-report PDF. No PDF URL is hard-coded.

- Document: `Annual Report 2024–25`
- Official PDF: `https://www.landcom.com.au/assets/Uploads/Corporate-Publications/Annual-Reports/2025-Landcom-Annual-Report.pdf`
- Bytes: `11,626,511` (SHA-256
  `c6705af233418da1307afadf38d87fb170c6f9f9993434460b740480ea1042f2`)
- Printed unit: **`$‘000`** (thousands), stated on the face statement.
  `AUD_thousands`; `amount_cents = $'000 × 100,000`. A table read as dollars or
  millions is rejected and the document is deferred.
- Statement: _Statement of Comprehensive Income_ for the year ended 30 June 2025
  (PDF page 86).

### Exact reconciliation (zero tolerance, printed 2025 column, $‘000)

| Printed line                                     | 2025 ($‘000) |
| ------------------------------------------------ | -----------: |
| Revenue from contracts with customers            |      263,423 |
| Cost of sales                                    |    (143,085) |
| **Gross profit**                                 |  **120,338** |
| Other income (Note 2.2)                          |        2,663 |
| Finance income (Note 2.3)                        |       11,101 |
| Employee related expenses (Note 2.4)             |     (29,737) |
| Other expenses (Note 2.5)                        |     (29,361) |
| Depreciation and amortisation expense (Note 2.6) |      (3,040) |
| Net fair value loss on investment properties     |      (8,120) |
| Finance costs (Note 2.3)                         |        (652) |
| **Profit before income tax**                     |   **63,192** |
| Income tax equivalent expense                    |     (18,959) |
| **Net profit for the year**                      |   **44,233** |

The statement prints **no Total revenue and no Total expenses subtotal**
(unlike Sydney Water/WaterNSW/Hunter Water/Forestry Corporation). Following the
Essential Energy precedent, both are the exact signed sums of the printed
statement lines, accepted only because every printed bridge reconciles:

1. Gross profit: `263,423 − 143,085 = 120,338`.
2. Derived total revenue: `263,423 + 2,663 + 11,101 = 277,187`.
3. Derived total expenses: `143,085 + 29,737 + 29,361 + 3,040 + 8,120 + 652
= 213,995`.
4. Profit before tax: `277,187 − 213,995 = 63,192`.
5. Net result: `63,192 − 18,959 = 44,233`.
6. Note 2.2 Other income: `2,285 + 378 = 2,663`.
7. Note 2.3 Finance income: `4,978 + 4,649 + 794 + 680 = 11,101`; finance costs
   (lease interest) `652`.
8. Note 2.4 Employee related expenses: `31,609 + 621 + 172 + 3,762 + 727 + 2,661
   - 2,240 + 2,176 = 43,968`; less amounts capitalised `14,231 = 29,737`.
9. Note 2.5 Other expenses: the eleven printed components net of the `(185)`
   write-back sum to `38,908`; less transfer of capital costs to inventories
   `9,547 = 29,361`.
10. Note 2.6 Depreciation and amortisation: `1,727 + 194 + 421 + 681 + 17
= 3,040`.

Any one-thousand-dollar mismatch defers the whole document; no partial rows are
ingested.

### Ingested line items (6 rows)

| `soc_line_item`             | Printed source                          | 2025 ($‘000) | `funding_source`                     | `potential_double_count` |
| --------------------------- | --------------------------------------- | -----------: | ------------------------------------ | ------------------------ |
| `total_revenue`             | Exact sum of printed revenue lines      |      277,187 | Landcom                              | false                    |
| `total_expenses`            | Exact sum of printed expense lines      |  **213,995** | Landcom                              | false                    |
| `employee_expenses`         | Statement Employee related expenses     |       29,737 | Landcom                              | false                    |
| `depreciation_amortisation` | Statement Depreciation and amortisation |        3,040 | Landcom                              | false                    |
| `government_grants`         | Note 2.2 Grant income                   |        2,285 | NSW Government (agency not itemised) | **true**                 |
| `net_result`                | Statement Net profit for the year       |   **44,233** | Landcom                              | false                    |

`total_revenue` includes the separately shown grant income; `total_expenses`
includes employee and depreciation; `net_result` is a result. None of the six
rows may be added to another SOC row, the PNFC benchmark or government program
spending.

### Two line items flagged for human spot-check (not verified)

1. **`total_expenses` (213,995 $‘000)** — derived, because the statement has no
   printed Total expenses subtotal. Confirm that the six printed expense lines
   (including cost of sales and the net fair value loss on investment
   properties) are the intended total-expenses definition.
2. **`net_result` (44,233 $‘000)** — confirm the printed net profit for the year
   is the intended net result.

Both rows carry `human_spot_check: required` in their notes. No Landcom row is
marked verified in this phase.

## 2F. Source: Port Authority of NSW (seventh NSW SOC entity)

Port Authority of NSW is an NSW State Owned Corporation (Newcastle Port
Corporation trading as Port Authority of NSW). Source id:
`port-authority-nsw`. Name: `Port Authority of NSW — Annual Report`. Publisher:
Port Authority of NSW. Canonical `delivery_entity`: `Port Authority of NSW`.

The connector starts at the official annual-reports page
(`https://www.portauthoritynsw.com.au/corporate/corporate-governance/port-authority-nsw-annual-reports/`)
and selects the latest annual-report PDF. No PDF URL is hard-coded.

- Document: `Annual Report 2024–25`
- Official PDF: `https://www.portauthoritynsw.com.au/sites/default/files/2025-12/Port%20Authority%20of%20NSW%20Annual%20Report%202024-25.pdf`
- Bytes: `14,911,040` (SHA-256
  `5311425dbdaec28dc4155dc486c77eb49f7707cc05aba039856f0bf3c2a1794d`)
- Printed unit: **`$000`** (thousands), stated on the face statement.
  `AUD_thousands`; `amount_cents = $'000 × 100,000`. A table read as dollars or
  millions is rejected and the document is deferred.
- Statement: _Statement of comprehensive income_ for the year ended 30 June 2025
  (PDF page 47).

### Exact reconciliation (zero tolerance, printed 2025 column, $'000)

| Printed line                                      | 2025 ($'000) |
| ------------------------------------------------- | -----------: |
| Revenue from port management                      |      176,929 |
| Investment revenue                                |       41,353 |
| Other revenue                                     |       19,972 |
| **Total revenue**                                 |  **238,254** |
| Employee related expenses                         |     (96,061) |
| Depreciation and amortisation expenses            |     (21,650) |
| Other expenses                                    |     (65,562) |
| Finance costs                                     |      (7,680) |
| **Total expenses**                                |  **190,953** |
| Net gain on sale of property, plant and equipment |           82 |
| Other gains                                       |          577 |
| **Profit before income tax equivalent expense**   |   **47,960** |
| Income tax equivalent expense                     |     (11,665) |
| **Net profit after tax for the year**             |   **36,295** |

The statement prints explicit Total revenue and Total expenses subtotals. Both
are accepted only when every printed bridge reconciles:

1. Total revenue: `176,929 + 41,353 + 19,972 = 238,254`.
2. Total expenses: `96,061 + 21,650 + 65,562 + 7,680 = 190,953`.
3. Profit before tax: `238,254 − 190,953 + 82 + 577 = 47,960`.
4. Net result: `47,960 − 11,665 = 36,295`.
5. Note 3 Revenue prints `Total revenue` = `238,254`, equal to the face statement.
6. Note 4 Expenses prints `Total expenses` = `190,953`, equal to the face statement.

Any one-thousand-dollar mismatch defers the whole document; no partial rows are
ingested. Port Authority of NSW does **not** separately disclose government
grants/contributions in this statement or its notes, so no grants row is
emitted; a grant is never estimated or zero-filled.

### Ingested line items (5 rows)

| `soc_line_item`             | Printed source                                  | 2025 ($'000) | `funding_source`      | `potential_double_count` |
| --------------------------- | ----------------------------------------------- | -----------: | --------------------- | ------------------------ |
| `total_revenue`             | Printed statement Total revenue                 |      238,254 | Port Authority of NSW | false                    |
| `total_expenses`            | Printed statement Total expenses                |  **190,953** | Port Authority of NSW | false                    |
| `employee_expenses`         | Statement Employee related expenses             |       96,061 | Port Authority of NSW | false                    |
| `depreciation_amortisation` | Statement Depreciation and amortisation expense |       21,650 | Port Authority of NSW | false                    |
| `net_result`                | Statement Net profit after tax for the year     |   **36,295** | Port Authority of NSW | false                    |

`total_revenue` includes all three printed revenue lines; `total_expenses`
includes employee, depreciation/amortisation, other expenses and finance costs;
`net_result` is a result. None of the five rows may be added to another SOC row,
the PNFC benchmark or government program spending.

### Two line items flagged for human spot-check (not verified)

1. **`total_expenses` (190,953 $'000)** — the printed Total expenses subtotal.
   Confirm that the four printed expense lines are the intended total-expenses
   definition.
2. **`net_result` (36,295 $'000)** — confirm the printed net profit after tax is
   the intended net result.

Both rows carry `human_spot_check: required` in their notes. No Port Authority of
NSW row is marked verified in this phase.

## 2G. Source: TAHE (eighth NSW SOC entity)

TAHE is the Transport Asset Holding Entity of New South Wales, an NSW State
Owned Corporation. Its former domains (`tahe.com.au`, `tahensw.com.au`) now
redirect to **Transport Asset Manager (TAM) of NSW**, its statutory successor and
current official publisher. Source id: `tahe`. Name: `TAHE — Annual Report`.
Publisher: Transport Asset Holding Entity of NSW (published by Transport Asset
Manager of NSW). Canonical `delivery_entity`: `TAHE` (the report's full legal
name, Transport Asset Holding Entity of New South Wales, is recorded in every
row's notes).

The connector starts at the official publications page
(`https://www.tam.nsw.gov.au/publications`) and selects the latest annual-report
PDF. No PDF URL is hard-coded.

- Document: `TAHE Annual Report 2023–24` — the latest annual report published on
  the official page at retrieval (2026-11-17). A FY2024-25 report is not listed
  there; the adapter does not guess or substitute another document.
- Official PDF:
  `https://www.tam.nsw.gov.au/sites/default/files/2025-01/Transport%20Asset%20Holding%20Entity%20of%20NSW%20202324%20Annual%20Report_0.pdf`
- Bytes: `9,262,428` (SHA-256
  `53508050276f7641edc594b300626640aa64dbc26442a1144225f9a78d0bb4e4`)
- Printed unit: **`$'000`** (thousands), stated on the audited face statement.
  `AUD_thousands`; `amount_cents = $'000 × 100,000`. A table read as dollars or
  millions is rejected and the document is deferred.
- Statement: _Statement of comprehensive income_ for the year ended 30 June 2024
  (audited financial statements, PDF page 60). The financial-performance summary
  table on page 51 prints the same values.

### Exact reconciliation (zero tolerance, printed 2024 column, $'000)

| Printed line                                                                     |   2024 ($'000) |
| -------------------------------------------------------------------------------- | -------------: |
| Revenue from contracts with customers                                            |        557,518 |
| Investment revenue                                                               |        490,176 |
| Grants and contributions                                                         |      1,269,799 |
| Valuation increment of property, plant and equipment and intangible assets       |     17,787,495 |
| Other income                                                                     |         38,952 |
| **Total revenue**                                                                | **20,143,940** |
| Employee-related expenses                                                        |       (10,507) |
| Other operating expenses                                                         |      (240,007) |
| Valuation decrement of property, plant and equipment and intangible assets (nil) |              – |
| Other expenses                                                                   |       (50,072) |
| Depreciation, amortisation and de-recognition                                    |    (1,334,576) |
| Finance costs                                                                    |       (86,884) |
| **Total expenses**                                                               |  **1,722,046** |
| **Net result**                                                                   | **18,421,894** |

The statement prints explicit Total revenue and Total expenses subtotals. Both
are accepted only when every printed bridge reconciles:

1. Total revenue: `557,518 + 490,176 + 1,269,799 + 17,787,495 + 38,952 = 20,143,940`.
2. Total expenses: `10,507 + 240,007 + 0 + 50,072 + 1,334,576 + 86,884 = 1,722,046`.
   The printed Valuation decrement is an explicit nil (`-`), not a missing cell.
3. Net result: `20,143,940 − 1,722,046 = 18,421,894`.

Any one-thousand-dollar mismatch defers the whole document; no partial rows are
ingested. TAHE separately discloses **Grants and contributions** (Note 2.3:
Capital 1,128,777 + Operating 141,022 = 1,269,799), already included in Total
revenue, so it is emitted as a separate grant row with
`potential_double_count: true`.

The FY2023-24 result is not comparable with prior years: TAHE changed from a
for-profit to a not-for-profit entity for accounting purposes, which produced a
$17.8bn valuation increment in revenue and a change in grants recognition.
Those facts are recorded in the rows and caveat; they are not adjusted.

### Ingested line items (6 rows)

| `soc_line_item`             | Printed source                                          |   2024 ($'000) | `funding_source`                     | `potential_double_count` |
| --------------------------- | ------------------------------------------------------- | -------------: | ------------------------------------ | ------------------------ |
| `total_revenue`             | Printed statement Total revenue                         |     20,143,940 | TAHE                                 | false                    |
| `total_expenses`            | Printed statement Total expenses                        |  **1,722,046** | TAHE                                 | false                    |
| `employee_expenses`         | Statement Employee-related expenses                     |         10,507 | TAHE                                 | false                    |
| `depreciation_amortisation` | Statement Depreciation, amortisation and de-recognition |      1,334,576 | TAHE                                 | false                    |
| `government_grants`         | Statement Grants and contributions (Note 2.3)           |      1,269,799 | NSW Government (agency not itemised) | true                     |
| `net_result`                | Printed statement Net result                            | **18,421,894** | TAHE                                 | false                    |

`total_revenue` includes all five printed revenue lines; `total_expenses`
includes the five non-nil printed expense lines plus the explicitly printed nil
valuation decrement; `net_result` is a result. None of the six rows may be added
to another SOC row, the PNFC benchmark or government program spending.

### Two line items flagged for human spot-check (not verified)

1. **`total_expenses` (1,722,046 $'000)** — the printed Total expenses subtotal.
   Confirm that the printed expense lines (including the nil valuation
   decrement) are the intended total-expenses definition.
2. **`net_result` (18,421,894 $'000)** — confirm the printed net result is the
   intended result, noting the valuation increment and grants-recognition change
   that dominate FY2023-24.

Both rows carry `human_spot_check: required` in their notes. No TAHE row is
marked verified in this phase.

## 2H. Source: Sydney Trains (ninth NSW SOC entity)

Sydney Trains is a New South Wales State Owned Corporation reported within the
Transport portfolio. Source id: `sydney-trains`. Name: `Sydney Trains — Annual
Report`. Publisher: Sydney Trains (Transport for NSW). Canonical
`delivery_entity`: `Sydney Trains`.

The connector starts at the official Transport for NSW page
(`https://www.transport.nsw.gov.au/news-and-events/reports-and-publications/sydney-trains-annual-reports`)
and selects the latest report year. No PDF URL is hard-coded. Sydney Trains
publishes its annual report in two volumes; the audited Statement of
comprehensive income is in Volume 2 (audited financial statements), so discovery
selects the financial-statements volume of the latest report year. Older report
years published as a single PDF fall back to that single file.

- Document: `Sydney Trains Annual Report 2024–25, Volume 2 — audited financial
statements` — the latest report published on the official page at retrieval
  (2026-11-17).
- Official PDF:
  `https://www.transport.nsw.gov.au/system/files/media/documents/2025/sydney-trains-annual-report-2024%E2%80%9325-volume-2.pdf`
- Bytes: `2,104,788` (SHA-256
  `676354a52c69dac616e9de05a62102ac3949c551fa0f4fae8490afef130d4eb0`)
- Printed unit: **`$'000`** (thousands), stated on the audited face statement.
  `AUD_thousands`; `amount_cents = $'000 × 100,000`. A table read as dollars or
  millions is rejected and the document is deferred.
- Statement: Statement of comprehensive income for the year ended 30 June 2025
  (audited financial statements, PDF page 6). The same volume contains the
  signed Chief Executive statement (3 October 2025) and the signed independent
  auditor's report (7 October 2025); the report was first published in November 2025.
- Provenance caveat: the published Volume 2 PDF carries a **“Draft for year end
  June 2025”** footer on every page. Because the document is the officially
  published FY2024–25 release and contains the signed declarations, that footer
  is recorded as a provenance caveat on every row and flagged for human
  spot-check rather than silently ignored.

### Exact reconciliation (zero tolerance, printed 2025 column, $'000)

| Printed line                                                  |  2025 ($'000) |
| ------------------------------------------------------------- | ------------: |
| Sale of goods and services from contracts with customers      |     1,247,953 |
| Investment revenue                                            |        69,173 |
| Major rail project revenue                                    |       434,663 |
| Other income                                                  |         7,263 |
| **Total revenue**                                             | **1,759,052** |
| Employee-related expenses                                     |     1,997,053 |
| Personnel services                                            |       112,917 |
| Other operating expenses                                      |     2,264,961 |
| Major rail project expenses                                   |       434,663 |
| Depreciation and amortisation                                 |       321,716 |
| Finance costs                                                 |       245,120 |
| **Total expenses excluding losses**                           | **5,376,430** |
| Deficit from operations before grants and other contributions |   (3,617,378) |
| Grants and contributions                                      |     3,500,212 |
| (Deficit)/surplus from operations                             |     (117,166) |
| Gains/(losses) on disposal                                    |      (11,376) |
| Other gains/(losses)                                          |           179 |
| Impairment reversals/(losses) on financial assets             |            86 |
| **Net result**                                                | **(128,277)** |

The statement prints an explicit Total revenue and an explicit Total expenses
excluding losses subtotal. Both are accepted only when every printed bridge
reconciles:

1. Total revenue: `1,247,953 + 69,173 + 434,663 + 7,263 = 1,759,052`.
2. Total expenses excluding losses:
   `1,997,053 + 112,917 + 2,264,961 + 434,663 + 321,716 + 245,120 = 5,376,430`.
3. Deficit before grants: `1,759,052 − 5,376,430 = (3,617,378)`.
4. Operations result: `(3,617,378) + 3,500,212 = (117,166)`.
5. Net result: `(117,166) + (11,376) + 179 + 86 = (128,277)`.

Any one-thousand-dollar mismatch defers the whole document; no partial rows are
ingested. Grants and contributions are presented **below** Total revenue and are
not part of it; they are included in the net-result bridge and emitted as a
separate grant row with `potential_double_count: true`. The below-the-line
Gains/(losses) on disposal, Other gains/(losses) and Impairment
reversals/(losses) are excluded from Total expenses excluding losses and are
included only in the net-result bridge.

### Ingested line items (6 rows)

| `soc_line_item`             | Printed source                                    |  2025 ($'000) | `funding_source`                   | `potential_double_count` |
| --------------------------- | ------------------------------------------------- | ------------: | ---------------------------------- | ------------------------ |
| `total_revenue`             | Printed statement Total revenue                   |     1,759,052 | Sydney Trains                      | false                    |
| `total_expenses`            | Printed statement Total expenses excluding losses | **5,376,430** | Sydney Trains                      | false                    |
| `employee_expenses`         | Statement Employee-related expenses               |     1,997,053 | Sydney Trains                      | false                    |
| `depreciation_amortisation` | Statement Depreciation and amortisation           |       321,716 | Sydney Trains                      | false                    |
| `government_grants`         | Statement Grants and contributions (Note 2(c))    |     3,500,212 | NSW Government — Transport for NSW | true                     |
| `net_result`                | Printed statement Net result                      | **(128,277)** | Sydney Trains                      | false                    |

`total_revenue` is the four printed revenue lines and excludes grants;
`total_expenses` is the six printed expense lines and excludes the below-the-line
gains/losses; `net_result` is a result. None of the six rows may be added to
another SOC row, the PNFC benchmark or government program spending.

### Two line items flagged for human spot-check (not verified)

1. **`total_expenses` (5,376,430 $'000)** — the printed Total expenses excluding
   losses subtotal. Confirm that excluding the below-the-line gains/losses is the
   intended total-expenses definition, and that the Volume 2 “Draft” footer is a
   document-control artefact.
2. **`net_result` ((128,277) $'000)** — confirm the printed deficit is the
   intended result, retained with a negative sign.

Both rows carry `human_spot_check: required` in their notes. No Sydney Trains
row is marked verified in this phase.

## 2I. Source: NSW TrainLink (tenth NSW SOC entity)

NSW TrainLink is the regional rail and coach brand reported within the
Transport portfolio; the audited financial statements are for the legal entity
**NSW Trains**, a statutory corporation constituted on 7 December 2012 under the
Transport Administration Act 1988 (NSW). Source id: `nsw-trainlink`. Name:
`NSW TrainLink — Annual Report`. Publisher: NSW TrainLink (Transport for NSW).
Canonical `delivery_entity`: `NSW TrainLink` (the published brand); every row
records `entity_legal_name: NSW Trains` in its notes.

The connector starts at the official Transport for NSW page
(`https://www.transport.nsw.gov.au/news-and-events/reports-and-publications/nsw-trainlink-annual-reports`)
and selects the latest report year. No PDF URL is hard-coded. NSW TrainLink
publishes its annual report in two volumes; the audited Statement of
comprehensive income is in Volume 2 (audited financial statements), so discovery
selects the financial-statements volume of the latest report year. Older report
years published as a single PDF fall back to that single file.

- Document: `NSW TrainLink Annual Report 2024–25, Volume 2 — audited financial
statements` — the latest report published on the official page at retrieval
  (2026-11-17).
- Official PDF:
  `https://www.transport.nsw.gov.au/system/files/media/documents/2025/nsw-trainlink-annual-report-2024%E2%80%9325-volume-2.pdf`
- Bytes: `1,682,671` (SHA-256
  `31db9476ca47e87e9ca8afce05437bbfe58b97367b5420e7195ae527f8ee7aea`)
- Printed unit: **`$'000`** (thousands), stated on the audited face statement.
  `AUD_thousands`; `amount_cents = $'000 × 100,000`. A table read as dollars or
  millions is rejected and the document is deferred.
- Statement: Statement of comprehensive income for the year ended 30 June 2025
  (audited financial statements, PDF page 6). The volume contains the signed
  Chief Executive responsibilities statement and the independent auditor's
  report.
- Provenance caveat: the report is branded **NSW TrainLink**, but the audited
  statement and note 1(a) reporting entity are **NSW Trains**. That brand/legal
  entity difference is recorded verbatim on every row and flagged for human
  spot-check rather than hidden. There is no draft footer on this PDF.

### Exact reconciliation (zero tolerance, printed 2025 column, $'000)

| Printed line                                             | 2025 ($'000) |
| -------------------------------------------------------- | -----------: |
| Sale of goods and services from contracts with customers |       93,258 |
| Investment revenue                                       |        3,803 |
| Other income                                             |           19 |
| **Total revenue**                                        |   **97,080** |
| Employee-related expenses                                |      140,911 |
| Personnel services                                       |        8,106 |
| Other operating expenses                                 |      183,622 |
| Depreciation and amortisation                            |       35,419 |
| Finance costs                                            |        9,684 |
| **Total expenses excluding losses**                      |  **377,742** |
| Deficit from operations before grants and contributions  |    (280,662) |
| Grants and contributions                                 |      395,366 |
| Surplus/(deficit) from operations                        |      114,704 |
| Gains/(losses) on disposal                               |        (887) |
| Impairment reversals/(losses) on financial assets        |            - |
| **Net result**                                           |  **113,817** |

The statement prints an explicit Total revenue and an explicit Total expenses
excluding losses subtotal. Both are accepted only when every printed bridge
reconciles:

1. Total revenue: `93,258 + 3,803 + 19 = 97,080`.
2. Total expenses excluding losses:
   `140,911 + 8,106 + 183,622 + 35,419 + 9,684 = 377,742`.
3. Deficit before grants: `97,080 − 377,742 = (280,662)`.
4. Operations result: `(280,662) + 395,366 = 114,704`.
5. Net result: `114,704 + (887) + 0 = 113,817` (an explicitly printed nil
   impairment dash is read as zero, never as a guessed value).

Any one-thousand-dollar mismatch defers the whole document; no partial rows are
ingested. Grants and contributions are presented **below** Total revenue and are
not part of it; they are included in the deficit/operations bridge and emitted as
a separate grant row with `potential_double_count: true`. Note 2(c) discloses
Grants from TfNSW `395,051` plus Personnel services benefit `315 = 395,366`.
The below-the-line Gains/(losses) on disposal and Impairment
reversals/(losses) are excluded from Total expenses excluding losses and are
included only in the net-result bridge.

### Ingested line items (6 rows)

| `soc_line_item`             | Printed source                                    | 2025 ($'000) | `funding_source`                   | `potential_double_count` |
| --------------------------- | ------------------------------------------------- | -----------: | ---------------------------------- | ------------------------ |
| `total_revenue`             | Printed statement Total revenue                   |       97,080 | NSW TrainLink                      | false                    |
| `total_expenses`            | Printed statement Total expenses excluding losses |  **377,742** | NSW TrainLink                      | false                    |
| `employee_expenses`         | Statement Employee-related expenses               |      140,911 | NSW TrainLink                      | false                    |
| `depreciation_amortisation` | Statement Depreciation and amortisation           |       35,419 | NSW TrainLink                      | false                    |
| `government_grants`         | Statement Grants and contributions (Note 2(c))    |      395,366 | NSW Government — Transport for NSW | true                     |
| `net_result`                | Printed statement Net result                      |  **113,817** | NSW TrainLink                      | false                    |

`total_revenue` is the three printed revenue lines and excludes grants;
`total_expenses` is the five printed expense lines and excludes the below-the-line
gains/losses; `net_result` is a result. None of the six rows may be added to
another SOC row, the PNFC benchmark or government program spending.

### Two line items flagged for human spot-check (not verified)

1. **`total_expenses` (377,742 $'000)** — the printed Total expenses excluding
   losses subtotal. Confirm that excluding the below-the-line gains/losses is the
   intended total-expenses definition, and that the NSW TrainLink brand over the
   NSW Trains legal entity is recorded correctly.
2. **`net_result` (113,817 $'000)** — confirm the printed surplus is the intended
   result, retained with a positive sign.

Both rows carry `human_spot_check: required` in their notes. No NSW TrainLink
row is marked verified in this phase.

## 3. Mapping (PNFC and SOC)

| Field                    | PNFC benchmark                                  | Sydney Water SOC                                         | WaterNSW SOC                                             | Hunter Water SOC                                         |
| ------------------------ | ----------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------- |
| `jurisdiction_level`     | `pnfc`                                          | `soc`                                                    | `soc`                                                    | `soc`                                                    |
| `jurisdiction`           | `Australia` or `NSW`/`VIC`/…                    | `NSW`                                                    | `NSW`                                                    | `NSW`                                                    |
| `location`               | absent for national; `{ state }` for state rows | `{ state: "NSW" }` (statewide only)                      | `{ state: "NSW" }` (statewide only)                      | `{ state: "NSW" }` (statewide only)                      |
| `function_code`          | absent                                          | absent                                                   | absent                                                   | absent                                                   |
| `amount_cents`           | `$m × 100,000,000`                              | `$’000 × 100,000`                                        | `$’000 × 100,000`                                        | `$'000 × 100,000`                                        |
| `measure_type`           | `actual`                                        | `actual`                                                 | `actual`                                                 | `actual`                                                 |
| `aggregation_role`       | `benchmark`                                     | `agency_detail`                                          | `agency_detail`                                          | `agency_detail`                                          |
| `verified`               | `true`                                          | `false`                                                  | `false`                                                  | `false`                                                  |
| `data_quality_flag`      | `verified`                                      | `provisional`                                            | `provisional`                                            | `provisional`                                            |
| `gfs_flow`               | `revenue` / `expense`                           | absent (`soc_line_item` carries the line)                | absent (`soc_line_item` carries the line)                | absent (`soc_line_item` carries the line)                |
| `soc_line_item`          | absent                                          | stable line key (table above)                            | stable line key (table above)                            | stable line key (table above)                            |
| `soc_unit`               | absent                                          | `AUD_thousands`                                          | `AUD_thousands`                                          | `AUD_thousands`                                          |
| `potential_double_count` | absent                                          | `true` for government-named rows, `false` for own-source | `true` for government-named rows, `false` for own-source | `true` for government-named rows, `false` for own-source |
| `natural_key`            | `abs-gfs-pnfc:` + 40 hex                        | `sydney-water:` + 40 hex                                 | `waternsw:` + 40 hex                                     | `hunter-water:` + 40 hex                                 |

Landcom follows the same SOC mapping: `jurisdiction_level` `soc`, `jurisdiction`/`location` NSW, `amount_cents = $'000 × 100,000`, `measure_type` `actual`, `aggregation_role` `agency_detail`, `verified` `false`, `data_quality_flag` `provisional`, `soc_unit` `AUD_thousands`, and `natural_key` prefix `landcom:`. Its one grant-income row is `potential_double_count: true`.

Port Authority of NSW follows the same SOC mapping with `natural_key` prefix `port-authority-nsw:`. It has no grant row because none is separately disclosed.

TAHE follows the same SOC mapping with `natural_key` prefix `tahe:`, `delivery_entity` `TAHE`, `funding_source` `TAHE` for its own rows, and `source_dataset` `TAHE Annual Report 2023-24`. Its separately disclosed Grants and contributions row is `potential_double_count: true` with `funding_source` `NSW Government (agency not itemised)`.

Sydney Trains follows the same SOC mapping with `natural_key` prefix `sydney-trains:`, `delivery_entity` `Sydney Trains`, `funding_source` `Sydney Trains` for its own rows, and `source_dataset` `Sydney Trains Annual Report 2024-25`. Its separately disclosed Grants and contributions row is `potential_double_count: true` with `funding_source` `NSW Government — Transport for NSW`.

NSW TrainLink follows the same SOC mapping with `natural_key` prefix `nsw-trainlink:`, `delivery_entity` `NSW TrainLink`, `funding_source` `NSW TrainLink` for its own rows, and `source_dataset` `NSW TrainLink Annual Report 2024-25`. The audited statement is for the legal entity NSW Trains, recorded as `entity_legal_name: NSW Trains` in every row's notes. Its separately disclosed Grants and contributions row is `potential_double_count: true` with `funding_source` `NSW Government — Transport for NSW`.

Forestry Corporation of NSW follows the same SOC mapping: `jurisdiction_level` `soc`, `jurisdiction`/`location` NSW, `amount_cents = $’000 × 100,000`, `measure_type` `actual`, `aggregation_role` `agency_detail`, `verified` `false`, `data_quality_flag` `provisional`, `soc_unit` `AUD_thousands`, and `natural_key` prefix `forestry-corporation:`. Both grant rows are `potential_double_count: true`.

## 4. No-sum and double-count invariants (critical)

- `jurisdiction_level: "pnfc"` is a sector benchmark; `jurisdiction_level: "soc"`
  is an entity statement. Neither is a level of government.
- Generic `/api/spending`, `/api/search`, region/function/state totals query
  `jurisdiction_level: { $ne: "soc" }` and `aggregation_role: { $ne:
"benchmark" }`. SOC and PNFC rows can never enter a government program total.
- `GET /api/soc` returns published SOC rows for separate entities and computes
  **no total**: no sum across line items, entities or years. `total_revenue`
  already includes the separately shown grants; `total_expenses` already
  includes employee, depreciation/amortisation and transfer lines; `net_result`
  is a result, not an expense. Summing any of them is invalid.
- Sydney Water, WaterNSW, Hunter Water, Essential Energy, Forestry
  Corporation of NSW, Landcom, Port Authority of NSW, TAHE, Sydney Trains and NSW
  TrainLink are **separate sources and separate entities**. The API returns a `sources` array and an
  `entities` filter; the UI shows an entity column and an entity selector.
  WaterNSW, Hunter Water, Essential Energy, Forestry Corporation, Landcom, Port
  Authority of NSW, TAHE, Sydney Trains and NSW TrainLink rows are never added to
  Sydney Water's rows or to each other.
- `GET /api/benchmark/pnfc` returns PNFC cells only and computes no total.
- Rows with `potential_double_count: true` name a government agency or a
  government contribution/transfer. The API/UI warn explicitly. They are never
  added to government program spending.
- The UI labels SOC as **“SOC entity statement — never add to government program
  spending”** and shows the unit (`$’000`/`AUD_thousands`), measure-type,
  entity/source and provenance badges plus the double-count warning.

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

1. Runs the PNFC connector first, then Sydney Water, WaterNSW, Hunter Water, Essential Energy, Forestry Corporation of NSW, Landcom, Port Authority of NSW, TAHE, Sydney Trains and NSW TrainLink, in order.
2. Logs per-source `success`/`partial`/`error`, continuing after a source error.
3. Upserts on `natural_key`, so re-running updates the same rows and creates
   none (idempotency test).
4. Never deletes any row and never touches any other source.
5. Writes `docs/source-archive/abs-gfs-pnfc-2024-25.json`,
   `docs/source-archive/sydney-water-annual-report.json` and
   `docs/source-archive/waternsw-annual-report.json`,
   `docs/source-archive/hunter-water-annual-report.json`,
   `docs/source-archive/essential-energy-annual-report.json` and
   `docs/source-archive/forestry-corporation-annual-report.json`,
   `docs/source-archive/landcom-annual-report.json`,
   `docs/source-archive/port-authority-annual-report.json`,
   `docs/source-archive/tahe-annual-report.json`,
   `docs/source-archive/sydney-trains-annual-report.json` and
   `docs/source-archive/nsw-trainlink-annual-report.json`. The exact bytes stay
   outside the repo.
6. Prints per-source counts only (never a combined SOC, entity or PNFC total).

For the Cloudflare-blocked WaterNSW host, the live ingest can supply the exact
official PDF URL and an optional Parliament mirror without hard-coding either in
the source:

```bash
MONGO_URL=mongodb://10.10.10.30:27017/ausspend_dev \
WATERNSW_ANNUAL_REPORT_URL='https://www.waternsw.com.au/documents/publications/general-publications/annual-reports/WaterNSW-Annual-Report-2024-2025.pdf' \
WATERNSW_ANNUAL_REPORT_MIRROR_URL='https://files.parliament.nsw.gov.au/.../Attachment%20C1%20-%20WaterNSW%20Annual%20Report%202024-2025.pdf' \
npm run ingest:soc
```

The row `source_url` is always the official WaterNSW PDF URL; the manifest and
archive record the mirror as `retrieved_from` with `archived_from: "other"`.

Essential Energy's html discovery page is likewise behind a Cloudflare HTML
challenge (its PDF endpoint is reachable). The live ingest can supply the exact
official PDF URL without hard-coding it in source:

```bash
MONGO_URL=mongodb://10.10.10.30:27017/ausspend_dev \
ESSENTIAL_ENERGY_ANNUAL_REPORT_URL='https://www.essentialenergy.com.au/ext/ar2025/files/2025/11/Essential-Energy_Annual-Report_2024-25.pdf' \
npm run ingest:soc
```

The row `source_url` is the official Essential Energy PDF URL; the manifest and
archive record the exact bytes and SHA-256 outside the repo.

## 7. How the remaining SOCs will plug in later

`scripts/ingest-soc.ts` exposes `SOC_SOURCE_IDS` (PNFC, then Sydney Water,
WaterNSW, Hunter Water, Essential Energy, Forestry Corporation of NSW, Landcom,
Port Authority of NSW, TAHE, Sydney Trains, then NSW TrainLink) and
an intentionally empty
`FUTURE_SOC_SOURCE_IDS`. A later phase
should:

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
