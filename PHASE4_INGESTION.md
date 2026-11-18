# Phase 4 — VIC Budget 2026-27 and QLD QGIP expenditure ingestion (CKAN)

**Status: live and ingested into `ausspend_dev` on 2026-11-17. Sources: VIC Budget 2026-27
(DataVic CKAN), the Queensland Government Investment Portal (QGIP) 2024-25 consolidated
expenditure CSV (data.qld CKAN), and the ACNC 2024 Annual Information Statement (data.gov.au
CKAN). No WA, SA, TAS, ACT, ABS GFS or other state source was started, fetched or written by this
work. QLD BP3/BP4 (`qld-budget`) remains a separate source and is preserved unchanged.**
**VIC: 28 rows — 20 additive COFOG rows and 8 explicitly non-additive DTF agency-detail rows.**
**QGIP: 34,000 rows — 27,658 `grant_award` and 6,342 `contract`, never summed together.**
**ACNC: charity expenses only — one `expense_total` row per charity plus reconciled
`expense_component` rows; total and components are never summed together.**
The QGIP and ACNC sections are at the end of this document.

This document records exactly what was ingested, how the files are structured, the units, the
COFOG/measure mapping, the source archive hashes, and the limitations. It is the reference for
re-running and for any later Phase 4 source.

## Source discovery

DataVic CKAN is keyless: `https://discover.data.vic.gov.au/api/3/action/`.

Discovery calls used (recorded in the connector, not hard-coded page URLs):

- `package_search?q=State Budget 2026-27 Aggregate financial statements`
- `package_search?q=State Budget 2026-27 Departmental statements`
- `package_show?id=<package>` for the selected package's resources

Selected packages/resources:

| Dataset                        | Package id                                                                                     | Resource                                                                                           | Resource id                            | File                                                              |
| ------------------------------ | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------- |
| Aggregate financial statements | `28acff34-a406-417c-ac2d-2403590b80e8` (`state-budget-2026-27-aggregate-financial-statements`) | Consolidated expenses by classification of the functions of government — General government sector | `72c90f3b-30b0-466f-9d0b-abeb0d59454f` | `1.5_2026-27-budget-consolidated-gg-expenses-by-cofog.xlsx`       |
| Departmental statements        | `23de15a7-5117-46c9-82af-6950574c3242` (`state-budget-2026-27-departmental-statements`)        | Department of Treasury and Finance — Financial statement                                           | `1f6a4c12-4f42-42ec-8993-4d84089d38a9` | `department-of-treasury-and-finance-2026-27-bp5-online-data.xlsx` |

Both datasets are **CC BY 4.0**; attribution is `© State of Victoria (Department of Treasury and
Finance), 2026`.

Exact download URLs are the CKAN `/resource/<id>/download/<file>` URLs; they are stored in every
measure's `source_url` and in the committed manifest
[`docs/source-archive/vic-budget-2026-27.json`](source-archive/vic-budget-2026-27.json).

## Source archive (bytes outside the repo)

Workbook bytes are never committed. They are downloaded, SHA-256 hashed and written by the shared
`archiveSourceDocument` helper to `AUSSPEND_SOURCE_ARCHIVE` (default `~/ausspend-source-archive`),
and the metadata-only records are persisted to `source_documents`.

| Workbook                                                          | SHA-256                                                            | Bytes  |
| ----------------------------------------------------------------- | ------------------------------------------------------------------ | ------ |
| `1.5_2026-27-budget-consolidated-gg-expenses-by-cofog.xlsx`       | `cb275843f768ff63666e45a96801aea2700f03981b9dfbd92027c4eb3230a584` | 73,786 |
| `department-of-treasury-and-finance-2026-27-bp5-online-data.xlsx` | `dfc67008b65bc46bce71f9fbbcfd6d5c0d6b9006cc86210d86618ba80f855e01` | 27,045 |

Run `npm run archive:vic` to re-download, re-hash and refresh the manifest. Every measure's `notes`
carries the source hash.

## Units — confirmed, never inferred

Both workbooks state the unit explicitly; no magnitude was used to guess it:

- COFOG sheet `Expenses by COFOG`: `($ million)` in row 3 (historical block) and row 53 (modern
  block).
- DTF sheet: `($ million)` in the Comprehensive Operating statement row 5.

Conversion: **1 $m = 100,000,000 cents**. All stored `amount_cents` are exact integer cents
(`Math.round(value × 100,000,000)` and `Number.isSafeInteger` checked). A sheet with no explicit
`($ million)` heading is rejected by the parser (unit test covers this).

## Workbook structure

### COFOG workbook (`1.5_...expenses-by-cofog.xlsx`)

Two blocks on the `Expenses by COFOG` sheet:

- Rows 3–48: historical series 1961-62 onwards, one column per year with `actual` labels. **Not
  ingested** (a historical block mixes division and sub-component rows).
- Rows 53–68: modern series. Row 53 = `($ million)`, row 54 = years (each repeated per measure
  type), row 55 = `budget` / `revised` / `actual` / `estimate`. Rows 57–68 are the function rows
  and the total.

Only the modern block's **budget** columns for **2025-26** (column W) and **2026-27** (column Y)
are ingested. The `revised`, `actual` and 2027-28…2029-30 forward-estimate columns are deliberately
skipped; measure types are never summed. The total row is excluded to avoid double counting, and
`Not allocated by function` is excluded because it has no COFOG code and carries negative values
(the model stores non-negative spending; negatives are skipped, never sign-flipped).

### Departmental workbook (DTF) — non-additive agency detail

The `DTF` sheet contains Comprehensive Operating statement, Balance sheet, Statement of cash flows,
Statement of changes in equity and Administered items statement blocks, all in `($ million)`.

The **Comprehensive Operating statement → Expenses from transactions** component lines
(`Employee benefits`, `Depreciation`, `Grant expense`, `Other operating expenses`) are ingested for
the **2025-26 budget** and **2026-27 budget** columns: 8 rows. They are stored with
`aggregation_role: "agency_detail"`, `function_code` absent, `data_quality_flag: "provisional"`, and
`delivery_entity`/`funding_source` set to the department.

These rows are **never added to any total**. The API lists them in a separate `agency_detail` block
(labelled "Agency detail — not additive"), and every additive total, per-type total, function total
and coverage count excludes `aggregation_role: "agency_detail"`. The consolidated COFOG series is
the only additive VIC series. The DTF 2026-27 agency detail totals 49,614,471,612 cents and must not
be added to the 11,616,887,942,498-cent COFOG total.

Totals, revenue lines, the balance sheet, cash flow, changes in equity and the Administered items
statement are excluded from parsing. Administered items are transfers/payments on behalf of the
State and would themselves double count.

## COFOG mapping and the Transport caveat

VIC's COFOG disclosure (per the 1.6 definitions DOCX shipped in the same dataset) lists ten major
groups but **omits Defence and reports Transport as a separate major group**. The shared taxonomy
has no division code for Transport, only subdivision `045`.

| VIC row                          | Function code | Note                                                                                                    |
| -------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------- |
| General public services          | `01`          | standard division                                                                                       |
| Public order and safety          | `03`          | standard division                                                                                       |
| Economic affairs                 | `04`          | VIC's row excludes transport                                                                            |
| Environmental protection         | `05`          | standard division                                                                                       |
| Housing and community amenities  | `06`          | standard division                                                                                       |
| Health                           | `07`          | standard division                                                                                       |
| Recreation, culture and religion | `08`          | standard division                                                                                       |
| Education                        | `09`          | standard division                                                                                       |
| Social protection                | `10`          | standard division                                                                                       |
| Transport                        | `045`         | standard subdivision code, but **not** a child of the VIC `04` row; never roll 045 into or add it to 04 |
| Not allocated by function        | —             | excluded (no code; negative/not-allocated)                                                              |
| Total expenses from transactions | —             | excluded (double count)                                                                                 |

Every COFOG row has `data_quality_flag: "statewide_only"`, `jurisdiction_level: "state"`,
`jurisdiction: "VIC"`, `location.state: "VIC"` and `verified: false`. No region, LGA or coordinate is
invented.

**Transport is not resolved.** The row is stored as `045` because that is the only shared code
whose name matches Transport, but VIC's disclosure treats Transport as a separate major group and
its `04` row excludes transport. The exact question for a human is: _should VIC's Transport major
group map to the shared subdivision 045, and should 045 never be rolled into 04?_ Until confirmed,
both Transport rows carry `data_quality_flag: "statewide_only; transport_mapping_unconfirmed"` and a
`MAPPING UNCONFIRMED` note. If the ruling differs, change only `COFOG_ROW_MAP` in
`server/src/connectors/vic-budget.ts`; re-ingestion upserts the same natural keys. The budget-only
scope (2025-26 and 2026-27 budget columns) is settled.

## Ingestion and idempotency

```bash
MONGO_URL=mongodb://localhost:27017/ausspend_dev \
AUSSPEND_SOURCE_ARCHIVE=/path/outside/repo \
npm run ingest:phase4
```

The runner executes only `vic-budget` (`scripts/ingest-phase4.ts`), upserts on `natural_key`, and
never deletes another source's rows. Natural key =
`vic-budget:<sha256(package_id ␟ resource_id ␟ sheet ␟ row ␟ function/label ␟ year ␟ measure_type)[:40]>`.

Observed result (2026-11-17):

```text
[ingest:phase4] vic-budget: success fetched=28 upserted=28
[ingest:phase4] vic-budget rows=28 source_documents=2
[ingest:phase4] fiscal_year=2025-26 role=additive rows=10 cents=10908810832141
[ingest:phase4] fiscal_year=2025-26 role=agency_detail rows=4 cents=50051697480
[ingest:phase4] fiscal_year=2026-27 role=additive rows=10 cents=11616887942498
[ingest:phase4] fiscal_year=2026-27 role=agency_detail rows=4 cents=49614471612
[ingest:phase4] function=01 rows=2 ... function=10 rows=2, function=045 rows=2
```

- 20 COFOG rows = 10 function rows × 2 budget years. **This is the only additive VIC series.**
- 8 DTF rows = 4 expense component lines × 2 budget years, `aggregation_role: "agency_detail"`.
- data_sources `records_ingested` = 28.
- A second identical run again reported `fetched=28 upserted=28`; the total `measures` count stayed
  at 186,923 (186,895 pre-existing + 28 VIC rows), proving upsert idempotency.
- Other source counts were unchanged (AusTender 117,894; GrantConnect 62,128; data.nsw CKAN 3,472;
  PBS 1,231; NSW Budget 1,115; synthetic 810; Dubbo 245).

## Five source-backed spot checks

| Record                                       | Workbook cell           | Workbook value     | Stored cents      |
| -------------------------------------------- | ----------------------- | ------------------ | ----------------- |
| Health 2026-27 (COFOG 07)                    | `Expenses by COFOG!Y62` | 34,822.05860446 $m | 3,482,205,860,446 |
| Transport 2026-27 (COFOG 045)                | `Expenses by COFOG!Y66` | 10,068.32051527 $m | 1,006,832,051,527 |
| General public services 2026-27 (COFOG 01)   | `Expenses by COFOG!Y57` | 12,198.99378378 $m | 1,219,899,378,378 |
| Education 2026-27 (COFOG 09)                 | `Expenses by COFOG!Y64` | 27,346.69332067 $m | 2,734,669,332,067 |
| Social protection 2026-27 (COFOG 10)         | `Expenses by COFOG!Y65` | 9,187.78617346 $m  | 918,778,617,346   |
| DTF Employee benefits 2026-27 (non-additive) | `DTF!F17`               | 250.34378853 $m    | 25,034,378,853    |

Check with:

```js
db.measures.findOne({ source_id: 'vic-budget', function_code: '07', fiscal_year: '2026-27' });
```

## API / UI

- `GET /api/v1/spending?jurisdiction_level=state` and
  `GET /api/v1/spending?jurisdiction=VIC&fiscal_year=2026-27` return VIC rows.
- `GET /api/v1/states/VIC?fiscal_year=2026-27&measure_type=budget` returns **count=14,
  additive_count=10, non_additive_count=4, total_cents=11,616,887,942,498**
  ($116,168.87942498m): the sum of the 10 COFOG function rows for 2026-27. The 4 DTF rows are in a
  separate `agency_detail` block with `total_cents=49,614,471,612` and are **not** in the headline
  total. The source has 28 rows in total.
- `GET /api/v1/states/VIC` exposes `agency_detail: { label: "Agency detail — not additive", ... }` so
  the UI can render the DTF rows separately; the state page headline shows 10 additive rows.
- `GET /api/v1/spending?...` also excludes `aggregation_role: "agency_detail"` from its summary and
  per-type totals while returning the rows (labelled "Not additive" in the UI table).
- `GET /api/v1/states/VIC` (state page) matches `jurisdiction = 'VIC'` at
  `jurisdiction_level: 'state'`.
- `GET /api/v1/data-sources/coverage` reports `vic-budget` live and `vic_budget_last_ingested_at`.
- `/data-sources` links to the VIC state page; the coverage banner, About and Home text name VIC.

## Limitations (explicit)

- VIC figures are **Budgeted**, not audited actuals. The workbook also contains actual/revised
  columns; those are not ingested.
- Statewide only: no VIC region, LGA, electorate or coordinate.
- The Department of Treasury and Finance statement is ingested as non-additive agency detail
  (`aggregation_role: "agency_detail"`). It is shown separately, never added to COFOG totals. Other
  VIC departments are discoverable in the same CKAN package but out of scope for this item.
- The VIC State Capital Program (Budget Paper No. 4) and VIC infrastructure pipeline are **not**
  ingested.
- **Transport mapping is unconfirmed.** VIC reports Transport as a separate COFOG major group and its
  Economic affairs (`04`) row excludes transport. The row is stored as `045` (the shared subdivision
  code) and flagged `data_quality_flag: "statewide_only; transport_mapping_unconfirmed"`, with the
  question recorded in the row notes. Do not roll `045` into `04`; a human must confirm the mapping.
- Nothing is human-verified: every VIC row is `verified: false`.
- No cross-level or cross-measure-type summing is performed or implied.

---

# QGIP 2024-25 expenditure — Queensland Government Investment Portal (data.qld CKAN)

**Source id `qld-qgip` (separate from `qld-budget`). 34,000 rows: 27,658 `grant_award` and
6,342 `contract`. Grants and contracts are never summed into a single QLD total.**

> **P1 update (2026-11-17):** `qld-qgip` now covers **2018-19 through 2024-25** (200,387
> payment-level rows in total). 2019-20 is partial because the publisher left annual
> expenditure blank on 22,530 of 27,308 rows (a source gap, not a spending fall). Grants and
> contracts are never summed; data remain provisional and unverified. See
> [docs/DATA_GRANULARITY.md](DATA_GRANULARITY.md) and
> [docs/source-archive/qld-qgip-2018-19-2023-24.json](source-archive/qld-qgip-2018-19-2023-24.json).
> This Phase 4 section records the original 2024-25 ingest only.

## Discovery

data.qld CKAN is keyless: `https://www.data.qld.gov.au/api/3/action/`. The connector runs three
`package_search` queries, 500 ms apart — `QGIP expenditure`,
`grants and procured frontline services`, `Queensland Government Investment Portal` — then
`package_show?id=b102c881-2c7f-484a-a8b6-b056fe318964`.

Package: `queensland-government-investment-portal-expenditure-data-consolidated-view`
(“Queensland Government Investment Portal - Expenditure Data (consolidated view)”, Queensland
Treasury, CC BY 4.0, metadata modified 2025-12-18).

Selected resource (newest annual expenditure CSV; program-funding and older years are ignored):
`2024-25 consolidated QGIP expenditure`, resource id
`1c1786e3-16b7-4fc0-ac3f-4d9314e59bdf`, 17,846,970 bytes, SHA-256
`f0a7aeb6295a9b7c7ada6103d41b0802b337f2ad59e7fcc58337eac41cbb5ef4`. The official
`QGIP expenditure data dictionary`, resource id `80e06969-7193-4b94-a425-f52e27ece371`, is
archived alongside it (SHA-256 `71c3660e423006ff017bd0f4f133af552cafb2e697968b89e8a46f9ad1cb112a`).
Both files are archived outside the repo; the committed metadata manifest is
[`docs/source-archive/qld-qgip-2024-25.json`](source-archive/qld-qgip-2024-25.json).

The CSV is **cp1252**, not UTF-8; it is decoded chunk-by-chunk and stream-parsed with the
csv-parse stream (never loaded as one in-memory string). The file has 29 columns and 35,052 data
rows.

## Units — confirmed, never inferred

The data dictionary states: “Financial year expenditure ... Total paid ... Figures should be
entered without punctuation e.g. enter 150500 not $150,500.” Units are **whole Australian
dollars**. Conversion is `Math.round(dollars × 100)` integer cents, checked with
`Number.isSafeInteger`. The observed maximum is $2,410,403,853; the file also carries decimals
(e.g. `...82.85` cents-level precision), which round to cents.

## Grant vs contract — from `Assistance type1`, never defaulted

`Assistance type1` is mandatory and has exactly five published values. The dictionary defines
Concession, Loan and Direct government investment as distinct from grants and procurement. Only:

| `Assistance type1`            | rows   | measure_type  |
| ----------------------------- | ------ | ------------- |
| Grant                         | 27,658 | `grant_award` |
| Frontline service procurement | 6,342  | `contract`    |
| Concession                    | 846    | **rejected**  |
| Loan                          | 182    | **rejected**  |
| Direct government investment  | 3      | **rejected**  |

Rows are rejected, not relabelled. Zero/negative `Financial year expenditure` rows are also
rejected as no-spend (21 in-scope rows: 12 Grant, 9 Frontline). Reconciliation:
**35,052 source rows = 34,000 ingested + 1,052 rejected (1,031 out-of-scope + 21 zero)**. There is
no overlap: the out-of-scope count is by assistance type over every amount, the zero count is the
in-scope remainder.

## Field mapping

| Target field      | Source column / rule                                                                  |
| ----------------- | ------------------------------------------------------------------------------------- |
| amount_cents      | `Financial year expenditure` (whole dollars × 100)                                    |
| measure_type      | `Assistance type1`: Grant → `grant_award`; Frontline service procurement → `contract` |
| fiscal_year       | dataset year `2024-25`                                                                |
| project_name      | `Program title` (fallback `Sub-program title` / `Purpose`)                            |
| description       | `Purpose` (fallback program/sub-program)                                              |
| delivery_entity   | `Legal entity name` (fallback `Service provider name`)                                |
| funding_source    | `Funding agency` QLD department acronym (26 agencies)                                 |
| location          | `state: "QLD"` + `lga_name` from service-delivery LGA where supplied                  |
| source_dataset    | `Queensland Government Investment Portal (QGIP) — Expenditure`                        |
| source_url        | the CKAN resource download URL                                                        |
| source_detail     | archive SHA-256 recorded in `notes` (there is no separate model field)                |
| natural_key       | `hash(resource_id + row_hash + fiscal_year)`, prefix `qld-qgip:`                      |
| verified          | `false`                                                                               |
| data_quality_flag | `provisional` (+ `; statewide_only` / `; location_approximate`)                       |
| aggregation_role  | `additive`                                                                            |

The separate `Funding source` column (Queensland Government / Australian Government / Combined /
Other) is a money-source classification, not the agency; it is recorded in `notes`.

`row_hash` includes the 1-based data-row number as well as every cell, so genuinely repeated
identical payments stay as separate rows instead of being silently collapsed; re-running the same
resource is still idempotent.

## Location

- `Statewide = Yes` → `location: { state: "QLD" }`, flag `provisional; statewide_only`.
- `Statewide = No` → service-delivery postcode/suburb/LGA where supplied; the LGA is stored as
  `location.lga_name`, postcode/suburb in `notes`.
- Published sentinels `1111` (multiple LGAs), `1001` (not applicable/privacy) and `1234`
  (interstate) mean no fixed location → flag `provisional; location_approximate`. No coordinate is
  parsed, averaged or invented.

## Ingestion and idempotency

```
MONGO_URL=mongodb://localhost:27017/ausspend_dev npm run ingest:phase4 -- --source=qld-qgip
```

The runner upserts on `natural_key`, so a second run updates the same 34,000 documents and creates
none. It never deletes and never touches `qld-budget`, VIC, NSW, federal or other sources. The
ingest script prints per-`measure_type` rows and cents and **no combined QLD total**.

## API / UI

- `GET /api/v1/meta/coverage` reports `qld-qgip` live, `qld_qgip_last_ingested_at` and
  `qld_qgip_records`.
- `GET /api/v1/data-sources` lists the source with its archive notes and record count.
- `/data-sources` links to the `grant_award` and `contract` search filters (separately).
- A QLD jurisdiction summary with both types present is `mixed: true` with a null total and
  `total_by_measure_type`; grants and contracts are never added together.

### State/region aggregates are never capped by the row page

`GET /api/states/:code` and `GET /api/regions/:region` used to compute their headline totals from
the 2,000-row display page, so a 34,000-row source produced a partial total. They now run the
summary and the per-function totals over the whole match set in Mongo and apply `limit` only to the
`measures` row page. The response carries `rows_returned` and `rows_truncated`; the UI shows a
"showing the first N of M rows, totals cover all M" note instead of silently truncating.

A state page is the **state government's own** spending: it matches `jurisdiction = <code>` at
`jurisdiction_level: "state"`. It deliberately does **not** match `location.state`, so a federal
AusTender contract merely _located_ in QLD is not counted as QLD state spending, and local-council
rows are excluded by the level filter. The API count therefore equals the state's `jurisdiction`
dataset exactly.

For `GET /api/states/QLD?fiscal_year=2024-25` the match is exactly the DB QLD 2024-25 set:
34,000 rows = 27,658 `grant_award` + 6,342 `contract` (all QGIP). It returns `mixed: true`,
`total_cents: null`, and the full per-type totals
(`grant_award` 27,658; `contract` 6,342). No 2,000-row partial total is possible, and the 6,670
AusTender contracts tagged `location.state=QLD` are excluded because their jurisdiction is
Commonwealth.

To isolate one state source (for example QGIP, excluding a same-year `qld-budget` series), use the
additive `source_id` filter:

```
GET /api/states/QLD?fiscal_year=2024-25&source_id=qld-qgip
→ count 34000, mixed true, total_cents null,
  total_by_measure_type: grant_award {count 27658, total_cents 472271212105},
                         contract   {count 6342,  total_cents 674606619574}
```

## Limitations

- The Phase 4 QGIP rows are **actual** cash-accounting expenditure for 2024-25, not budget;
  the P1 earlier-year rows are annual actual payments for their own fiscal years.
- No COFOG function is defensible from QGIP; `function_code` is blank and every row is
  `provisional`.
- 1,031 out-of-scope assistance types and 21 zero-dollar in-scope rows are intentionally excluded.
- Nothing is human-verified: every row is `verified: false`.
- No cross-measure-type summing is performed or implied.

---

# ACNC Annual Information Statement (AIS) — charity expenses

**Source id:** `acnc-charity`. **Edition:** ACNC 2024 Annual Information Statement (the latest AIS
package published on data.gov.au CKAN at ingestion time). **Scope:** ACNC only. No ABS GFS, WA,
SA, TAS, ACT, SOC or other state source was started.

## Discovery and archived source

Keyless data.gov.au CKAN:

- `package_search?q=ACNC Annual Information Statement&rows=100` → the latest edition is selected by
  the year in the package name/title.
- `package_show?id=acnc-2024-annual-information-statement-ais-data`.

| File                            | Resource id                            | Role                                                   | SHA-256 (bytes outside the repo)                                                |
| ------------------------------- | -------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `datadotgov_ais24.csv`          | `710630ea-1202-4bbb-95f7-3973a972ddf8` | AIS spreadsheet, one row per charity                   | recorded in `docs/source-archive/acnc-ais-2024.json` and every record's `notes` |
| `datadotgov_ais24_programs.csv` | `09f5fc83-8648-413e-ba5b-793a9d6b305f` | program operating locations (location enrichment only) | as above                                                                        |
| `explanatory-notes.pdf`         | `014d919b-aa79-4da4-8aab-438141391f99` | official field definitions/units                       | as above                                                                        |

The exact bytes are downloaded by the shared `archiveSourceDocument` helper to
`AUSSPEND_SOURCE_ARCHIVE` (default `~/ausspend-source-archive`, outside the repo). The repo holds
only metadata: `docs/source-archive/acnc-ais-2024.json`, `source_documents`, and the hash in each
measure's `notes`.

## Units, period and expense structure (evidence from the explanatory notes)

- **Units:** whole Australian dollars. The explanatory notes state: “Charities were asked to
  provide all amounts in Australian dollars, and not to enter any symbols, commas or decimal
  points.” Conversion is `1 AUD = 100 cents`, with `Number.isSafeInteger` checks. Units were not
  inferred from magnitude.
- **Period:** the AIS `fin report from` / `fin report to` columns carry each charity's own reporting
  period (default 1 July–30 June, alternate periods allowed). `fiscal_year` is derived from the
  report-to date: July–December → `YYYY-YY`; January–June → `(YYYY-1)-YY`. This preserves the source's
  alternate periods instead of relabelling everything to the AIS edition. The 74 positive-expense
  rows with no period fall back to `2023-24` and carry `fiscal_year_approximate`.
- **Expense categories (explicit, never encoded in `measure_type`):**

| Source column                                         | `expense_category`               | Role                |
| ----------------------------------------------------- | -------------------------------- | ------------------- |
| `total expenses`                                      | `total`                          | `expense_total`     |
| `employee expenses`                                   | `employee_expenses`              | `expense_component` |
| `interest expenses`                                   | `interest_expenses`              | `expense_component` |
| `grants and donations made for use in Australia`      | `grants_and_donations_australia` | `expense_component` |
| `grants and donations made for use outside Australia` | `grants_and_donations_overseas`  | `expense_component` |
| `all other expenses`                                  | `all_other_expenses`             | `expense_component` |

The total is defined by the notes as the sum of the five components. 106 of 54,233 AIS rows differ
by $1 due to source rounding; for those the component rows are omitted and only the total is
stored, flagged `expense_components_unreconciled`. Components are emitted only when they reconcile
exactly, so the dataset can never imply a component series that disagrees with the total.

## No-sum invariant (critical)

- One total row per charity/financial-year: `aggregation_role: "expense_total"`,
  `expense_category: "total"`.
- Optional component rows: `aggregation_role: "expense_component"` with their explicit
  `expense_category`.
- `measure_type` is `actual` for every row; it is never overloaded to mean total vs component.
- The API excludes `expense_component` from every generic total and per-measure-type total. A
  charity-only summary uses **only** `expense_total` rows for its headline and exposes the
  components separately in `summary.expense_categories`.
- When charity and government rows are mixed in one query, the summary is `mixed: true` with
  `total_cents: null` and no combined `total_by_measure_type`; charity expenses are never merged
  with government spending.
- Tests: `server/test/acnc-charity.test.ts` (mapping, units, natural key, idempotency, no-sum) and
  `server/test/acnc-api.test.ts` (API cannot return 200,000 for a 100,000 total + 60,000 + 40,000
  components, and a mixed query has no combined total).

## Mapping

| Measure field                          | Value                                                                                        |
| -------------------------------------- | -------------------------------------------------------------------------------------------- |
| `jurisdiction_level`                   | `charity`                                                                                    |
| `jurisdiction`                         | `Australia`                                                                                  |
| `delivery_entity`                      | AIS charity name                                                                             |
| `funding_source`                       | `ACNC-registered charity` (never an invented government funder)                              |
| `project_name`                         | `Charity expenses — <charity name>`                                                          |
| `measure_type`                         | `actual`                                                                                     |
| `fiscal_year`                          | derived from the AIS report-to date (see above)                                              |
| `amount_cents`                         | integer cents (whole AUD × 100)                                                              |
| `location.state` / `location.postcode` | only from AIS program operating locations, single-state only; flagged `location_approximate` |
| `function_code`                        | absent — ACNC has no COFOG                                                                   |
| `source_dataset`                       | `ACNC Annual Information Statement (AIS)`                                                    |
| `source_url`                           | the AIS CSV resource URL                                                                     |
| `natural_key`                          | `acnc-charity:hash(abn + financial_year + expense_category)`                                 |
| `verified`                             | `false`                                                                                      |
| `expense_category`                     | explicit category (see table above)                                                          |
| `aggregation_role`                     | `expense_total` or `expense_component`                                                       |

## Geography caveat

The AIS spreadsheet has **no address column**. The accompanying AIS programs spreadsheet publishes
up to ten program operating locations per program. A charity gets `location.state`/`postcode` only
when all of its program locations resolve to exactly one state (and one valid postcode). Multi-state
charities get no state rather than an invented one. Postcodes are only accepted in postcode-like
positions (after a state or comma, or a standalone value), so a street number such as `1635 Forest
Road` is not mistaken for postcode 1635. Every populated location carries
`data_quality_flag: "...; location_approximate"` because a program operating location is not the charity's registered address, headquarters (HQ)
or an expense-incurred location. The connector never infers an HQ. No coordinate is parsed or averaged.

## Ingestion and idempotency

```
MONGO_URL=mongodb://localhost:27017/ausspend_dev npm run ingest:phase4 -- --source=acnc-charity
```

The runner upserts on `natural_key`, so re-running updates the same documents and creates none. It
never deletes and never touches federal, NSW, VIC, QLD BP3/BP4, QGIP, Dubbo or synthetic rows. The
ingest output prints total vs component row counts separately and **no combined charity+government
total**.

## API / UI

- `GET /api/v1/spending?jurisdiction_level=charity` works and returns total + component rows with
  `expense_category`; the summary headline uses total-expenses rows only.
- `expense_category`, `state` and `postcode` filters are additive.
- `GET /api/v1/meta/coverage` reports `charity_ingestion` (live source, last ingested, record
  count) and the limitation that charity expenses are not government spending and have no COFOG.
- `/data-sources` links to charity total and all-category search views. The search page labels
  charity total vs component rows distinctly.

## Limitations

- ACNC charity expenses are **not government spending** and are not comparable to the federal/state
  local series.
- No COFOG function is defensible; `function_code` is absent.
- Every row is `provisional` and `verified: false`.
- State/postcode coverage is partial and approximate; it is not a full address register.
- Zero and negative total-expenses rows are skipped, never zero-filled.

# ABS Government Finance Statistics (GFS) — COFOG-A expense benchmark (Annual 2024-25)

## SDMX is not available for GFS (verified, not assumed)

The brief originally asked for the keyless ABS SDMX REST API. Before writing any mapper we checked
the ABS catalogue, because the dataflow/version/key/time format and the COFOG/level dimensions must
be confirmed, never guessed:

| Check                              | URL                                                                                                                         | Result                                                                                        |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Full ABS dataflow catalogue        | `https://data.api.abs.gov.au/rest/v1/dataflow/ABS`                                                                          | HTTP 200, 3,231,497 bytes, **1,228 dataflows**, prepared 2026-11-17T03:00:37Z                 |
| GFS/COFOG search of that catalogue | same response                                                                                                               | **0 matches** for GFS, COFOG, "Government Finance", catalogue 5512 or 5519 (case-insensitive) |
| All-stubs catalogue                | `https://data.api.abs.gov.au/rest/v1/dataflow/ABS?detail=allstubs`                                                          | HTTP 200, 791,761 bytes, same result                                                          |
| ABS DSD catalogue                  | `https://data.api.abs.gov.au/rest/v1/datastructure/ABS?detail=allstubs`                                                     | HTTP 200, 477,968 bytes, no COFOG/GFS data structure                                          |
| Candidate dataflow ids             | `/rest/v1/dataflow/ABS/{GFS, ABS_GFS, GFS_COFOG, ABS_GFS_COFOG, GOVERNMENT_FINANCE, PUBLIC_FINANCE, GFS_5512, GFS_5519}`    | every id **HTTP 404**                                                                         |
| ABS GFS release pages              | quarterly `.../government-finance-statistics-australia/jun-2026`; annual `.../government-finance-statistics-annual/2024-25` | XLSX downloads only; **0** `sdmx`/`data.api`/`rest/v1` links                                  |

There is therefore **no GFS/COFOG SDMX dataflow to query**. The item was stopped and the human
approved an explicit fallback to the official ABS GFS Annual XLSX. **No guessed SDMX mapper exists
in this repo.** The connector is `server/src/connectors/abs-gfs.ts` (source id `abs-gfs`); it
replaces the old `abs-government-finance` stub.

## Source and archive (bytes outside the repo)

- Catalogue/release page: `https://www.abs.gov.au/statistics/economy/government/government-finance-statistics-annual/2024-25`
- Exact file: `https://www.abs.gov.au/statistics/economy/government/government-finance-statistics-annual/2024-25/55120DO094_202425.xlsx`
- Workbook: `55120DO094_202425.xlsx`, 175,454 bytes,
  SHA-256 `5a4da532acba8efd05b71e2c84bdb5837860e9539a1cf8a3a2b750e953c7c679`.
- The connector discovers the Key Tables link from the release page, downloads it through the shared
  source-archive helper and stores the bytes under `AUSSPEND_SOURCE_ARCHIVE` **outside the repo**.
  The repo only holds the metadata manifest (`docs/source-archive/abs-gfs-2024-25.json`) and the
  `source_documents` rows persisted by the runner.

## Workbook structure — confirmed from the workbook itself

The workbook has 17 sheets. Only `Table_9` and `Table_10` carry COFOG-A "Expenses by purpose":

| Sheet      | Title (row 4)                                                                             | Level columns (row 5)                                                                                                                               | Unit (row 7) |
| ---------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| `Table_9`  | Table 9 Expenses by purpose, general government sector, Commonwealth and state government | Commonwealth, New South Wales, Victoria, Queensland, South Australia, Western Australia, Tasmania, Northern Territory, Australian Capital Territory | `$m`         |
| `Table_10` | Table 10 Expenses by purpose, general government sector, local government                 | New South Wales, Victoria, Queensland, South Australia, Western Australia, Tasmania, Northern Territory                                             | `$m`         |

The parser **validates** the title, every column header, every time-period cell (`2024-25`) and
every unit cell (`$m`). A mismatch throws instead of guessing. The row labels are the COFOG-A
purpose labels; `Total expenses` is explicitly skipped because it is not a COFOG function and would
double count. The trailing "All levels of government" columns are **not ingested**: Table 9's
column mixes Commonwealth and state governments (no single level), and Table 10's is a cross-state
local total. Ingesting either would invite a cross-level/cross-jurisdiction sum.

### Units and scale

Row 7 of both tables says `$m`. One `$m` = 1,000,000 dollars = **100,000,000 cents**. Every value
is converted with `Math.round(value * 100_000_000)` and checked with `Number.isSafeInteger`; the
unit is never inferred from magnitude. The exact workbook cell is retained in `notes`.

### COFOG-A and level mapping

| Workbook label                   | `function_code` | Note                                                                                          |
| -------------------------------- | --------------- | --------------------------------------------------------------------------------------------- |
| General public services          | `01`            | COFOG division                                                                                |
| Defence                          | `02`            | COFOG division                                                                                |
| Public order and safety          | `03`            | COFOG division                                                                                |
| Economic affairs                 | `04`            | ABS publishes this **excluding** Transport                                                    |
| Environmental protection         | `05`            | COFOG division                                                                                |
| Housing and community amenities  | `06`            | COFOG division                                                                                |
| Health                           | `07`            | COFOG division                                                                                |
| Recreation, culture and religion | `08`            | COFOG division                                                                                |
| Education                        | `09`            | COFOG division                                                                                |
| Social protection                | `10`            | COFOG division                                                                                |
| Transport                        | `045`           | ABS publishes Transport as a separate purpose; stored as COFOG 04.5, **never rolled into 04** |

| Column                                | `jurisdiction_level` | `jurisdiction` | `location`                          |
| ------------------------------------- | -------------------- | -------------- | ----------------------------------- |
| Commonwealth                          | `federal`            | `Australia`    | absent (national)                   |
| State/territory governments (NSW…ACT) | `state`              | `NSW`…`ACT`    | `{ state: <code> }`, statewide only |
| Local government (NSW…NT)             | `local`              | `NSW`…`NT`     | `{ state: <code> }`, statewide only |

No LGA, SA2, postcode or coordinate is invented. The `state` level is used for the territory
governments too, consistent with the app's existing state-page query.

## Mapping

| Measure field        | Value                                                                                          |
| -------------------- | ---------------------------------------------------------------------------------------------- |
| `jurisdiction_level` | `federal` / `state` / `local` from the column                                                  |
| `jurisdiction`       | `Australia` or the state/territory code                                                        |
| `function_code`      | COFOG code from the purpose label (Transport `045`)                                            |
| `amount_cents`       | official `$m` aggregate × 100,000,000                                                          |
| `measure_type`       | `actual`                                                                                       |
| `fiscal_year`        | time-period cell (`2024-25`)                                                                   |
| `location`           | absent for national; `{ state }` for state/local; statewide only                               |
| `source_id`          | `abs-gfs`                                                                                      |
| `source_dataset`     | `ABS Government Finance Statistics (GFS)`                                                      |
| `source_url`         | exact Key Tables XLSX URL                                                                      |
| `source_date`        | release date `2026-04-21`                                                                      |
| `verified`           | `true`                                                                                         |
| `data_quality_flag`  | `verified` (official aggregate only)                                                           |
| `aggregation_role`   | `benchmark`                                                                                    |
| `natural_key`        | `abs-gfs:hash(series_key + fiscal_year)`, series key = table + level + jurisdiction + function |
| `project_name`       | absent — a benchmark cell is never project-level                                               |

## No-sum / benchmark invariant

ABS GFS is a **top-down statistical benchmark**, not a sum of projects:

- `aggregation_role: benchmark` is non-additive. The shared API totals exclude it.
- The generic `/api/spending`, `/api/search`, state, function and region queries explicitly filter
  `aggregation_role: { $ne: 'benchmark' }`, so a GFS cell can never be silently added to project
  data.
- The dedicated `GET /api/benchmark` returns only published ABS cells and **computes no total**:
  no sum across functions, levels of government or measure types.
- The UI `/benchmark` page labels the data a benchmark, shows verified badges, and states that
  project data is a separate population. It never displays a combined GFS + project figure.

## Ingestion and idempotency

```
MONGO_URL=mongodb://localhost:27017/ausspend_dev npm run ingest:phase4 -- --source=abs-gfs
```

The runner upserts on `natural_key`, so re-running updates the same 169 documents and creates none.
It never deletes and never touches synthetic, AusTender, PBS, GrantConnect, NSW, VIC, QLD, Dubbo or
ACNC rows. The output prints rows by level and function and deliberately prints no combined total.

## Five source-backed spot checks (2024-25, `$m` from Table 9/10)

| Series                                   | ABS `$m` | Stored cents       |
| ---------------------------------------- | -------- | ------------------ |
| Commonwealth — Health                    | 118,155  | 11,815,500,000,000 |
| NSW state government — Health            | 32,293   | 3,229,300,000,000  |
| QLD state government — Education         | 17,230   | 1,723,000,000,000  |
| NSW local government — Transport         | 2,649    | 264,900,000,000    |
| VIC state government — Social protection | 9,436    | 943,600,000,000    |

The same cells are re-read from the archived workbook by the tests; the DB values are compared to
the workbook values during verification.

## API / UI

- `GET /api/v1/benchmark?fiscal_year=2024-25&function=07` returns the published cells, source
  metadata, the `$m` unit and `unit_to_cents: 100000000`, and no `total_cents`.
- `GET /api/v1/meta/coverage` adds `benchmark_ingestion` (live source, last ingested, record count,
  caveat) and the federal source list includes `abs-gfs`.
- `/benchmark` is the benchmark view; `/data-sources` links to it and explains the fallback.

## Limitations

- The ABS SDMX API has **no GFS/COFOG dataflow**; this is an XLSX fallback, not an SDMX query.
- The data is an annual official aggregate, not audited financial statements or project-level spend.
- Only `2024-25` is ingested. The connector rejects other time periods rather than relabelling them.
- `Total expenses` and the "All levels of government" columns are intentionally not ingested.
- Transport is stored as `045` because ABS publishes it separately; it must never be rolled into
  `04`.
- No sub-state region exists; state/local rows are statewide only.
