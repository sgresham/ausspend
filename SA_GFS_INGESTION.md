# SA State Government Finance Statistics — GFS expenses by function and economic type

Source id: `sa-budget-gfs`. Publisher: South Australian Department of Treasury and Finance
(data.sa.gov.au CKAN). Scope: **SA state general government sector only**, statewide; no SA local
government, agency, project or LGA allocation.

## Source and archive

- data.sa package:
  <https://data.sa.gov.au/data/dataset/general-government-sector-expenses-by-function-and-by-economic-type>
- Exact resource:
  <https://data.sa.gov.au/data/dataset/e77f59d9-3df9-43ad-acf0-b7f8928ee827/resource/3f756590-9e67-4a05-97a0-f594247d2c72/download/cusersdellak01desktopgpc-by-etf-2015-16-to-2012-13.xlsx>
- SHA-256: `91d101229068313af2a43a7b00f2a267c960592a28d34681e91bab96283f9768`
- Bytes: `84,878`
- Licence: CC BY 4.0 (`license_id: cc-by`, `license_url: http://creativecommons.org/licenses/by/4.0`)
- Archived outside the repo at
  `~/ausspend-source-archive/sa-budget-gfs/cusersdellak01desktopgpc-by-etf-2015-16-to-2012-13.xlsx`.
- Metadata manifest: `docs/source-archive/sa-budget-gfs-2012-16.json`.

The workbook is fetched live, SHA-256/byte-gated, and archived outside the repo. It is not
redistributed; only derived rows are emitted.

## Coverage

Four financial years, one sheet per year. Each row is a Government Purpose Classification (GPC)
function; each column is an economic type (ETF), plus a printed `Total GPC` column and a printed
`TOTAL` row.

| Year      | Functions | Economic types | Emitted rows | Printed total ($'000) |
| --------- | --------: | -------------: | -----------: | --------------------: |
| 2012-13   |        64 |             18 |        1,034 |        16,281,673.671 |
| 2013-14   |        69 |             17 |        1,104 |        16,414,792.000 |
| 2014-15   |        69 |             17 |        1,104 |        16,738,007.800 |
| 2015-16   |        70 |             17 |        1,117 |        17,062,490.243 |
| **Total** |           |                |    **4,359** |                       |

## Unit detection

Values are whole thousands of dollars. The connector detects this from the printed grand total:
2015-16 is `17,062,490`, which is $17.06 billion at `$'000` (not a plausible whole-dollar SA
general government expense total). The unit is stored explicitly as `AUD_thousands` and converted
at `100,000` cents per thousand; unit inference is never based on individual magnitudes.

## GPC → COFOG mapping

GPC is Australia's government-purpose classification, based on COFOG but not identical. The
connector maps the GPC division (first two digits) explicitly:

| GPC division       | COFOG division | COFOG name                       |
| ------------------ | -------------- | -------------------------------- |
| 01                 | 01             | General public services          |
| 03                 | 03             | Public order and safety          |
| 04                 | 09             | Education                        |
| 05                 | 07             | Health                           |
| 06                 | 10             | Social protection                |
| 07                 | 06             | Housing and community amenities  |
| 08                 | 08             | Recreation, culture and religion |
| 09, 10, 11, 12, 13 | 04             | Economic affairs                 |
| 14                 | 01             | General public services          |

GPC `3450` (`Nominal superannuation interest expense`) has no valid COFOG division; it is a
non-COFOG memorandum item, is not published, and is retained only for year-total reconciliation.

Every emitted row has `function_code` in `01,02,03,04,05,06,07,08,09,10`; this data set produces
rows in `01,03,04,06,07,08,09,10` (no defence/environment rows in the SA GPC workbook).

## Measure type and row semantics

- `measure_type = actual` on every row. The workbook has no budget/actual column; it is the annual
  GFS **actual/outcome** matrix reported to the ABS. `sa_year_basis` records
  `GFS annual actual/outcome`.
- `jurisdiction_level = state`, `jurisdiction = SA`, `location.state = SA`, no LGA/postcode.
- `aggregation_role = agency_detail`; every row is one function × economic-type component.
  `Total GPC` columns and the printed `TOTAL` row are never emitted; no cross-function, cross-year
  or cross-source total is created.
- A few source rows print a function total that does not equal the sum of their detailed
  components (for example 2012-13 GPC 0541). The connector keeps the published components, records
  the variance as a warning, and reconciles the **year** against the printed function totals and
  the printed `TOTAL` row. It never forces a row total to match.
- Negative expense components are stored as non-negative magnitudes with `sa_printed_sign =
"negative"`.
- Provenance fields: `sa_gpc_code`, `sa_gpc_description`, `sa_economic_type_code`,
  `sa_economic_type_description`, `sa_unit`, `sa_year_basis`.

## Reconciliation

For each year, the sum of the printed function totals plus the excluded GPC 3450 memorandum total
equals the printed `TOTAL` row:

| Year    |            Function totals + 3450 ($'000) | Printed TOTAL ($'000) | Difference |
| ------- | ----------------------------------------: | --------------------: | ---------: |
| 2012-13 | 15,967,873.671 + 313,800 = 16,281,673.671 |        16,281,673.671 |          0 |
| 2013-14 |         15,947,092 + 467,700 = 16,414,792 |            16,414,792 |          0 |
| 2014-15 | 16,300,507.800 + 437,500 = 16,738,007.800 |        16,738,007.800 |          0 |
| 2015-16 | 16,660,990.056 + 401,500 = 17,062,490.056 |        17,062,490.243 |      0.187 |

The 2015-16 residual is published cent-level rounding within the `$'000` unit; tolerance is one
thousand dollars.

## DB delta and reproduce

Before: **684,914** measures (source absent). After: **689,273** (+4,359 all `sa-budget-gfs`); no
deletes, no other source changed. All 4,359 rows have a valid COFOG function and
`measure_type=actual`; `additive_violations=0`.

```bash
export MONGO_URL=mongodb://localhost:27017/ausspend_dev
npm run ingest:sa-gfs
# [ingest:sa-gfs] sa-budget-gfs: success fetched=4359 upserted=4359
# [ingest:sa-gfs] db source_rows=4359 cofog_rows=4359 additive_violations=0 all_measures=689273
# [ingest:sa-gfs] by_year=2012-13=1034,2013-14=1104,2014-15=1104,2015-16=1117
```

Checks run: `npm run typecheck`, `npm run lint`, changed files pass Prettier, `npm test` (81 files,
894 passed, 2 skipped), `npm run build`, alt e2e on `3111/5182` and live alt audit on
`3111/5182` (38/38). Ports 3001/5173 and production nginx were not touched.

## Verify

```bash
mongosh 'mongodb://localhost:27017/ausspend_dev' --quiet --eval '
  print(db.measures.countDocuments({source_id:"sa-budget-gfs"}));
  print(db.measures.countDocuments({source_id:"sa-budget-gfs",function_code:{$in:["01","02","03","04","05","06","07","08","09","10"]}}));
  printjson(db.measures.aggregate([{$match:{source_id:"sa-budget-gfs"}},
    {$group:{_id:{year:"$fiscal_year",cofog:"$function_code"},n:{$sum:1}}},{$sort:{"_id.year":1,"_id.cofog":1}}]).toArray());
'
```
