# NSW / local ingestion — S1: NSW Budget Open Data

**Scope of this item (S1).** This is the first state source only. It ingests the official
NSW Budget 2025-26 open-data workbooks and the NSW Treasury ArcGIS capital-projects layer.
It deliberately stops before `data.nsw.gov.au` CKAN, Dubbo, VIC, QLD, WA, SOC/charity and
the separate S3 PDF/source-archive foundation. Federal statuses are unchanged.

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
- Project count: **974** (verified with `returnCountOnly=true`, and the connector refuses any other count)
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

**Financial statements.** Sheets `GG Operating Statement`, `GG Balance Sheet`, `GG Cashflow
Statement`, `PNFC …`, `NFPS …`. The header row is found by the presence of `Actual`, `Budget` and
`Forward Estimates`; the year row is above it and the unit row below it. `Forward Estimates` is
forward-filled across its three year columns. Each row is emitted **once per financial-year
column**, never flattened into one record:

| Column header       | `measure_type`                                               |
| ------------------- | ------------------------------------------------------------ |
| `Actual`            | `actual`                                                     |
| `Revised`           | `estimate` (documented: a revised estimate is not an actual) |
| `Budget`            | `budget` (displayed as **Budgeted**)                         |
| `Forward Estimates` | `estimate`                                                   |

The sector sheet prefix maps to `delivery_entity` (`General government sector`, `Public
non-financial corporations`, `Non-financial public sector`); `funding_source` is `NSW Treasury`.
Balance-sheet date columns (` June 2024`, Excel serials such as `46174`) are normalised to
`2023-24` / `2025-26` etc.

**Historical fiscal indicators.** Sheets `Table D.1`–`D.3`. Only columns whose unit is `$b` are
ingested (`Revenue`, `Expenses`, `Budget Result`, `Capital Expenditure`, `GSP`). Percentage,
`% of GSP`, `% Growth` and index columns are not dollars and are not ingested. The financial year
is the row label in column A; years before 2025-26 are `actual`, 2025-26 is `budget`, later years
are `estimate` (forward estimates).

**Economy and performance/wellbeing workbooks.** The economy workbook and the nine
performance/wellbeing workbooks contain percentages, indices and counts, not dollar spending
series. They are discovered, downloaded, hashed and stream-parsed to prove they are valid XLSX,
but **no `amount_cents` is invented for them**. This is recorded as a connector warning.

**Capital projects.** Every ArcGIS feature becomes one `budget` measure for `2025-26` with
`amount_cents = Budget_Year_FY_2025_26_000 × 100000`, `delivery_entity = Agency_Name`,
`funding_source = Cluster_PNFC_Sector` (falling back to `Sector`), `location.state = "NSW"`,
`location.lga_name` only when present, and `data_quality_flag` `provisional` (LGA present) or
`statewide_only` (no LGA). `Project_name`, `Project_ID`, `Electorate`, `Region`, status and
category are kept in `project_name`/`description`/`notes`.

**Common fields.** `jurisdiction_level: "state"`, `jurisdiction: "NSW"`, `source_id:
"nsw-budget"`, `source_dataset: "NSW Budget 2025-26 Open Data"`, `verified: false`,
`source_url` = the open-data page (financial/HFI) or the ArcGIS layer (capital), and every row has
provenance in `notes` (workbook filename, sheet, row, column, unit, source copy reference).

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
[ingest:nsw] nsw-budget: success fetched=2526 upserted=2355
# second run, same DB
[ingest:nsw] nsw-budget: success fetched=2526 upserted=2355
db.measures.countDocuments({source_id:"nsw-budget"}) -> 2355
```

## 8. Counts and provenance shape

On the 2025-26 data: **2,526 raw cells/projects → 2,355 valid records**
(1,105 financial-statement cells + 447 HFI $b cells + 974 capital projects). 171 source cells were
skipped (negative net/deficit lines and non-dollar columns); they are logged as warnings, not
errors. The `nsw-budget` source ends `active` on success and `degraded` on failure; a failure keeps
the old rows because the runner only upserts and never deletes.

Federal counts before/after S1 are unchanged: **119,935 total = 117,894 AusTender + 1,231 PBS +
810 synthetic**. S1 adds only `source_id: "nsw-budget"` rows.

## 9. Known limitations

- **Budgeted, not spent.** Every NSW figure is a Budget/estimate/actual statement line item. The
  UI labels budget rows **Budgeted** and never presents them as actual/spent.
- The financial-statement workbooks include revenue, expense, balance-sheet and cash-flow lines.
  Their row values are not additive across line items or sectors; the API's per-type totals are
  only per measure type, and the UI must not present a sum across types.
- Negative net/deficit lines are skipped because `amount_cents` is non-negative.
- Economy/wellbeing workbooks are percentages/indices/counts and are not converted to dollars.
- Capital locations are only as good as the ArcGIS `LGA` field. Missing LGAs are `statewide_only`,
  never inferred. Electorate is in `notes`, not a fabricated LGA.
- The live page and live 2025-26 XLSX URLs have moved on; reproducibility depends on the Wayback
  snapshot and the archived hashes in the manifest.
- COFOG for capital projects is a conservative agency prefix map, flagged `provisional`.
- The 2026-06-22 ArcGIS layer is a later Treasury extract used for the 2025-26 budget field; the
  manifest records its source date and hash.

## 10. What this item stops before

S1 stops after the NSW Budget Open Data connector. It does **not** start:

- `data.nsw.gov.au` CKAN ingestion,
- Dubbo / local-government data,
- VIC, QLD or WA budget sources,
- SOC/charity sources,
- the separate S3 PDF/source-archive foundation.

The VIC/QLD/WA connectors remain stubs in `server/src/connectors/registry.ts`.
