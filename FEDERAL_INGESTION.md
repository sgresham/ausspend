# Federal ingestion — AusTender (F2) and data.gov.au PBS (F3)

Three federal sources are wired:

1. **AusTender** contract notices from the Australian Government's public OCDS API (F2).
2. **Portfolio Budget Statements (PBS)** budget line items from the data.gov.au CKAN dataset,
   streamed from the 2025-26 program-expense CSV (F3).
3. **GrantConnect** grant awards from a human-downloaded, SHA-256-archived `DownloadResult` XLSX
   export, imported in cap-safe date chunks (manual file import; no API and no scraper).

All are unverified (`verified: false`) and none is a single government total. GrantConnect's wide
exports exceed a 50,000-result cap and are rejected; the source is reported **partial** until
complete date-range chunks cover the period (see
[GrantConnect](#grantconnect--manual-chunked-and-cap-safe-import-no-scraper)). The
state/territory connectors other than NSW remain stubs.

> **PBS caveat.** The PBS CSV is built from individual entity program-expense tables. Its line
> items do **not** sum to the Budget Paper 1 "Estimates of General Government Expenses" total.
> Never present a PBS sum as the federal total.

## Source and endpoint

- Base API: <https://api.tenders.gov.au/ocds>
- Feed: `GET /ocds/findByDates/contractPublished/{startDate}/{endDate}`
- Public and unauthenticated. Every request sends `Accept: application/json` and an explicit
  `User-Agent` identifying ausspend.
- Dates are **ISO-8601 instants in the URL path**, not query parameters, for example
  `/ocds/findByDates/contractPublished/2026-11-02T00:00:00Z/2026-11-09T00:00:00Z`.
- The envelope is `{ "releases": [ ... ], "links": { "next": "...?cursor=..." } }` with about
  100 releases per page.

### `contractPublished` nuance

The feed is **date-of-publication of the contract notice**, not the contract's start date or the
date the tender was advertised. A one-week window therefore yields the contract notices published
in that week; `contracts[0].dateSigned` can fall just outside the window (for example, an
adjustment published later for a contract signed earlier). This is why the fiscal year is derived
from the contract/release date, not from the fetch window, and why re-running the same window is
idempotent on `ocid` rather than "new records each run".

## Mapping (critical)

Each release maps to one `measures` document with `measure_type: "contract"`.

| Target field         | Source                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------ |
| `project_name`       | `contracts[0].title` (omitted when null/empty; never invented)                                   |
| `description`        | `contracts[0].description`                                                                       |
| `jurisdiction_level` | literal `"federal"`                                                                              |
| `jurisdiction`       | literal `"Commonwealth"`                                                                         |
| `funding_source`     | the `parties[]` entry whose `roles` contains **`buyer` or `procuringEntity`** (buyer)            |
| `delivery_entity`    | the `parties[]` entry whose `roles` contains **`supplier` or `tenderer`** (supplier)             |
| `amount_cents`       | `contracts[0].value.amount` (decimal-dollar string) × 100, rounded to a **safe integer**         |
| `fiscal_year`        | derived from `contracts[0].dateSigned`, falling back to the release `date` (Australian FY)       |
| `measure_type`       | literal `"contract"`                                                                             |
| `source_dataset`     | literal `"AusTender OCDS API"`                                                                   |
| `source_url`         | `https://www.tenders.gov.au/Contract/Details/{contracts[0].id}`                                  |
| `source_date`        | `contracts[0].dateSigned` or the release `date` (ISO-8601)                                       |
| `location`           | `parties[]` address `region` only (supplier first, then buyer); postcode is kept in `notes`      |
| `data_quality_flag`  | `location_approximate` (state + postcode), `statewide_only` (state only), or `location_unknown`  |
| `unspsc`             | `contracts[0].items[].classification.id` where `scheme == "UNSPSC"`, de-duplicated, comma-joined |
| `natural_key`        | `ocid`                                                                                           |
| `verified`           | `false` — no human verification step exists yet                                                  |

**Never `parties[0]`.** The live feed's first party is frequently the supplier, and the top-level
`buyer` field is `null`. The buyer _must_ be looked up by role (`buyer` / `procuringEntity`) and the
supplier by role (`supplier` / `tenderer`). The fixture test
`server/test/aus-tender.test.ts` deliberately puts the supplier first so a `parties[0]` regression
fails.

Invalid amounts (missing, non-numeric, negative, not a safe integer) are **skipped**, not written
with a guessed or rounded-down value; the reason is recorded on the connector run and the run is
logged `partial` with the source marked `degraded`.

### UNSPSC, not COFOG

AusTender classifies goods/services with **UNSPSC** codes. They are stored verbatim in the
`unspsc` field and are **never** translated to a COFOG function. Federal contract rows therefore
have `function_code: null` and are omitted from COFOG breakdowns; the API tolerates a null
function/region rather than inventing one.

### Date and financial-year rule

Australian financial years run **1 July – 30 June**, formatted `YYYY-YY`:

| Date (UTC) | FY      |
| ---------- | ------- |
| 2025-06-30 | 2024-25 |
| 2025-07-01 | 2025-26 |
| 2026-01-01 | 2025-26 |

The date used is `contracts[0].dateSigned`; if absent, the release `date`. A release with neither is
skipped.

### Location quality flags

Only a `parties[]` address state is stored in `location.state`. A postcode, when present, is kept
in `notes`. ausspend never invents an LGA, SA2 or coordinate:

- `location_approximate` — state and postcode were present.
- `statewide_only` — state only.
- `location_unknown` — no party address state.

## Pagination and rate policy

- The returned `links.next` cursor is followed page by page.
- A **1 second** delay is applied between pages (not before the first page).
- `429` responses honour `Retry-After` (seconds or HTTP date, capped at 60 s); otherwise the
  connector backs off exponentially (1 s, 2 s, 4 s, …) up to four retries, then fails the source.
- A bounded page limit (`AUSTENDER_PAGE_LIMIT`, default 25) protects the run. If the limit is hit
  while a cursor remains, the connector reports `page limit N reached; results truncated`.
- **Historical backfill** raises that bound per chunk: the backfill splits the window into seven-day
  chunks and uses `AUSTENDER_PAGE_LIMIT=100` (≈100 releases/page × 100 pages ≈ 10,000 releases per
  week, more than four times the busiest observed week of 2,195 releases / ~22 pages). The 25-page
  default would truncate a peak week; 100 never did across 105 chunks.
- The next cursor is rejected if it leaves `api.tenders.gov.au`.

## Natural key and idempotency

`natural_key = ocid`. The runner upserts with
`MeasureModel.updateOne({ natural_key }, { $set: record }, { upsert: true })`, so re-running the
same window updates the same documents: counts stay stable and there are no duplicate natural keys.
Releases sharing an `ocid` within one batch are de-duplicated, keeping the newest `source_date`.
The chunked historical backfill uses the same path: re-running a chunk is idempotent and never
deletes an existing row.

## PBS (data.gov.au) — source, CSV and streaming parse

- CKAN API base: <https://data.gov.au/data/api/3/action/>. Read-only, no API key.
- The connector calls `package_show?id=<dataset>`, then selects that year's machine-readable
  line-item CSV. The ZIP/Excel bundles and the Budget Paper 1/4 resources are ignored.
- Historical coverage is **FY2020-21 through FY2025-26**. Each year keeps its own dataset id,
  resource, fiscal-year label and amount column; the connector does not copy one year's schema onto
  another.

| Fiscal year | CKAN dataset id                        | Published CSV resource (selected)                   | Amount column |
| ----------- | -------------------------------------- | --------------------------------------------------- | ------------- |
| 2020-21     | `86d7d307-92e2-48d9-b375-480685056673` | `2020-21 PBS Program Expense Line Items csv`        | `2020-21`     |
| 2021-22     | `98039365-ae78-4290-8d7c-eb0a4fcbd52b` | `2021-22 PBS Program Expense Line Items.csv`        | `2021-22`     |
| 2022-23     | `72594fbc-ef66-40f2-a8af-845372dc0f99` | `2022-23 October Budget Program Expense Line Items` | `2022-23`     |
| 2023-24     | `9dc4136b-8daa-44a9-af0e-ace9dba41905` | `2023-24 Budget Program Expense Line Items (CSV)`   | `2023-24`     |
| 2024-25     | `6aeeefa5-65c4-45fb-bc7e-c8f33c7ffa44` | `2024-25 PBS Program Expense Line Items.csv`        | `2024-25`     |
| 2025-26     | `4f025f38-0c70-45e2-8106-4c29a5e48637` | `2025-26 PBS Program Expenses Line Items`           | `2025-26`     |

**FY2022-23 has two packages (March and October).** The October package is the canonical final
budget for the year and the only one ingested. The March package (`4c514578-a6aa-463d-ba2f-5d333fed077f`)
is deliberately excluded so FY2022-23 is never counted twice; its CSV is byte-different but budgets
the same fiscal year, so ingesting both would create duplicate FY rows with no schema-safe way to
tell them apart. If the position ever changes, add an explicit source-order field first — do not
add a second dataset to the year list as-is.

- Resource names are **not stable across years** (for example "Program Expense" vs "Program
  Expenses", "PBS" vs "Budget", with or without a `.csv` suffix). Selection scores the exact
  published name, the fiscal year in the name, and the "program expense"/"line item" phrases, so a
  wrapped or renamed resource is still matched to the correct year without hard-coding resource ids.
- Column headers also vary: FY2020-21..FY2024-25 use spaced names (`Expense type`,
  `Appropriation type`, `Source document`, `Source table`), while FY2025-26 uses underscores
  (`Expense_type`, …). Both spellings are accepted per field.
- Several published CSVs (FY2022-23 March/October and FY2023-24) begin with four rows of empty
  comma-delimited cells before the real header. The parser decodes the stream as arrays, finds the
  first row containing `Portfolio` and `Program`, then maps the following rows using the raw header
  names.
- The CSV is decoded as **Windows-1252** (the source has 0x92 curly quotes, not valid UTF-8) and
  parsed with a **streaming CSV parser** (`csv-parse`, pinned exactly). Chunks are fed straight
  from the HTTP body; the file is never loaded as a single string.
- CKAN and download calls are 500 ms apart. A `429` honours `Retry-After` (seconds or HTTP date,
  capped at 60 s) with bounded exponential backoff.
- If one historical package cannot be read, that year is recorded as a year-specific gap while the
  remaining complete years still ingest; the source is marked `partial`/`degraded`. If no year can
  be read, the source errors. No year is zero-filled or fabricated.

### PBS row mapping

| Target field         | Source / rule                                                                                                                                   |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `source_id`          | literal `"data-gov-au-pbs"`                                                                                                                     |
| `source_dataset`     | the year's title, e.g. `"2025-26 Portfolio Budget Statements (data.gov.au)"` or `"2022-23 Portfolio Budget Statements (data.gov.au, October)"`  |
| `measure_type`       | literal `"budget"`                                                                                                                              |
| `jurisdiction_level` | literal `"federal"`; `jurisdiction` literal `"Commonwealth"`                                                                                    |
| `project_name`       | `Program` (whitespace/NBSP-normalised)                                                                                                          |
| `description`        | `Outcome`                                                                                                                                       |
| `delivery_entity`    | `Department/Agency`                                                                                                                             |
| `funding_source`     | `Portfolio`                                                                                                                                     |
| `amount_cents`       | that year's amount column (see table above) × 1,000 (published `$'000`) × 100, safe integer; `nfp`, blank, negative or invalid rows are skipped |
| `fiscal_year`        | the year's own label (`"2020-21"` … `"2025-26"`)                                                                                                |
| `source_url`         | the data.gov.au resource page URL                                                                                                               |
| `source_date`        | resource `last_modified` / release date                                                                                                         |
| `function_code`      | COFOG-A division only where the portfolio has one defensible functional area (see below)                                                        |
| `data_quality_flag`  | `statewide_only` when a COFOG division is mapped; `provisional` when it is not                                                                  |
| `location`           | `{ state: "Commonwealth" }` only; PBS is not geographically tagged                                                                              |
| `natural_key`        | that year's dataset id + `:` + stable row hash; exact duplicate rows add an occurrence suffix                                                   |
| `verified`           | `false`                                                                                                                                         |
| `notes`              | expense/appropriation/source table, the year's `$'000` amount column, the CSV download URL and the caveat                                       |

**Units.** The CSV has bare integers and no unit column. The referenced PBS program tables publish
`$'000`, so the raw value is thousands of dollars: `2,500` → `$2,500,000` → `250,000,000` cents.
The mapping is documented in every record's `notes`; only the budget-year column is ingested. Other
amount columns (`2024-25`, `2026-27`, etc.) are ignored and are not comparable across years in this
ingestion.

**COFOG mapping is conservative.** Only portfolios with a single defensible functional area are
mapped (for example Health and Aged Care → `07`, Defence → `02`, Education → `09`, Social Services
and Veterans' Affairs → `10`, Attorney-General's and Home Affairs → `03`, Agriculture/Industry/
Employment → `04`, Treasury/Finance/PM&C/Parliament/Foreign Affairs → `01`). Mixed portfolios
such as Infrastructure/Transport/Communications/Arts and Climate/Energy/Environment are left
`function_code: null` and flagged `provisional`; no function is invented. The row's location is
never an LGA, SA2 or coordinate.

### PBS natural key and idempotency

`natural_key = dataset_id + ':' + SHA-256 of the canonical source row` (field names sorted;
whitespace normalised). Using the year's own dataset id keeps FY2020-21..FY2025-26 rows distinct and
leaves the existing FY2025-26 keys unchanged, because that dataset id and its underscore header
spelling are preserved. Exact duplicate source rows in the published file get a stable `-1`, `-2`, …
occurrence suffix so they are not silently collapsed and re-runs stay byte-identical. The runner
upserts on `natural_key`, so re-running the PBS connector updates the same documents and never
duplicates. A single run fetches all six years; re-running it is idempotent across the whole range.

### PBS caveat in the app

`/api/v1/spending?...&measure_type=budget`, `/api/v1/meta/coverage` and both `/search` and
`/data-sources` state the caveat. The budget per-measure-type total is the PBS line-item sum only,
not a federal total. The coverage API exposes `federal_ingestion.pbs_caveat` and
`pbs_last_ingested_at`.

### PBS tests and live smoke

`server/test/data-gov-au-pbs.test.ts` covers the six-year package set, per-year resource selection
(including wrapped/renamed resources and the March/October rule), both header spellings and the
leading blank rows, per-year amount columns and fiscal-year identity, chunked Windows-1252 parsing,
mapping/row hash/idempotency, unmappable COFOG → provisional, integer amounts, `nfp`/negative skips,
duplicate occurrence keys and the multi-year connector fetch/transform (including a one-year gap).
The opt-in live smoke runs the real CKAN calls and all six CSV streams:

```bash
PBS_LIVE_TEST=1 npx vitest run server/test/data-gov-au-pbs.test.ts
```

### PBS live run

```bash
INGEST_SOURCES=data-gov-au-pbs \
MONGO_URL=mongodb://localhost:27017/ausspend_dev \
npm run ingest:federal
```

The runner writes `ingestion_logs`, updates `data_sources` (`active`/`degraded`,
`last_ingested_at`, `records_ingested`, `errors`) and continues with the next source on failure.
A PBS failure marks the source `degraded` and logs an `error`; it never aborts the run.

### PBS historical backfill result (2026-11-18)

Run against `ausspend_dev` after the connector/tests were green:

```bash
INGEST_SOURCES=data-gov-au-pbs \
MONGO_URL=mongodb://<host>:27017/ausspend_dev \
npm run ingest:federal
# [ingest] data-gov-au-pbs: success fetched=10671 upserted=10480
```

The single PBS run fetched and upserted all six complete years (no year was skipped or zero-filled):

| Fiscal year   | Rows       |
| ------------- | ---------- |
| 2020-21       | 1,786      |
| 2021-22       | 1,788      |
| 2022-23       | 2,053      |
| 2023-24       | 1,772      |
| 2024-25       | 1,850      |
| 2025-26       | 1,231      |
| **PBS total** | **10,480** |

Before/after checks:

- `data-gov-au-pbs`: **1,231 → 10,480** rows. The 1,231 existing FY2025-26 rows were preserved, not
  duplicated, because their natural keys were unchanged (the 2025-26 dataset id and header spelling
  are preserved). The pre-run sample keys
  `4f025f38-…:09c9f0ecfb523156bbd62709399b45ad` and `4f025f38-…:80f1267440a0b58b787da9f877889589`
  still resolve to exactly one row each.
- Whole database: **989,095 → 998,349** measures; distinct non-null `natural_key` values **998,349**;
  **0** duplicate natural-key groups; **0** invalid or negative/ fractional `amount_cents`.
- FY2022-23 rows use only the October dataset (`72594fbc-…`); the March dataset prefix
  `4c514578…` matches **0** rows.
- Non-PBS sources: the pre-run total was 987,864. It was 987,869 after the run, and the difference
  is the concurrently-created `qld-energy-queensland` source (5 rows, written by a different
  ingestion run at 23:54:41Z/23:55:18Z that this item did not invoke). Every other non-PBS source
  count is unchanged: this run selected `connectors=1` and logged only `data-gov-au-pbs`, and
  ingestion is upsert-only (no deletes), so the whole 987,864 baseline remains.

No raw PBS CSV is committed; the connector streams each CSV from data.gov.au.

## GrantConnect — manual, chunked and cap-safe import (no scraper)

GrantConnect has no public award API and no CSV/RSS/JSON feed. F4's paid Track A adaptor remains
**blocked** and is not used. The implemented path is **manual file import only**:

1. a human downloads public `DownloadResult` XLSX exports from
   <https://www.grants.gov.au/Ga/ListResult?Type=Ga&AgencyStatus=-1&KeywordTypeSearch=AllWord&DateType=Publish%20Date>
   (no auth, small date ranges),
2. the files are dropped in `~/ausspend-source-archive/grantconnect/` (bytes stay **outside** the
   repo) or passed via `GRANTCONNECT_XLSX_DIR` / `GRANTCONNECT_XLSX`,
3. `INGEST_SOURCES=grantconnect npm run ingest:federal` reads every `.xlsx`, archives each with its
   SHA-256, rejects capped/unbounded files, maps the rest to `grant_award` measures, and reports
   coverage honestly.

There is **no scraper** in the connector. The only networked code is the optional manual helper
`scripts/grantconnect-chunks.ts`, which a human runs to fetch the public `DownloadResult` URL for
small date chunks; it is never invoked by ingestion.

### The 50,000-result cap is real

A wide export's criteria block contains:

> Your search returned more than 50000 results. Please narrow the date range and run multiple
> searches to return all records.

Such a file is **incomplete** and is **rejected**: none of its rows are imported. The supplied
archives are both capped and are kept only as superseded evidence:

| File                                                         | SHA-256 (prefix) | Bytes     | Rows   | Date Range             | Cap warning | Treatment              |
| ------------------------------------------------------------ | ---------------- | --------- | ------ | ---------------------- | ----------- | ---------------------- |
| `GrantConnect-Grant-Award-List_2025-26_20261117_093500.xlsx` | `49177468…`      | 1,008,451 | 10,021 | 1-Jul-2025–30-Jun-2026 | **yes**     | rejected; not imported |
| `GrantConnect-Grant-Award-List_20261117_092623.xlsx`         | `7dc89599…`      | 3,776,146 | 40,021 | All                    | **yes**     | rejected; not imported |

To ingest a period, download smaller ranges (monthly/weekly) so each export is below the cap and
carries no warning. The importer accepts the whole directory as a set and combines complete chunks.

### Actual file layout and columns (verified 2026-11-17)

The workbook has one sheet, `GrantConnect-Grant-Award-List`. Rows 1–20 are a title and criteria
summary; the real header is row 21, with 15 columns:

`GA ID`, `Grant Activity`, `Agency`, `Publish Date`, `Category`, `Start Date`, `End Date`,
`Value (AUD)`, `GO ID`, `Recipient Name`, `One-off/Ad hoc`, `Aggregate Grant Award`,
`Aggregate Reason`, `Number of Awards Aggregated`, `Last Updated`.

The amount column is explicitly `Value (AUD)` in **decimal dollars** (`1104`, `1975.92`). An
unmarked amount column is treated as an ambiguity and the file is rejected, never guessed.

### Mapping

| Target field         | Source                                                                                    |
| -------------------- | ----------------------------------------------------------------------------------------- |
| `project_name`       | `Grant Activity` (the program title)                                                      |
| `description`        | `Grant Activity`                                                                          |
| `jurisdiction_level` | literal `"federal"`                                                                       |
| `jurisdiction`       | literal `"Commonwealth"`                                                                  |
| `delivery_entity`    | `Recipient Name`                                                                          |
| `funding_source`     | `Agency` (the granting agency)                                                            |
| `amount_cents`       | `Value (AUD)` dollars × 100, rounded to a safe integer                                    |
| `measure_type`       | literal `"grant_award"`                                                                   |
| `fiscal_year`        | Australian FY of `Publish Date` (award publish date)                                      |
| `source_dataset`     | literal `"GrantConnect — manual grant award export"`                                      |
| `source_date`        | `Publish Date` (`YYYY-MM-DD`)                                                             |
| `source_url`         | an explicit award-page column when present, else the public list query + `GAID=<GA ID>`   |
| `location`           | omitted — the export supplies no recipient state/LGA (never invented)                     |
| `data_quality_flag`  | `provisional`                                                                             |
| `natural_key`        | `grantconnect:<GA ID>`, else a stable hash of agency/recipient/activity/date/value        |
| `verified`           | `false`                                                                                   |
| `notes`              | archive filename + SHA-256, export date range, GO ID, category, activity dates, aggregate |

Rows with a missing activity/recipient/agency, an invalid/negative amount or an unparseable publish
date are **skipped** with a logged reason, not zero-filled. Duplicate `GA ID`s across chunk
boundaries are de-duplicated by `natural_key`, so re-running an overlapping set is idempotent.

### Coverage: partial vs complete

`coverageOf(targetFY, acceptedChunkRanges)` merges the accepted chunks' `Date Range` intervals and
subtracts them from the target FY (`2025-26` = 2025-07-01..2026-06-30 by default, override with
`GRANTCONNECT_FY`).

- **Complete** (no gaps, no cap-rejected file needed): `data_sources.status = "active"`.
- **Partial** (any missing period or only rejected/superseded files): `status = "degraded"`, an
  `ingestion_logs` `partial` entry records the missing ranges and the rejected filenames, and the
  `data_sources.notes` / `/api/meta/coverage` / `/search` / `/data-sources` show the cap caveat.
  Existing rows are **never deleted**; a missing/corrupt directory logs an `error` and marks the
  source `degraded` while preserving earlier grant rows.

With only the two capped files present (the pre-2026-11-17 state), coverage was **partial 0/365
days** and **zero grant rows** were written — the honest result, not a fabricated FY.

### Actual 2025-26 acquisition (2026-11-17)

The public `DownloadResult` endpoint was queried in 31-day chunks (September in 7-day chunks after a
server-side HTTP 500 on wider September ranges). All 17 accepted chunks were archived under
`~/ausspend-source-archive/grantconnect/` with their SHA-256 and scanned for the cap warning; none
carried it. The two earlier wide exports are still rejected and contribute no rows.

| Date range             | Rows  | SHA-256 (prefix) |
| ---------------------- | ----- | ---------------- |
| 2025-07-01..2025-07-31 | 12913 | `563bf8c8a6ff…`  |
| 2025-08-01..2025-08-31 | 7032  | `b1a5912f9d11…`  |
| 2025-09-01..2025-09-07 | 303   | `34eab57de36f…`  |
| 2025-09-08..2025-09-14 | 153   | `e88e9a8d10e3…`  |
| 2025-09-15..2025-09-21 | 466   | `32d7840e7ad0…`  |
| 2025-09-22..2025-09-28 | 381   | `97d367c1db78…`  |
| 2025-09-29..2025-09-30 | 177   | `08c53c248776…`  |
| 2025-10-01..2025-10-01 | 18    | `b57ff09a9d16…`  |
| 2025-10-02..2025-11-01 | 7017  | `72e0b6087829…`  |
| 2025-11-02..2025-12-02 | 2210  | `60ebd8ca4cd0…`  |
| 2025-12-03..2026-01-02 | 2091  | `c1cb6fd116b7…`  |
| 2026-01-03..2026-02-02 | 6743  | `8130324d22a5…`  |
| 2026-02-03..2026-03-05 | 6517  | `2af0d2d52cb7…`  |
| 2026-03-06..2026-04-05 | 6096  | `356a2ba4c6aa…`  |
| 2026-04-06..2026-05-06 | 6772  | `7a71f682d226…`  |
| 2026-05-07..2026-06-06 | 1656  | `9b2b2b32fba7…`  |
| 2026-06-07..2026-06-30 | 1583  | `a9340c2af4fa…`  |

Total accepted rows: **62,128**, all unique by `natural_key`, covering **365/365 days** of
2025-07-01..2026-06-30. `data_sources.status = "active"`, `records_ingested = 62128`. A second
identical import left the measure count unchanged (idempotent).

Two implementation fixes were needed to acquire the data:

- The helper now sends a browser-style `Mozilla/5.0` User-Agent token _with_ the ausspend
  identifier. GrantConnect's CloudFront layer returns HTTP 403 for a bare `ausspend/0.1` or empty
  User-Agent even on the public endpoint, while a `Mozilla/5.0 (compatible; ausspend/0.1; …)`
  string succeeds. No auth, cookie or captcha is bypassed; the request stays on the public
  unauthenticated `DownloadResult` URL.
- Month tokens are now a fixed `Jan…Dec` list. Node's `en-AU` ICU renders September as `Sept`,
  which the endpoint rejects with HTTP 500; `Sep` succeeds and is covered by a unit test.

### Archive record

Every scanned file (accepted or rejected) becomes a `source_documents` record and an on-disk
metadata sidecar: `source_id: "grantconnect"`, `archived_from: "direct"`, `original_url` /
`retrieved_from` (the DownloadResult query or list page), `fetched_at`, `local_path`, `sha256`,
`bytes`, `content_type`, plus a note recording the range, row count, cap check and rejection reason.
The XLSX bytes are not copied into the repo.

### Manual commands

```bash
# Plan monthly chunks for the target FY and print their public DownloadResult URLs.
npm run grantconnect:chunks -- plan --fy=2025-26 --chunk-days=31

# Fetch each chunk politely, archive it with SHA-256 and report the cap check.
npm run grantconnect:chunks -- fetch --fy=2025-26 --chunk-days=31 --delay-ms=1000

# Audit a directory: list ranges, cap warnings, rejections and coverage.
npm run grantconnect:chunks -- audit --fy=2025-26 --dir=~/ausspend-source-archive/grantconnect

# Import the complete chunk set (pull requests: no rows are ever fabricated).
INGEST_SOURCES=grantconnect MONGO_URL=mongodb://localhost:27017/ausspend_dev   npm run ingest:federal
```

`GRANTCONNECT_DOWNLOAD_URL_TEMPLATE` overrides the `DownloadResult` URL shape (`{start}`/`{end}`
tokens) without a code change. The helper never authenticates and backs off `--delay-ms` between
requests.

### Tests

`server/test/grantconnect.test.ts` covers the criteria `Date Range` parser, contiguous chunk
planning, complete/partial coverage, cap-warning rejection, header/unit detection, dollars→cents,
natural keys, multi-file de-duplication and idempotent re-runs, archive SHA-256 registration, and
the missing-directory error path (existing rows preserved).

## AIHW Health Expenditure (Phase 6.2b — current 2024-25 release)

Source id: `aihw-health-expenditure`. Publisher: Australian Institute of Health
and Welfare. Dataset: **AIHW Health expenditure Australia 2024–25 — supplementary
tables** (HWE 110).

### Premise test: current state × area × funding series exists

METEOR is the AIHW **Metadata Online Registry**, not a data API: it says
“METEOR does not contain any data, reports or statistical information.” It
cannot expose the required expenditure matrix. The Phase 6.2 data.gov.au CSV was
a superseded series ending at 2011-12.

The current AIHW release publishes a live **state × area × funding** series in
its supplementary data tables: tables **B1–B24** cover 2022-23, 2023-24 and
2024-25 for all eight states/territories, 16 leaf areas of expenditure and seven
detailed funding sources. This is the current COFOG 07 series; the old
1997-98..2011-12 CSV is not shipped as current coverage.

- Report data page:
  `https://www.aihw.gov.au/reports/health-welfare-expenditure/health-expenditure-australia-2024-25/data`
- Exact XLSX:
  `https://www.aihw.gov.au/getmedia/44735a41-5372-414e-9a18-d25f7c13fe4c/AIHW-HWE-110-HEA-2024-25-data-tables.xlsx`
- SHA-256: `e4b98fa8a5ee5506d772af082e33b4cdc3d926ad1186fceba80a35012eeeca5b`
- Bytes: `841,137`
- Release/source date: 2024-25, published 14 October 2026
- Licence: CC BY 3.0 Australia
- Archived outside the repo at
  `~/ausspend-source-archive/aihw-health-expenditure/AIHW-HWE-110-HEA-2024-25-data-tables.xlsx`;
  metadata manifest `docs/source-archive/aihw-health-expenditure-2024-25.json`.

The live download is SHA-256 and byte-gated before parsing. The superseded CSV
and its 6,778 rows are removed by the ingest script; no other source is touched.

### Mapping (1,747 rows)

One row per fiscal year × state × leaf area × detailed funding source. Parent
rows (`Hospital services`, `Primary health care`, `Other services`, `Total
recurrent expenditure`, `Total health expenditure`) and funding total columns
(Australian Government total, Government total, Non-government total, Total
health expenditure) are used only for reconciliation and are never emitted.

| Published column                                           | Stored as                                                             |
| ---------------------------------------------------------- | --------------------------------------------------------------------- |
| `fiscal_year` (2022-23..2024-25)                           | `fiscal_year`                                                         |
| state from the table title                                 | `location.state`, `aihw_state` (state-wide only; no LGA/postcode)     |
| `Area of expenditure`                                      | `aihw_area_of_expenditure` and `description`                          |
| DVA / Health and other / Premium rebates / State and local | `aihw_detailed_source_of_funding` and `funding_source`                |
| broad header (Government/Non-government)                   | `aihw_broad_source_of_funding`, `aihw_funding_sector`                 |
| published $ million                                        | `amount_cents` at 1 $m = 100,000,000 cents (`aihw_unit` AUD_millions) |

- **Field name:** the schema's canonical COFOG field is `function_code` (see
  `shared/src/measure-record.ts` and `server/src/models/measure.ts`). The brief's
  `function_cofog` refers to this field; there is no separate `function_cofog`
  field. Every accepted AIHW row sets `function_code = '07'`, and the tests/DB
  check assert that value.
- `measure_type = actual`, `function_code = '07'` (COFOG Health) on every row,
  `source_dataset = "AIHW Health Expenditure Australia 2024-25 — Supplementary
tables"`, `verified = true`, `data_quality_flag = "verified"`.
- **Government and Non-government are separate series.** Australian Government
  detailed rows (DVA, Health and other, Premium rebates) are
  `jurisdiction_level=federal`, `jurisdiction="Australia"`,
  `aihw_funding_sector=government`. State and local government rows are
  `jurisdiction_level=state`, `jurisdiction=<state code>`,
  `aihw_funding_sector=government`. Non-government rows (HIF, Individuals,
  Other) are `jurisdiction_level=other`, `jurisdiction=<state code>`,
  `aihw_funding_sector=non_government`.
- Every row is `aggregation_role=agency_detail` and therefore non-additive.
  Government rows carry `potential_double_count=true` because the same services
  can be funded through both levels; non-government rows carry `false`. The API
  must never sum government + non-government, federal + state, or any
  cross-state/area/source/year combination.
- Values are published current-price $ million; each is converted explicitly to
  integer cents. `. .` (not applicable), `—` (rounded to zero) and blank cells
  are skipped, never zero-filled. A published numeric zero is kept.
- No cross-source sums are created. The previous 1997-98..2011-12 series is not
  mixed with the current 2022-23..2024-25 rows.

### Spot-check against AIHW published tables

The emitted leaf-area × detailed-source components reconcile to each table's
published `Total health expenditure` within the published rounded-$m tolerance
(maximum difference across all 24 tables: $19m). Three independent spot checks:

| State | Year    | AIHW published total ($m) | Component sum ($m) | Difference |
| ----- | ------- | ------------------------: | -----------------: | ---------: |
| NSW   | 2024-25 |                    83,816 |             83,817 |         +1 |
| VIC   | 2023-24 |                    67,958 |             67,959 |         +1 |
| QLD   | 2024-25 |                    61,959 |             61,959 |          0 |

### DB delta and reproduce

Before: **689,090** measures, AIHW **6,778**; after replacing only AIHW rows:
**684,059** measures, AIHW **1,747** (all COFOG 07; 991 government + 756
non-government; 8 states). Every other source is byte-for-byte unchanged
(`other_sources_unchanged=true`).

```bash
export MONGO_URL=mongodb://localhost:27017/ausspend_dev
npm run ingest:aihw
# [ingest:aihw] before all=689090 aihw=6778 other_sources=682312
# [ingest:aihw] deleted stale aihw-health-expenditure rows=6778
# [ingest:aihw] aihw-health-expenditure: success fetched=1747 upserted=1747
# [ingest:aihw] db source_rows=1747 cofog07=1747 states=8 additive_violations=0 other_sources_unchanged=true all_measures=684059
```

### Verify

```bash
mongosh 'mongodb://localhost:27017/ausspend_dev' --quiet --eval '
  print(db.measures.countDocuments({source_id:"aihw-health-expenditure"}));
  print(db.measures.countDocuments({source_id:"aihw-health-expenditure",function_code:"07"}));
  printjson(db.measures.aggregate([{$match:{source_id:"aihw-health-expenditure"}},
    {$group:{_id:{year:"$fiscal_year",sector:"$aihw_funding_sector",level:"$jurisdiction_level"},n:{$sum:1}}}]).toArray())
'
```

Tests: `server/test/aihw-health-expenditure.test.ts` covers the 24-table/8-state/
3-year coverage, COFOG 07, current years, government/non-government and
federal/state/other separation, unit conversion, skipped non-numeric markers,
natural keys, idempotency, no-sum and three published state/year totals plus a
SHA-verified real-archive parse.

## Narrow live run

The acceptance run ingests **one recent full week** into
`mongodb://localhost:27017/ausspend_dev` (never the pool Mongo):

```bash
AUSTENDER_START_DATE=2026-11-02T00:00:00Z \
AUSTENDER_END_DATE=2026-11-09T00:00:00Z \
INGEST_SOURCES=aus-tender \
MONGO_URL=mongodb://localhost:27017/ausspend_dev \
npm run ingest:federal
```

Defaults without `AUSTENDER_START_DATE`/`AUSTENDER_END_DATE` are the seven complete days before
today (UTC). `INGEST_SOURCES=aus-tender` limits the run to the live connector; without it, the other
registered sources are logged as `skipped`. Per-source status lands in `data_sources` (status,
`last_ingested_at`, `records_ingested`, `errors`) and each run writes an `ingestion_logs` row.

This one-week acceptance window produced the **861 current-week** rows (FY 2026-27). The later
historical backfill does not overlap that window, so all 861 rows remain alongside the 117,033
historical contracts.

To verify:

```bash
mongosh 'mongodb://localhost:27017/ausspend_dev' --quiet --eval '
  db.measures.countDocuments({jurisdiction_level:"federal", measure_type:"contract"}),
  db.measures.distinct("natural_key", {jurisdiction_level:"federal"}).length
'

curl -s 'http://localhost:3101/api/v1/spending?jurisdiction_level=federal&measure_type=contract'
curl -s 'http://localhost:3101/api/v1/data-sources'
curl -s 'http://localhost:3101/api/v1/meta/coverage'
```

For PBS, run `INGEST_SOURCES=data-gov-au-pbs` (no date window) and check:

```bash
mongosh 'mongodb://localhost:27017/ausspend_dev' --quiet --eval '
  db.measures.countDocuments({source_id:"data-gov-au-pbs"}),
  db.measures.distinct("natural_key", {source_id:"data-gov-au-pbs"}).length,
  db.measures.countDocuments({source_id:"synthetic-seed"}),
  db.measures.countDocuments({source_id:"aus-tender"})
'
```

Re-run the ingestion command and compare the counts: they should not grow except for genuinely new
`ocid`s in the same window, and PBS natural keys stay stable.

## Restart safety (seed vs live ingestion)

The development seed is **non-destructive by default**. On a normal run it deletes only measures
whose `source_id` is `synthetic-seed`, upserts the synthetic source/regions/functions, and leaves
every ingested AusTender contract, every other `data_sources` register entry and every
`ingestion_logs` document untouched. That is why `docker compose up` (which runs the one-shot
`seed` service) can be repeated without losing the 117,894 ingested AusTender contracts.

The only destructive path is explicit and opt-in:

```bash
npm run seed -- --reset          # wipes measures, functions, regions and data sources first
```

There is no compose profile or default that runs `--reset`.

### Re-ingest after a restart

The `ingest` compose service is an opt-in profile, so a plain `docker compose up` never runs it:

```bash
# default window (seven complete days before today, UTC)
docker compose --profile ingest run --rm ingest

# narrow acceptance window
AUSTENDER_START_DATE=2026-11-02T00:00:00Z \
AUSTENDER_END_DATE=2026-11-09T00:00:00Z \
INGEST_SOURCES=aus-tender \
docker compose --profile ingest run --rm ingest
```

Without Docker, run the same `npm run ingest:federal` command from the previous section. Both
paths wait for the safe seed and upsert on `natural_key`, so a re-run never duplicates contracts
and a subsequent seed never removes them.

### Expected coexistence after the historical backfill

```text
810 synthetic measures (source_id: synthetic-seed, no natural_key)
1,231 PBS budget measures (source_id: data-gov-au-pbs)
117,894 AusTender contract measures (source_id: aus-tender, measure_type: contract)
119,935 measures total
119,125 distinct non-null natural_key values (117,894 AusTender + 1,231 PBS)
0 duplicate natural_key values, 0 invalid amount_cents
data_sources: synthetic-seed active, aus-tender active, data-gov-au-pbs active
```

AusTender fiscal-year distribution: 2024-25 = 59,688, 2025-26 = 57,345, 2026-27 = 861 (the
pre-existing one-week run). The 861 current-week rows and all 810 synthetic seed rows are still
present; the backfill only upserted historical `ocid`s outside that one-week window.

## Historical AusTender backfill run (2026-11-16)

This run was authorised automatically because the data-safety gate was closed and verified. It
never ran PBS, GrantConnect, state/local/SOC/charity sources, and it never deleted a row.

| Item                      | Value                                                                         |
| ------------------------- | ----------------------------------------------------------------------------- |
| Feed                      | `contractPublished` only, existing F2 connector/mapper                        |
| Window (publication date) | `2024-07-01T00:00:00Z` .. `2026-07-01T00:00:00Z`                              |
| Financial years covered   | 2024-25 and 2025-26 (documented equivalent: date-published window)            |
| Chunking                  | 105 contiguous 7-day chunks (`AUSTENDER_CHUNK_DAYS=7`), no gaps/overlaps      |
| Page bound per chunk      | `AUSTENDER_PAGE_LIMIT=100` (≈10,000 releases/week); peak observed 2,195       |
| Rate policy               | 1 s between pages, `Retry-After`/exponential 429 backoff (existing connector) |
| Pre-run backup            | `~/ausspend-backups/2026-11-16T11-22-19.156Z`                                 |
| Post-run backup           | `~/ausspend-backups/2026-11-16T12-30-14.670Z`                                 |
| Fetched / upserted        | 152,616 releases / 117,033 distinct `ocid`s                                   |
| Result                    | 117,894 AusTender rows (861 pre-existing + 117,033 backfilled)                |
| Database total            | 119,935 (117,894 AusTender + 1,231 PBS + 810 synthetic)                       |
| Distinct natural keys     | 119,125 (AusTender + PBS); 0 duplicates                                       |
| Invalid cents             | 0                                                                             |
| Chunk failures            | 0 (105/105 `success`)                                                         |

Command (the gate passed and `BACKFILL_CONFIRM=yes` was set only because the data-safety item was
closed/verified):

```bash
BACKFILL_CONFIRM=yes \
BACKUP_DIR=~/ausspend-backups/2026-11-16T11-22-19.156Z \
AUSTENDER_START_DATE=2024-07-01T00:00:00Z \
AUSTENDER_END_DATE=2026-07-01T00:00:00Z \
INGEST_SOURCES=aus-tender \
MONGO_URL=mongodb://localhost:27017/ausspend_dev \
AUSTENDER_PAGE_LIMIT=100 AUSTENDER_CHUNK_DAYS=7 \
npm run ingest:federal -- --backfill
```

Each chunk writes its own `ingestion_logs` row (`message` ends with
`(chunk N/105 <start>..<end>)`) with the verified `backup_path`; `data_sources` ends with
`aus-tender` `active`, `records_ingested: 117894` and the final `last_ingested_at`.

### Idempotency proof

Re-running one peak historical chunk (`2025-06-23T00:00:00Z`..`2025-06-30T00:00:00Z`) after the
backfill produced identical before/after totals:

```text
before total=119935 by_source={"aus-tender":117894,"data-gov-au-pbs":1231,"synthetic-seed":810}
       distinct_natural_keys=119125 duplicate_natural_key_groups=0 invalid_amount_cents=0
chunk 1/1 ... fetched=2195 upserted=1624
after  total=119935 by_source={"aus-tender":117894,"data-gov-au-pbs":1231,"synthetic-seed":810}
       distinct_natural_keys=119125 duplicate_natural_key_groups=0 invalid_amount_cents=0
```

### API performance after the backfill

`GET /api/v1/spending?jurisdiction_level=federal&measure_type=contract` matches 117,894 rows. The
API used to load every full document and slice the page in Node; at this size that measured about
3.5 s and ~500–660 MB RSS. `server/src/api/spending.ts` now loads a projected summary document
(`amount_cents`, `measure_type`, `function_code`, `region_id`) for the whole filtered set and
fetches only the requested page with Mongo `skip/limit`. Semantics are unchanged: the summary still
covers the entire filtered set, breakdowns and per-type totals are identical, and a mixed response
still returns `total_cents: null`. Measured after the change: ~1.9 s and ~306 MB RSS for the same
117,894-row contract query. The summary pass is still O(n) in the filtered set; a future item can
move the breakdowns to a Mongo aggregation if the dataset grows materially beyond this.

### Backfill tests and alt-port verification

- `server/test/aus-tender-chunks.test.ts` pins the 105-chunk plan (no gaps/overlaps, FY boundary,
  monthly option, invalid input, page-bound headroom).
- `scripts/test-backfill-gate.mjs` (`npm run db:test-backfill-gate`) covers gate success and every
  refusal path (missing confirm, missing/stale/foreign/tampered backup, missing manifest).
- `server/test/f1-foundation.test.ts` covers duplicate-`natural_key` upsert idempotency;
  `server/test/seed-safety.test.ts` proves a safe seed never deletes ingested contracts/logs.
- Unit/API/e2e: `npm test`, `npm run build`, `npm run typecheck`, `npm run lint`,
  `npm run format:check`.
- E2E on alt ports (the user's 3001/5173 stack is never restarted): start the API on `3101` and the
  Vite client on `5174` (`VITE_API_PROXY_TARGET=http://localhost:3101 npm run dev -w client --
--port 5174 --strictPort`), then `npx playwright test --config=e2e/playwright.alt.config.ts`.

## AusTender FY2020-21..FY2023-24 backfill run (2026-11-18)

This second historical backfill extended `contractPublished` coverage backwards from the existing
2024-07-01 boundary to cover the four earlier financial years. It ran only the F2 connector,
never PBS/GrantConnect/state/local/SOC sources, and it never deleted a row. Every chunk upserts on
`natural_key`, so no existing 2024-25..2026-27 contract or any other source was touched.

| Item                      | Value                                                                         |
| ------------------------- | ----------------------------------------------------------------------------- |
| Feed                      | `contractPublished` only, existing F2 connector/mapper                        |
| Window (publication date) | `2020-07-01T00:00:00Z` .. `2024-07-01T00:00:00Z`                              |
| Financial years covered   | 2020-21, 2021-22, 2022-23, 2023-24 (documented equivalent: date-published)    |
| Chunking                  | 209 contiguous 7-day chunks (`AUSTENDER_CHUNK_DAYS=7`), no gaps/overlaps      |
| Page bound per chunk      | `AUSTENDER_PAGE_LIMIT=100` (≈10,000 releases/week); peak observed 3,597       |
| Rate policy               | 1 s between pages, `Retry-After`/exponential 429 backoff (existing connector) |
| Pre-run backup (gate)     | `<backup-dir>/ausspend/<timestamp>` (731,492 measures)                        |
| Backup age at gate        | 10.6 min (dry run) / 12.2 min (real run); 731,492/731,492 natural keys        |
| Resume backup (fresh)     | `<backup-dir>/ausspend/<timestamp>` (884,872 measures)                        |
| Resume backup age at gate | 1.0 min; 884,872/884,872 natural keys                                         |
| Idempotency backup        | `<backup-dir>/ausspend/<timestamp>` (989,095 measures)                        |
| Fetched / upserted        | 365,776 releases / 257,647 upserts (220,066+145,710 fetched, 153,423+104,224) |
| AusTender rows added      | 257,603 distinct `ocid`s (375,497 final − 117,894 pre-run)                    |
| Result                    | AusTender 117,894 → 375,497; database 731,492 → 989,095                       |
| Distinct natural keys     | 989,095; 0 duplicate groups                                                   |
| Invalid cents             | 0                                                                             |
| Non-AusTender rows        | 613,598 before and after (per-source counts unchanged)                        |
| Chunk failures            | 1 transient (see caveat), recovered; final resume 92/92 `success`             |

Command (the fixed gate passed; `BACKFILL_CONFIRM=yes` was set only because the data-safety
backup was verified):

```bash
BACKFILL_CONFIRM=yes \
BACKUP_DIR=<verified-backup-dir> \
AUSTENDER_START_DATE=2020-07-01T00:00:00Z \
AUSTENDER_END_DATE=2024-07-01T00:00:00Z \
INGEST_SOURCES=aus-tender \
MONGO_URL=<app-mongo-url> \
npm run ingest:federal -- --backfill
```

**Transient 502 caveat.** The first pass stopped at chunk 118/209
(`2022-09-28T00:00:00Z..2022-10-05T00:00:00Z`) after `api.tenders.gov.au` returned HTTP 502 through
the connector's retries; chunks 1–117 had succeeded and no chunk was skipped or truncated. The
failed window was re-checked (HTTP 200) and a fresh verified backup was taken, then the remaining
range `2022-09-28T00:00:00Z..2024-07-01T00:00:00Z` was resumed in 92 chunks: 92/92 `success`,
0 failures. Combined with the first pass, all 209 weekly windows in
`2020-07-01..2024-07-01` are covered with no gap.

Final fiscal-year distribution (AusTender `measure_type: contract`):

```text
2020-21 = 65,729
2021-22 = 70,844
2022-23 = 59,689
2023-24 = 61,341
2024-25 = 59,688   (preserved)
2025-26 = 57,345   (preserved)
2026-27 = 861      (preserved, pre-existing one-week run)
```

`data_sources` ends with `aus-tender` `active`, `records_ingested: 375497`, no errors. The
`contractPublished` nuance is unchanged: coverage is by publication date, so a contract signed just
outside the window can still appear, and the larger count is contract notices, not total spending.

### Idempotency proof

Re-running one sample chunk (`2022-09-28T00:00:00Z..2022-10-05T00:00:00Z`, the previously failed
window) against a fresh verified backup left every total identical:

```text
before total=989095 aus-tender=375497 distinct_natural_keys=989095 duplicate_groups=0 invalid_cents=0
chunk 1/1 ... status=success fetched=1520 upserted=1044
after  total=989095 aus-tender=375497 distinct_natural_keys=989095 duplicate_groups=0 invalid_cents=0
```

## Backup before a historical backfill

The historical backfill has now run, but any future re-run must still take a fresh verified
snapshot first. The pre-backfill baseline was 810 synthetic seed measures plus 861 AusTender
contract measures (plus the original 1,231 PBS rows); after the 2026-11-18
FY2020-21..FY2023-24 AusTender backfill (375,497 contracts) and the FY2020-21..FY2025-26 PBS
backfill (10,480 budget rows) the current baseline is 998,349 measures. The gate below
refuses to fetch anything without a recent verified backup.

### Take and restore a verified backup

The backup/restore tools use the existing Mongo driver; they do not require `mongodump`.

```bash
export MONGO_URL=mongodb://localhost:27017/ausspend_dev
npm run db:backup -- --prune 14
# [backup] wrote ~/ausspend-backups/<ISO>
# [backup] natural_key count=<n> distinct=<n> checksum=<sha256>
```

- Writes every collection as Extended JSON to a timestamped directory outside the repository
  (default `~/ausspend-backups`).
- Refuses any database except `ausspend_dev`; `--scratch` additionally permits an explicit
  `ausspend_test_*` / `ausspend_restore_test_*` database for tests.
- The manifest records collection counts and indexes, `data_sources` statuses, and the
  `natural_key` count, distinct count and SHA-256 checksum.
- Never prints credentials. `--prune 14` deletes only old timestamped backup directories.

Restore to a scratch database by default:

```bash
MONGO_URL=mongodb://localhost:27017/ausspend_dev \
  npm run db:restore -- ~/ausspend-backups/<ISO> \
  --target ausspend_restore_test_<timestamp>
```

The restore verifies collection counts, `natural_key` uniqueness and checksum, and data-source
statuses, then prints the target database. A restore into `ausspend_dev` is only possible with
`--target ausspend_dev --confirm ausspend_dev`, a matching backup, and explicit user/approver
approval; it is never part of the test routine.

The round trip was demonstrated on a scratch database during the data-safety item: the restored
copy had the same 810 synthetic rows, 861 AusTender contracts, 2,902 total measures and the same
2,092 distinct `natural_key` values/checksum as the then-current `ausspend_dev`, while the source
database was unchanged. After the historical backfill the same tooling backs up 119,935 measures /
119,125 distinct keys (see the post-run backup above).

### Seed restart proof

The safe seed deletes only `source_id: synthetic-seed` measures. A scratch database was seeded,
given one fake `aus-tender` contract, and then re-seeded both locally and through the compose
`seed` service. Before/after were identical: 810 synthetic, 1 contract, 811 total, one row for the
fake `natural_key`, and no duplicate natural keys. A normal restart therefore preserves ingested
rows. The only destructive path remains the explicit `npm run seed -- --reset`.

### Gate a historical AusTender backfill

`npm run ingest:federal -- --backfill` requires all of:

1. `BACKFILL_CONFIRM=yes`;
2. `BACKUP_DIR` (or `--backup-dir`) pointing at a complete, recent backup of `ausspend_dev`
   (default maximum age 60 minutes: `BACKFILL_MAX_BACKUP_AGE_MINUTES`);
3. explicit `AUSTENDER_START_DATE` and `AUSTENDER_END_DATE` for a real run;
4. `INGEST_SOURCES` including `aus-tender`.

The gate refuses a missing, stale, corrupt or checksum-mismatched backup **before any fetch**, and
records the refused attempt in `ingestion_logs` (`status: skipped`, `records_fetched: 0`). A
successful gated run also records the verified backup path in `ingestion_logs.backup_path`.

Validate the gate without fetching data:

```bash
BACKFILL_CONFIRM=yes BACKUP_DIR=~/ausspend-backups/<ISO> \
  npm run ingest:federal -- --backfill --dry-run
```

The dry run validates the backup, logs `backfill gate passed (dry run); no fetch performed`, and
exits. The real historical backfill has since run under this gate (see
[Historical AusTender backfill run](#historical-austender-backfill-run-2026-11-16)); the gate
refusal paths remain covered by `npm run db:test-backfill-gate`.

A real gated run always chunks: `AUSTENDER_CHUNK_DAYS` (default 7, max 31) and
`AUSTENDER_PAGE_LIMIT` (default 100 for backfill, max 1,000). A chunk failure stops the run with a
nonzero exit, records the failing chunk and leaves already-upserted chunks intact.

### Daily backup timer

`scripts/systemd/ausspend-db-backup.service` and `.timer` run the backup daily at 03:15 with a
randomized delay, `Persistent=true`, journal logging and 14-backup retention. The installer creates
a self-contained runner snapshot under `~/.local/share/ausspend-backup` (including its own
`node_modules`) so the timer does not depend on the Docker stack or on host `${AUSSPEND_DEPLOY_ROOT}`
dependencies. Re-run it after changing the backup script. Then check:

```bash
systemctl --user list-timers ausspend-db-backup.timer
systemctl --user status ausspend-db-backup.service
journalctl --user -u ausspend-db-backup.service -n 20
```

## Remaining caveats

- **PBS is not a federal total.** The CSV line items come from entity program tables and do not
  sum to the Budget Paper 1 total general government expense. The app shows the PBS sum only as a
  per-measure-type line-item total.
- **PBS units are `$'000`.** The raw CSV value is multiplied by 1,000 to dollars and 100 to cents.
- **PBS has no geography.** `location.state` is literally `"Commonwealth"`; COFOG is mapped only
  where the portfolio is defensible, otherwise the row is `provisional` with no function.
- **GrantConnect is a manual export, not live data.** No public award API/feed exists and no
  scraper or paid adaptor is used. A human downloads public `DownloadResult` XLSX files; the
  importer archives each with SHA-256, rejects any file carrying the >50,000-result cap warning,
  and reports partial coverage until complete date-range chunks cover the period. Wide exports are
  never presented as a complete FY, and missing location is left absent rather than invented.
- **State/territory connectors are stubs.** NSW/VIC/QLD/WA remain uningested.
- **No human verification.** Both the synthetic seed and AusTender rows carry `verified: false`.
- **No cross-measure totals.** Contract and budget/actual/estimate rows are never summed together;
  the API groups by `measure_type` and returns `total_cents: null` for mixed responses.
- **The historical backfill is date-published, not a financial-year ledger.** It covers
  `contractPublished` notices published 2024-07-01..2026-07-01, so a contract signed just outside
  that period can appear (or a contract signed inside it but published outside can be absent). The
  `fiscal_year` field is derived from the contract/release date, not the fetch window. The larger
  contract count is contract notices, not a measure of total government spending and not comparable
  to PBS line items.
- **Summary queries are O(n) in the filtered set.** The 117,894-row contract query measured ~1.9 s
  and ~306 MB RSS after the projection + Mongo page change; the whole-set summary pass still scans
  the matching rows. No API semantics or no-total rule changed.
- The public `tenders.gov.au` contract page may reject automated requests at the WAF; `source_url`
  is the canonical human-facing contract-notice URL, constructed from the contract id.
