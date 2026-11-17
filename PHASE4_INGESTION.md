# Phase 4 — VIC Budget 2026-27 ingestion (DataVic CKAN)

**Status: VIC only, live and ingested into `ausspend_dev` on 2026-11-17. No QLD, WA, SA,
TAS, ACT, NT, ACNC, QGIP or ABS GFS source was started, fetched or written by this item.**

This document records exactly what was ingested, how the workbooks are structured, the units,
the COFOG mapping, the source archive hashes, and the limitations. It is the reference for
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

### Departmental workbook (DTF) — archived and parsed, NOT additive

The `DTF` sheet contains Comprehensive Operating statement, Balance sheet, Statement of cash flows,
Statement of changes in equity and Administered items statement blocks, all in `($ million)`.

The parser validates the **Comprehensive Operating statement → Expenses from transactions**
component lines (`Employee benefits`, `Depreciation`, `Grant expense`, `Other operating expenses`)
for the **2025-26 budget** and **2026-27 budget** columns. Those 8 agency lines are **not written to
`measures`**: the consolidated COFOG workbook already covers general government expenses, so adding
one agency's detail would make the VIC budget total double count. The workbook remains in the
SHA-256 archive and in the manifest, and its parser is unit-tested (`parseDepartmentalWorkbook`).

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

The Transport/Economic-affairs relationship and the budget-only scope were raised with the
orchestrator before the mapper was written (two `otto_pool_ask` attempts returned no answer in the
wait window). The defaults above are the documented, defensible resolution; if the orchestrator
rules differently, only `COFOG_ROW_MAP` and the year filter in `server/src/connectors/vic-budget.ts`
change, and re-ingestion upserts the same natural keys.

## Ingestion and idempotency

```bash
MONGO_URL=mongodb://10.10.10.30:27017/ausspend_dev \
AUSSPEND_SOURCE_ARCHIVE=/path/outside/repo \
npm run ingest:phase4
```

The runner executes only `vic-budget` (`scripts/ingest-phase4.ts`), upserts on `natural_key`, and
never deletes another source's rows. Natural key =
`vic-budget:<sha256(package_id ␟ resource_id ␟ sheet ␟ row ␟ function/label ␟ year ␟ measure_type)[:40]>`.

Observed result (2026-11-17):

```text
[ingest:phase4] removed 8 legacy non-additive VIC departmental row(s)
[ingest:phase4] vic-budget: success fetched=20 upserted=20
[ingest:phase4] vic-budget rows=20 source_documents=2
[ingest:phase4] fiscal_year=2025-26 rows=10 cents=10908810832141
[ingest:phase4] fiscal_year=2026-27 rows=10 cents=11616887942498
[ingest:phase4] function=01 rows=2 ... function=10 rows=2, function=045 rows=2
```

- 20 COFOG rows = 10 function rows × 2 budget years. **This is the only additive VIC series.**
- The DTF workbook is archived and parsed (8 expense lines) but creates no measures. The script
  removes only legacy VIC non-additive departmental rows (`source_id: vic-budget`,
  `delivery_entity: Department of Treasury and Finance`, no `function_code`). No other source is
  touched.
- A second identical run again reported `fetched=20 upserted=20`; the total `measures` count stayed
  at 186,915 (186,895 pre-existing + 20 VIC COFOG), proving upsert idempotency (no duplicates, no
  other deletes).
- Other source counts were unchanged (AusTender 117,894; GrantConnect 62,128; data.nsw CKAN 3,472;
  PBS 1,231; NSW Budget 1,115; synthetic 810; Dubbo 245).

## Five source-backed spot checks

| Record                                     | Workbook cell           | Workbook value     | Stored cents      |
| ------------------------------------------ | ----------------------- | ------------------ | ----------------- |
| Health 2026-27 (COFOG 07)                  | `Expenses by COFOG!Y62` | 34,822.05860446 $m | 3,482,205,860,446 |
| Transport 2026-27 (COFOG 045)              | `Expenses by COFOG!Y66` | 10,068.32051527 $m | 1,006,832,051,527 |
| General public services 2026-27 (COFOG 01) | `Expenses by COFOG!Y57` | 12,198.99378378 $m | 1,219,899,378,378 |
| Education 2026-27 (COFOG 09)               | `Expenses by COFOG!Y64` | 27,346.69332067 $m | 2,734,669,332,067 |
| Social protection 2026-27 (COFOG 10)       | `Expenses by COFOG!Y65` | 9,187.78617346 $m  | 918,778,617,346   |

Check with:

```js
db.measures.findOne({ source_id: 'vic-budget', function_code: '07', fiscal_year: '2026-27' });
```

## API / UI

- `GET /api/v1/spending?jurisdiction_level=state` and
  `GET /api/v1/spending?jurisdiction=VIC&fiscal_year=2026-27` return VIC rows.
- `GET /api/v1/states/VIC?fiscal_year=2026-27&measure_type=budget` returns **count=10,
  total_cents=11,616,887,942,498** ($116,168.87942498m): the sum of the 10 COFOG function rows for
  2026-27, with no DTF agency lines. The source has 20 rows in total (10 functions × 2025-26 and
  2026-27). This is the correct additive VIC budget total.
- `GET /api/v1/states/VIC` (state page) matches `location.state = 'VIC'`.
- `GET /api/v1/data-sources/coverage` reports `vic-budget` live and `vic_budget_last_ingested_at`.
- `/data-sources` links to the VIC state page; the coverage banner, About and Home text name VIC.

## Limitations (explicit)

- VIC figures are **Budgeted**, not audited actuals. The workbook also contains actual/revised
  columns; those are not ingested.
- Statewide only: no VIC region, LGA, electorate or coordinate.
- The Department of Treasury and Finance statement is archived and parsed for validation but creates
  no measures (single-agency detail is non-additive with consolidated COFOG). Other VIC departments
  are discoverable in the same CKAN package but out of scope for this item.
- The VIC State Capital Program (Budget Paper No. 4) and VIC infrastructure pipeline are **not**
  ingested.
- Transport is `045`, not a division; do not roll it into `04` or add it to `04` in any total.
- Nothing is human-verified: every VIC row is `verified: false`.
- No cross-level or cross-measure-type summing is performed or implied.
