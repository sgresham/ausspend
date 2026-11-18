# NSW / local ingestion — S1 NSW Budget + S2 data.nsw.gov.au CKAN + S3 Dubbo

**Scope.** S1 ingests the official NSW Budget 2025-26 open-data workbooks and the NSW Treasury
ArcGIS capital-projects layer (source id `nsw-budget`). S2 adds **targeted**
`data.nsw.gov.au` CKAN ingestion (source id `data-nsw-ckan`): a small curated set of budget,
capital and agency-expenditure datasets, never the whole portal. S3 adds **one** local council,
Dubbo Regional Council (source id `dubbo-council`), and the area-search contract C. It stops
before any other council, VIC/QLD/WA/SA/TAS/ACT/NT, SOC/charity and any live state connector.
Federal statuses and the pre-S3 measure counts are unchanged except for the new Dubbo rows.

## 1. Source, redirect and snapshot

The official page is <https://www.budget.nsw.gov.au/budget-detail/open-data>.

Observed on 2026-11-16 (this matters because the live page is now the 2026-27 budget):

```text
$ curl -sS -I https://www.budget.nsw.gov.au/budget-detail/open-data
HTTP/2 301
location: https://prod.redirects.dcs.skpr.live:443/redirect/www.budget.nsw.gov.au/budget-detail/open-data

$ curl -sS -L -o /dev/null -w '%{http_code} %{url_effective}\n' \
    https://www.budget.nsw.gov.au/budget-detail/open-data
200 https://www.nsw.gov.au/business-and-economy/nsw-budget

$ curl -sS -L -o /dev/null -w '%{http_code} %{url_effective}\n' \
    https://www.budget.nsw.gov.au/sites/default/files/2025-06/2025-26-Budget-Financial-Statements.xlsx
200 https://www.nsw.gov.au/business-and-economy/nsw-budget/archive
```

The live 2025-26 XLSX URLs no longer serve the XLSX files; they redirect to the NSW Budget
archive page. S1 therefore reads the official Wayback Machine snapshot of the 2025-26 page:

- Snapshot page: `https://web.archive.org/web/20251114084846id_/https://www.budget.nsw.gov.au/budget-detail/open-data`
- Snapshot timestamp: **20251114084846** (14 November 2025, 08:48:46 UTC)
- Page copy SHA-256: `9a0a79b17088ab9e33ef1968eb506171976d0bf141d88d717f806e3b00b12438` (23,684 bytes)

The connector parses the snapshot page with a DOM parser (`node-html-parser`), not regex on raw
HTML, and discovers the 12 `.xlsx` links by link text/filename. Each workbook is then fetched from
its nearest official Wayback capture (resolved through the Wayback CDX API).

Attribution: **© State of New South Wales (NSW Treasury), (2025).** Licence: **CC BY 3.0 AU**.

## 2. The 12 official 2025-26 XLSX copies

All 12 workbooks from the snapshot are downloaded to a local cache and hashed. The cache is
outside git (default `~/.cache/ausspend/nsw-budget/2025-26`; the archive script can use
`NSW_CACHE_DIR`). **The blobs are never committed.** The committed manifest is
[`docs/source-archive/nsw-budget-2025-26.json`](docs/source-archive/nsw-budget-2025-26.json).

| Category  | Filename                                                                  | SHA-256                                                            |
| --------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| financial | `2025-26-Budget-Financial-Statements.xlsx`                                | `c3e4fb8e30f554fea06cb8878d9418060de44c6b3a4bc3271047aa6d50661c09` |
| hfi       | `Open-Data-2025-26-Budget-Historical-Fiscal-Indicators.xlsx`              | `e9f66981d63ef41e7e92f1a97e63d70ca2f069760ff4be273d10de81a1bf5757` |
| economy   | `2025-26-Budget-Economy-Open-Data.xlsx`                                   | `1cb452d35ad74753940a19cd238dfe02bec78cd8102d6de673bf1a2d3f6756e4` |
| wellbeing | `open-data-performance-and-wellbeing-community-nsw-budget-2025-26.xlsx`   | `5a9f234104d8cf43f93242ca24f216745966c58cc4171b290b23109f198b3593` |
| wellbeing | `open-data-performance-and-wellbeing-connected-nsw-budget-2025-26.xlsx`   | `12edcd98c79b13b1ce09bf21cf4d7def79330ee6f6f04fb48a1c268da5ef7811` |
| wellbeing | `open-data-performance-and-wellbeing-healthy-nsw-budget-2025-26.xlsx`     | `a0291878555d5fe31592134a48baf903e55864f5e31cc421531db5f1486298b5` |
| wellbeing | `open-data-performance-and-wellbeing-housed-nsw-budget-2025-26.xlsx`      | `2eaa694411bbede2b593403aa2d1b70343907269e194f5624b4a1095a790d14a` |
| wellbeing | `open-data-performance-and-wellbeing-overall-nsw-budget-2025-26.xlsx`     | `7616b3574131237e645dcc6bea1c2242f99ee3ca3e87b6130888d44ca4b87966` |
| wellbeing | `open-data-performance-and-wellbeing-prosperous-nsw-budget-2025-26.xlsx`  | `0f27de335da694532f66f4a0b1f3c2ccd19029b817be52e745de4655bb9738f0` |
| wellbeing | `open-data-performance-and-wellbeing-secure-nsw-budget-2025-26.xlsx`      | `d27d586d9e484c9795a6f1a0d89e35e8a1e8a33e403ea432b5e9e479b51d8ca6` |
| wellbeing | `open-data-performance-and-wellbeing-skilled-nsw-budget-2025-26.xlsx`     | `1d530c1351150da0f8df0f271fb7371411b2c030afac0f393fd0fb626e814f0e` |
| wellbeing | `open-data-performance-and-wellbeing-sustainable-nsw-budget-2025-26.xlsx` | `18ee2847987f8205fcdd12e297b16746c13ff6dbb2f7216bc38721aa779a70aa` |

Reproduce the manifest (downloads + hashes + streaming parses, no commits of blobs):

```bash
NSW_CACHE_DIR=.work-cache/nsw npm run archive:nsw
```

## 3. ArcGIS capital projects

The capital-projects workbook is not one of the 12 XLSX. NSW Treasury publishes capital projects
through the official ArcGIS feature layer:

- Dataset: **`Treasury_Project_Data_20260609_gdb`**
- Layer: `https://services2.arcgis.com/Yb2UeNWvQYEwyYDl/arcgis/rest/services/Treasury_Project_Data_20260609_gdb/FeatureServer/0`
- Query: `.../FeatureServer/0/query?where=1%3D1&outFields=*&returnGeometry=false&f=json`
- Project count: **974** fetched (verified with `returnCountOnly=true`, and the connector refuses any other count); 803 have a usable 2025-26 budget and 171 are skipped with a warning rather than zero-filled
- Budget field: **`Budget_Year_FY_2025_26_000`** (`$'000`)
- Carried into records: `Project_ID`, `OBJECTID`, `Agency_Name`, `Cluster_PNFC_Sector`, `Sector`,
  `Project_name`, `Project_Category`, `Project_Status`, `Electorate`, `Region`, `LGA`,
  `Estimated_Physical_Commencement_Year`, `Estimated_Physical_Completion_Year`
- ArcGIS JSON copy SHA-256: `7229c636fbe1a845a1b2d563b1fb55ed940a14fc255a27a7143ab3f65d935a6b`
  (797,716 bytes; canonical JSON of the 974 attributes)
- Source date: `2026-06-22` (`dataLastEditDate`)

LGA is copied only when the feature has a usable `LGA`; `n.a.`/unknown is left absent with
`data_quality_flag: "statewide_only"`. Electorate is carried in `notes`; it is never used to infer
an LGA. No project is inferred, geocoded or zero-filled.

## 4. Unit rules (explicit, tested)

The unit is read from the workbook header row or the ArcGIS field name. There is no silent default.

| Source                                           | Unit    | Conversion to integer cents                                     |
| ------------------------------------------------ | ------- | --------------------------------------------------------------- |
| Financial statements (`GG`/`PNFC`/`NFPS`)        | `$m`    | `value × 1,000,000 dollars × 100 = value × 100,000,000`         |
| Historical fiscal indicators (`$b` columns only) | `$b`    | `value × 1,000,000,000 dollars × 100 = value × 100,000,000,000` |
| ArcGIS capital projects                          | `$'000` | `value × 1,000 dollars × 100 = value × 100,000`                 |

`amountToCents()` returns `null` for an unknown unit, a non-numeric value (`n.a.`, blank) or a
negative result. Negative net/deficit lines are **skipped, not abs()ed**, because the model stores
non-negative spending. The unit conversion is covered by
`server/test/nsw-budget-open-data.test.ts` with exact expected cents.

## 5. Column / measure mapping

**Financial statements.** Only the `Operating Statement` sheet for each sector
(`GG`/`PNFC`/`NFPS`) is considered. The header row is found by the presence of `Actual`, `Budget`
and `Forward Estimates`; the year row is above it and the unit row below it. `Forward Estimates` is
forward-filled across all three year columns (the header row is often shorter than the year/unit
rows). Each expense row is emitted **once per financial-year column**, never flattened into one
record:

| Column header       | `measure_type`                                               |
| ------------------- | ------------------------------------------------------------ |
| `Actual`            | `actual`                                                     |
| `Revised`           | `estimate` (documented: a revised estimate is not an actual) |
| `Budget`            | `budget` (displayed as **Budgeted**)                         |
| `Forward Estimates` | `estimate`                                                   |

**Only the `Expenses from Transactions` section is ingested.** Revenue/taxation rows, balance-sheet
lines, cash-flow receipts/payments, `Other Economic Flows`, the budget result/net operating balance
and the `Total Expenses from Transactions` row are excluded. Excluding the total avoids
double-counting the component expense lines. Balance-sheet and cash-flow sheets are excluded
wholesale. Anything the classifier cannot place in the expenses section is logged as a skipped
warning rather than guessed.

The sector sheet prefix maps to `delivery_entity` (`General government sector`, `Public
non-financial corporations`, `Non-financial public sector`); `funding_source` is `NSW Treasury`.

**Historical fiscal indicators.** Sheets `Table D.1`–`D.4`. Only **spending** indicators with an
explicit `$b` unit are ingested: `Expenses`, `Capital Expenditure` and `Interest Expense`.
`Revenue`, `GSP`, `Budget Result`, `Gross Debt`, `Net Debt` and `Net Lending/(Borrowing)` are
excluded, as are percentage, `% of GSP`, `% Growth` and index columns. The financial year is the
row label in column A; years before 2025-26 are `actual`, 2025-26 is `budget`, later years are
`estimate` (forward estimates).

**Economy and performance/wellbeing workbooks.** The economy workbook and the nine
performance/wellbeing workbooks contain percentages, indices and counts, not dollar spending
series. They are discovered, downloaded, hashed and stream-parsed to prove they are valid XLSX,
but **no `amount_cents` is invented for them**. This is recorded as a connector warning.

**Capital projects.** Every ArcGIS feature **with a usable `Budget_Year_FY_2025_26_000`** becomes
one `budget` measure for `2025-26` with `amount_cents = value × 100000`,
`delivery_entity = Agency_Name`,
`funding_source = Cluster_PNFC_Sector` (falling back to `Sector`), `location.state = "NSW"`,
`location.lga_name` only when present, and `data_quality_flag` `provisional` (LGA present) or
`statewide_only` (no LGA). `Project_name`, `Project_ID`, `Electorate`, `Region`, status and
category are kept in `project_name`/`description`/`notes`.

**Common fields.** `jurisdiction_level: "state"`, `jurisdiction: "NSW"`, `source_id:
"nsw-budget"`, `source_dataset: "NSW Budget 2025-26 Open Data"`, `verified: false`,
`source_url` = the open-data page (financial/HFI) or the ArcGIS layer (capital), and every row has
provenance in `notes` (workbook filename, sheet, row, column, unit and the source-copy SHA-256).

## 6. COFOG decisions

COFOG is **not** inferred from a project's title. A capital project gets a division only when its
`Agency_Name` maps conservatively (Transport/Metro/Roads/Rail → 04, Health → 07, Education → 09,
Police/Corrective/Fire/Emergency/Justice → 03, Water/Housing/Planning → 06,
Environment/Energy/Climate/Parks → 05, Sport/Arts/Culture → 08, Social/Community/Disability → 10,
Treasury/Finance/Revenue/Premier/Cabinet/Parliament → 01, Defence → 02). Otherwise
`function_code` is omitted (`null` in the API) and the row is `provisional`/`statewide_only`.
Financial-statement and HFI rows are statement line items, not functions, so they always have
`function_code` omitted and `data_quality_flag: "provisional"`.

## 7. Natural key and idempotency

The upsert identity is a SHA-256 hash of:

- financial/HFI: `workbook filename + sheet name + row index + column-header set + fiscal year + label`
- capital: `ArcGIS layer name + Project_ID + OBJECTID + fiscal year`

Every record gets `nsw-budget:<40 hex chars>`. Re-running the connector upserts on the same key;
it never deletes rows and never duplicates them. The test suite checks that transforming the same
raw batch twice yields identical keys and that a repeated batch collapses to the same records.
The live proof on a scratch DB was:

```text
[ingest:nsw] nsw-budget: success fetched=1286 upserted=1115
# second run, same DB
[ingest:nsw] nsw-budget: success fetched=1286 upserted=1115
db.measures.countDocuments({source_id:"nsw-budget"}) -> 1115
```

## 8. Counts and provenance shape

On the 2025-26 data: **1,286 raw spending cells/projects → 1,115 valid records**
(138 financial-statement expense cells + 174 HFI spending cells + 803 capital projects with a
usable budget). 171 capital features lack a usable 2025-26 budget and are skipped with a warning;
negative lines and non-spending rows/columns are also skipped/flagged, never guessed. The
`nsw-budget` source ends `active` on success and `degraded` on failure; a failure keeps the old
rows because the runner only upserts and never deletes.

Federal counts before/after S1 are unchanged: **119,935 federal = 117,894 AusTender + 1,231 PBS +
810 synthetic**. With S1's 1,115 NSW rows the pre-S2 database total is **121,050**. S1 adds only
`source_id: "nsw-budget"` rows; S2 adds only `source_id: "data-nsw-ckan"` rows.

## 9. Known limitations

- **Budgeted, not spent.** Every NSW figure is a Budget/estimate/actual statement line item. The
  UI labels budget rows **Budgeted** and never presents them as actual/spent.
- Only Operating Statement expense lines and the three spending HFI indicators are ingested.
  Revenue, taxation, receipts, GSP, debt, net assets, budget result, cash-flow and balance-sheet
  lines are deliberately absent from the API, so state totals cannot be misread as "all budget
  money". Expense line items are still not additive across sectors; the API's per-type totals are
  only per measure type.
- Negative net/deficit lines are skipped because `amount_cents` is non-negative.
- Economy/wellbeing workbooks are percentages/indices/counts and are not converted to dollars.
- Capital locations are only as good as the ArcGIS `LGA` field. Missing LGAs are `statewide_only`,
  never inferred. Electorate is in `notes`, not a fabricated LGA.
- The live page and live 2025-26 XLSX URLs have moved on; reproducibility depends on the Wayback
  snapshot and the archived hashes in the manifest.
- COFOG for capital projects is a conservative agency prefix map, flagged `provisional`.
- The 2026-06-22 ArcGIS layer is a later Treasury extract used for the 2025-26 budget field; the
  manifest records its source date and hash.

## 10. S2 — targeted data.nsw.gov.au CKAN

### 10.1 API and politeness

Read-only CKAN API: <https://data.nsw.gov.au/data/api/3/action/> (no key). The connector runs
`package_search` for the nine required discovery queries, then `package_show` only for the selected
datasets. It never harvests the ~16,907-dataset portal.

- 500 ms between every CKAN API/download request (`CKAN_DEFAULT_DELAY_MS`).
- `Retry-After` is honoured on HTTP 429/503, with up to four retries
  (`CKAN_DEFAULT_MAX_RETRIES`).
- Downloads are sequential (well below the two-concurrent ceiling).

Observed discovery counts (logged in `data_sources.notes` / the archive manifest):

| Query                            | Count | Selected?                                                                  |
| -------------------------------- | ----: | -------------------------------------------------------------------------- |
| `budget`                         |    80 | `nsw-budget-paper-2`                                                       |
| `expenditure`                    |    62 | `fleet-vehicle-expenditure-data-fy18-19`                                   |
| `capital works`                  |    32 | `nsw-budget-paper-2` (capital)                                             |
| `grants`                         |    73 | no tabular grant dataset selected; PDF-only results deferred/not harvested |
| `agency expenditure`             |    23 | `media-expenditure-by-agency-2024-2025` (DOCX deferred)                    |
| `organization:the-treasury`      |    11 | fleet expenditure                                                          |
| `organization:transport-for-nsw` |   268 | no extra spend dataset selected                                            |
| `organization:nsw-health`        |    29 | no extra spend dataset selected                                            |
| `organization:education`         |    79 | `nsw-education-resource-allocation-model`                                  |

### 10.2 Selected datasets and resources

| Dataset (CKAN title)                                                 | Resource                                                    | Mode                                           | Source rows | SHA-256                                                            |
| -------------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------- | ----------: | ------------------------------------------------------------------ |
| NSW public schools Resource Allocation Model (RAM) funding by school | 2026 RAM funding table (`359f1b44…`)                        | CSV download (explicit `$` column)             |       2,212 | `5669f406ac3a9a437ed990744cb56899e0a02d5700e75652207b9e07f908d5bc` |
| NSW Budget Paper 2                                                   | `NSW_BudgetPaper2_201617` (`0b1ab94e…`)                     | DataStore `datastore_search` (paged)           |         672 | `b85ec0895da74559c3fd35113458e12f266a6651fe3070720e786ac1cfe98bb5` |
| Fleet Vehicle expenditure data FY18-19                               | `Fleet Vehicle expenditure data FY18-19.xlsx` (`1bf4db95…`) | XLSX download; `$` from cell format `"$"#,##0` |          11 | `7a876fcde7a6da8ebf2eec5d813f19f5ed3daa26d038af16a788993e81466e63` |

The committed manifest is [`docs/source-archive/data-nsw-ckan.json`](docs/source-archive/data-nsw-ckan.json).
It records the exact resource URL, local archive path and SHA-256 for every downloaded/DataStore
resource. Bytes live outside the repository (default `~/ausspend-source-archive/data-nsw-ckan`);
only metadata is committed.

The DataStore JSON is archived too: the paged `datastore_search` response is serialised, hashed and
recorded, so a DataStore-only resource has the same auditability as a downloaded CSV/XLSX.

### 10.3 Deferred resources (recorded, not ingested)

| Dataset                                | Resource                                      | Format   | Why deferred                                                       |
| -------------------------------------- | --------------------------------------------- | -------- | ------------------------------------------------------------------ |
| Fleet Vehicle expenditure data FY18-19 | `Fleet Vehicle expenditure data FY18-19.pdf`  | PDF      | PDF extraction is the separate foundation; S2 does not ingest PDFs |
| Media Expenditure by Agency 2024/2025  | `202407-202506-q4-expenditure-by-agency.docx` | DOC/DOCX | DOCX extraction is deferred with PDF                               |

Deferred resources are persisted in `data_sources.deferred_resources`, returned by
`/api/v1/data-sources` and shown on the Data sources page as a labelled "recorded, not ingested"
list. They are not silently dropped.

### 10.4 Mapping rules

- `jurisdiction_level: "state"`, `jurisdiction: "NSW"`.
- `source_id: "data-nsw-ckan"`.
- `source_dataset` = the CKAN dataset title.
- `source_url` = `https://data.nsw.gov.au/data/dataset/<package_name>`.
- `source_detail` (in `notes`) = the exact resource URL + archive local path + SHA-256.
- Amount columns are detected by header keywords and explicit `$`/`$'000`/`$m`/`$b` markers. Where
  a source also has cumulative/total columns, the resource mapping names only the annual allocation
  columns so cumulative spend and project totals are not double-counted.
- Units are converted to integer cents (`$` ×100, `$'000` ×100,000, `$m` ×100,000,000,
  `$b` ×100,000,000,000). Missing/ambiguous units are never silently assumed: the closest
  published convention is used, the row gets `data_quality_flag: "provisional"` and the run logs a
  warning.
- Financial years come from the amount-column header (`Allocation201415` → `2014-15`), a row
  date/FY column, or the resource mapping (RAM 2026 → `2025-26`; fleet FY18-19 → `2018-19`).
- Measure type: RAM and Budget Paper 2 are `budget` (allocations, not spend); fleet is `actual`
  because it reports historical supplier-invoice spend, but the source does not describe it as
  audited, so it is provisional. No new measure type is invented.
- `natural_key = data-nsw-ckan:sha256(package_id + resource_id + row_hash)`, where `row_hash`
  hashes the sorted row fields plus the amount column. Re-running the connector produces the same
  keys (idempotent upsert); exact duplicate source rows are counted and logged, not silently kept
  as separate observations.
- Every row has `verified: false`; locations are `{state: "NSW"}` plus an LGA only where the source
  supplies one. Missing LGAs are `statewide_only`, never inferred.
- COFOG is filled only from a conservative entity/category prefix map (for example Health → 07,
  Education → 09, Transport → 04, Justice/Fire → 03); otherwise `function_code` is absent.

### 10.5 Reconciliation and counts

The live run logs per-resource reconciliation:

```text
RAM 2026:    source_rows=2212, rows_with_records=2211, measures=2211, rejected_rows=1 (Grand Total)
BudgetPaper2: source_rows=672, rows_with_records=628, measures=1251, rejected_rows=44,
              rejected_values=44 ("n.a" in Allocation201617)
Fleet FY18-19: source_rows=11, rows_with_records=10, measures=10, rejected_rows=1 (Total)
```

Every rejection is logged with its row and reason (`total/subtotal row excluded`, `unusable amount
"n.a"`, `negative amount skipped`, or `no usable amount`). Source rows are reconciled as
`rows_with_records + rejected_rows`; one row may legitimately produce more than one measure when it
has multiple annual allocation columns.

Live total: **3,472 measures** from **2,895 source rows** (2,211 RAM + 1,251 Budget Paper 2 + 10
fleet). The database therefore moves from **121,050** pre-S2 measures to **124,522**; the existing
117,894 AusTender + 1,231 PBS + 810 synthetic + 1,115 NSW Budget rows are preserved exactly.

### 10.6 Idempotency and failure behaviour

`npm run ingest:nsw -- --source data-nsw-ckan` re-runs the same selection. The runner upserts on
`natural_key`; a second run reports the same fetched/upserted counts and does not duplicate rows.
A source failure is logged as `error`, marks `data_sources.status = "degraded"` and preserves the
previous rows (the runner never deletes).

### 10.7 API and UI visibility

- `GET /api/v1/spending?jurisdiction_level=state` includes `source_id: "data-nsw-ckan"` rows with
  `source_dataset`, `source_url`, `source_date`, `data_quality_flag`, `location` and provenance
  notes.
- `GET /api/v1/data-sources` returns `data-nsw-ckan` with `status`, `records_ingested`,
  `last_ingested_at`, `notes` and `deferred_resources`.
- `GET /api/v1/meta/coverage` lists `data-nsw-ckan` under `state_ingestion.live` and exposes the
  deferred resources; the limitations name the targeted/no-harvest and deferred-PDF/DOCX rules.
- The Data sources page renders the new source, its deferred PDF/DOCX list, and a link to the
  state spending view. The Search page labels CKAN rows' provenance and provisional status.

### 10.8 What S2 does not do

S2 stops at targeted `data.nsw.gov.au` CKAN. It does **not** start Dubbo/local-government (S3),
VIC/QLD/WA, SOC/charity, or live PDF/DOCX ingestion. PDF/DOCX resources are listed as deferred and
remain for a later phase.

## 11. What these items stop before

S1 stops after the NSW Budget Open Data connector. S2 adds only the targeted CKAN connector.
Neither starts:

- Dubbo / local-government data (S3),
- VIC, QLD or WA budget sources,
- SOC/charity sources,
- live PDF/DOCX ingestion (the source-archive/PDF foundation is available, but S2 only records
  PDF/DOCX resources as deferred).

The VIC/QLD/WA connectors remain stubs in `server/src/connectors/registry.ts`.

## 12. Archived copies and the reusable PDF foundation

The official blobs are not committed. S1's local copies live in
`~/.cache/ausspend/nsw-budget/2025-26` and the committed manifest
`docs/source-archive/nsw-budget-2025-26.json` records the exact URL and SHA-256 for each one.
The post-S1 source-archive foundation adopts those copies **by reference** (it re-hashes them, it
does not copy or mutate them):

```bash
npm run archive -- adopt-nsw            # metadata records; no DB write
npm run archive -- verify --source-id=nsw-budget
MONGO_URL=mongodb://localhost:27017/ausspend_dev \
  npm run archive -- adopt-nsw --write-db
```

Examples matching the manifest:

- `open-data-2025-26.html` — `9a0a79b1…b12438`, 23,684 bytes (Wayback);
- `2025-26-Budget-Financial-Statements.xlsx` — `c3e4fb8e…661c09`, 178,309 bytes (Wayback);
- `arcgis-capital-projects.json` — `7229c636…935a6b`, 797,716 bytes, 974 features (ArcGIS).

`GET /api/v1/source-documents?source_id=nsw-budget` lists the records (path, hash, exact URL).

The same foundation provides reusable PDF text/table extraction
(`server/src/connectors/pdf-extract.ts`, `npm run pdf:extract -- --file=…`). It detects explicit
`$`/`$'000`/`$m`/`$b` units, converts to integer cents, and **refuses to ingest** a table when the
unit is missing/ambiguous or row/column totals do not reconcile. All PDF rows are `provisional`
and require human review before `verified`. S1 and S2 do not ingest any PDF/DOCX; S2 records those
resources as deferred, and S3/VIC/QLD/WA/SOC/charity remain out of scope. Details, tests and
boundaries: [docs/SOURCE_ARCHIVE_AND_PDF.md](./docs/SOURCE_ARCHIVE_AND_PDF.md).

## 13. S3 — Dubbo Regional Council (one council only)

### 13.1 Source discovery and archived copy

S3 covers **exactly one council**. The documents were discovered on the official Dubbo Regional
Council site:

- Integrated Planning and Reporting page:
  <https://www.dubbo.nsw.gov.au/About-Council/Our-Responsibilities/Integrated-Planning-and-Reporting>
  (server-rendered HTML list of council plans and PDFs; observed 2026-11-17).
- Adopted budget/capital document:
  <https://www.dubbo.nsw.gov.au/ArticleDocuments/290/20262027%20Budget%20and%20Forecasts%20including%20Capital%20-%20Adopted.PDF.aspx>
- The Delivery Program / Operational Plan PDF is also listed on that page, but the numeric
  budget and capital tables live in the adopted budget document above. No headless browser was
  used: the discovery page is server-rendered and the budget is a first-party PDF.

Archived copy (bytes outside git, metadata under the source archive root):

| Field          | Value                                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Document       | `2026/2027 Budget and Forward Forecasts including Capital Expenditure (Adopted)`                                                     |
| Exact URL      | `https://www.dubbo.nsw.gov.au/ArticleDocuments/290/20262027%20Budget%20and%20Forecasts%20including%20Capital%20-%20Adopted.PDF.aspx` |
| SHA-256        | `0b527aae6088c850b4ad4307ca9e513d30b9d9e14859503ea61a937e41751123`                                                                   |
| Bytes          | 615,350                                                                                                                              |
| Pages          | 14 (2–5 income/expenditure summary; 6–9 function statements; 10–14 capital program)                                                  |
| Archive path   | `~/ausspend-source-archive/dubbo-council/dubbo-council-budget.pdf`                                                                   |
| Retrieved from | `direct` (council URL), archived and hash-verified                                                                                   |

The connector calls `archiveSourceDocument()` + `verifySourceDocument()` before extraction. The
exact URL, archive path and SHA-256 are repeated in every measure's `notes`/`source_detail`, so a
row can be audited back to the archived bytes. No blob is committed.

### 13.2 Unit and total validation

The adapter (`server/src/connectors/dubbo-council.ts`) uses the shared PDF foundation for text
position extraction, then a Dubbo-specific layout parser. It never defaults a unit to dollars.

| Section                                                              | Printed unit    | Rule                                                                                                                                                                                                                                |
| -------------------------------------------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Income and Expenditure Summary (Consolidated, General, Sewer, Water) | `($000's)`      | Unit must be explicit. Income/expense rows are converted at 1,000 dollars → 100,000 cents per unit.                                                                                                                                 |
| Capital Expenditure program                                          | no printed unit | Unit is resolved only by magnitude reconciliation against the explicit `$'000` consolidated summary: 119,744,813 capital dollars vs 214,047 ($'000) total income = 0.56×, so dollars fits; thousands would be 559× and is rejected. |

Totals:

- Summary: each fund's income rows and expense rows are summed per fiscal-year column and
  compared with the printed total rows. Published `$'000` tables round each line independently,
  so a difference of at most `rows + 1` units is recorded as a rounding note; anything larger
  rejects the whole fund section (no rows ingested). The test suite constructs a mismatched
  column and asserts the section is rejected.
- Capital: category totals → group totals → grand total are reconciled for all four columns.
  The parsed program has 32 categories, 5 group totals and a grand total of 119,744,813 for
  2026/27. A mismatch (including a changed grand total in the unit test) rejects the entire
  capital section.
- A missing/ambiguous unit also rejects the section. `server/test/dubbo-council.test.ts`
  includes the mandatory test that would fail if `($000's)` were read as dollars
  (`83,735` units must map to 8,373,500,000 cents, not 8,373,500).

### 13.3 Mapping

| Field                   | S3 value                                                                                                                                                                            |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `source_id`             | `dubbo-council`                                                                                                                                                                     |
| `source_dataset`        | `Dubbo Regional Council Annual Report / Operational Plan`                                                                                                                           |
| `jurisdiction_level`    | `local`                                                                                                                                                                             |
| `jurisdiction`          | `NSW`                                                                                                                                                                               |
| `delivery_entity`       | `Dubbo Regional Council`                                                                                                                                                            |
| `funding_source`        | summary: `Council budget — <fund>`; capital: `Capital works program — council capital expenditure (source table does not itemise funding sources)`                                  |
| `measure_type`          | summary `Budget` column → `budget`; `Annual Revised`/`Forecast` → `estimate`; capital program → `budget`. No row is `actual` because the document labels no audited actuals.        |
| `fiscal_year`           | from the document/column: `2025-26` … `2029-30` for summary; `2026-27` budget column for capital                                                                                    |
| `location`              | `{ state: "NSW", lga_name: "Dubbo" }`                                                                                                                                               |
| `region_id`             | Dubbo Region `_id` `40d7a238d4b2cef48ae5f267` (code `NSW-DUBBO`, slug `dubbo`, parent `NSW`)                                                                                        |
| `geo`                   | absent — the source provides no coordinates; none are inferred                                                                                                                      |
| `function_code`         | only defensible capital categories (roads → `045`, water supply → `063`, sewerage/stormwater → `052`, waste → `051`, parks/culture → `08`); other rows leave it absent              |
| `source_url`            | the exact adopted-budget URL above                                                                                                                                                  |
| `natural_key`           | `dubbo-council:` + SHA-256(`document_url + section + table/page + row + fiscal_year`)                                                                                               |
| `verified`              | `false`                                                                                                                                                                             |
| `data_quality_flag`     | `provisional`                                                                                                                                                                       |
| `extraction_confidence` | `medium` for these rows (summary totals reconcile within published rounding; capital unit is magnitude-inferred and totals reconcile). The value is stored and returned by the API. |

A second council must be a separate adapter like `dubbo-council.ts`; the shared runner, archive
and PDF foundation are unchanged.

### 13.4 Area contract C

Dubbo is a real Region row (level `region`, code `NSW-DUBBO`, slug `dubbo`, parent `NSW`) and
local rows carry its `region_id`. The existing exact filter still works:

- `GET /api/spending?region=<24-char _id>` — exact region filter (unchanged).
- `GET /api/spending?region=Dubbo` or `?region=dubbo` — case-insensitive slug/name resolves to
  the Region and returns the shared area profile.
- `GET /api/spending?area=dubbo` — explicit alias for the same profile.
- `GET /api/regions/dubbo`, `GET /api/region/dubbo`, `GET /api/areas/dubbo` — same profile.
- `GET /api/search?q=dubbo` still returns the region **`_id`** plus its `slug`.

The profile has four panels, each grouped by `measure_type`, and **no total across measure types
or jurisdiction levels**:

1. **Local** — `region_id` = Dubbo or `location.lga_name` = Dubbo (Dubbo Regional Council rows).
2. **State NSW-wide** — `jurisdiction_level: state`, `jurisdiction: NSW`, labelled NSW-wide and
   not Dubbo-specific.
3. **Federal NSW-tagged** — AusTender rows with `location.state: NSW`, labelled NSW-tagged and
   not Dubbo-specific.
4. **Commonwealth PBS** — `source_id: data-gov-au-pbs`, shown separately as Commonwealth-wide;
   PBS rows are excluded from the Dubbo area data rows.

The response carries `area_profile.panels[].by_measure_type` but no panel total and no
cross-level summary total (`summary.total_cents` is null and `summary.total_by_measure_type` is
empty in area mode). The caution text is rendered on `/regions/dubbo`, `/region/dubbo`,
`/areas/dubbo` and the spending explorer when `area=dubbo`.

Other councils and states are shown as **not covered**, not estimated: Bathurst, Orange,
Mid-Western and all other NSW councils, plus VIC, QLD, WA, SA, TAS, ACT and NT.

### 13.5 Reproduction and checks

```bash
# ingest (upserts on natural_key; never deletes other sources)
MONGO_URL=mongodb://localhost:27017/ausspend_dev   npm run ingest:nsw -- --source dubbo-council

# unit/total/area tests
npx vitest run server/test/dubbo-council.test.ts server/test/area-contract.test.ts

# API smoke (alt port, never the user's 3001/5173 stack)
PORT=3101 MONGO_URL=mongodb://localhost:27017/ausspend_dev npx tsx server/src/index.ts
curl -s 'http://localhost:3101/api/spending?area=dubbo' | jq '.area_profile.panels | map({key,count,total_cents})'
curl -s 'http://localhost:3101/api/areas/dubbo' | jq '.region'
```

Observed on 2026-11-17 against `ausspend_dev`:

- `dubbo-council: success fetched=245 upserted=245`; a second run upserted the same 245 and did
  not add rows (idempotent).
- Totals: 124,522 → 124,767 measures. Federal counts did not move:
  `aus-tender` 117,894; `data-gov-au-pbs` 1,231; `nsw-budget` 1,115; `data-nsw-ckan` 3,472;
  `synthetic-seed` 810; new `dubbo-council` 245.
- Area panels: local 245, state NSW 4,587, federal NSW-tagged 37,380, Commonwealth PBS 1,231;
  every `total_cents` is `null`.
- `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, `npm run build` pass;
  Playwright on alt ports (`e2e/playwright.alt.config.ts`, client 5174) passes 29 tests.
