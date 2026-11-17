# SOC ingestion — PNFC benchmark + NSW SOC entities (Sydney Water, WaterNSW, Hunter Water)

**Status:** the ABS GFS Public Non-Financial Corporations (PNFC) sector
benchmark is implemented, and three NSW per-entity State Owned Corporation (SOC)
adapters are implemented: **Sydney Water Corporation**, **WaterNSW (Water NSW)**
and **Hunter Water Corporation**. Per-entity NSW SOC extraction for any other entity, BP1 Chapter 9,
VIC/QLD SOC and any synthetic SOC rows are out of scope and are not implemented.
The three SOC entities are separate sources and are never summed with each other.

`npm run ingest:soc` runs **PNFC first, then Sydney Water, then WaterNSW, then
Hunter Water**,
logging each source's success/failure and continuing after a source error.

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
- Sydney Water, WaterNSW and Hunter Water are **separate sources and separate entities**.
  The API returns a `sources` array and an `entities` filter; the UI shows an
  entity column and an entity selector. WaterNSW and Hunter Water rows are never
  added to Sydney Water's rows or to each other.
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

1. Runs the PNFC connector first, then Sydney Water, WaterNSW and Hunter Water, in order.
2. Logs per-source `success`/`partial`/`error`, continuing after a source error.
3. Upserts on `natural_key`, so re-running updates the same rows and creates
   none (idempotency test).
4. Never deletes any row and never touches any other source.
5. Writes `docs/source-archive/abs-gfs-pnfc-2024-25.json`,
   `docs/source-archive/sydney-water-annual-report.json` and
   `docs/source-archive/waternsw-annual-report.json` and
   `docs/source-archive/hunter-water-annual-report.json`. The exact bytes stay
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

## 7. How the remaining SOCs will plug in later

`scripts/ingest-soc.ts` exposes `SOC_SOURCE_IDS` (PNFC, then Sydney Water, then
WaterNSW) and an intentionally empty `FUTURE_SOC_SOURCE_IDS`. A later phase
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
