# ACT Budget — Socrata infrastructure investment programme

Source id: `act-budget`. Publisher: ACT Government. Scope: **ACT only**, territory-wide; no local
government, school, project-location or postcode allocation.

## Source and archive

- Dataset page:
  <https://www.data.act.gov.au/d/Budget-2021-2022-Infrastructure-Investment-Program/8275-pg6z>
- Socrata resource API (paged):
  <https://www.data.act.gov.au/resource/8275-pg6z.json>
- Socrata view metadata:
  <https://www.data.act.gov.au/api/views/8275-pg6z.json>
- Dataset: **Budget 2021-2022 Infrastructure Investment Program**
- Source date: 2021-02-09 (`rowsUpdatedAt`)
- Licence: CC BY 3.0 Australia
- Extract archived outside the repo at
  `~/ausspend-source-archive/act-budget/act-budget-8275-pg6z.json`
  (286,895 bytes, SHA-256 `3c56f70422dadcac11dee10429f0c44bdbe87caba684a86689214e650c907529`).
- Metadata manifest: `docs/source-archive/act-budget-8275-pg6z.json`.

The connector calls the Socrata **resource API** with `$limit` / `$offset` (and
`$order=:id&$select=*,:id`), not a CSV download. It stops on a short page and caps the loop so an
API that ignores offsets cannot hang the run. The JSON extract is archived and not redistributed;
only derived budget rows are emitted.

## Coverage

- 424 projects, five fiscal years: 2021-22, 2022-23, 2023-24, 2024-25, 2025-26.
- **2,120 rows** (424 × 5), one per project × fiscal year.
- Dataset columns include project name, agency/directorate, project classification, project type,
  wellbeing domain/government priority, and five annual `Budgeted Financing ($'000)` columns plus
  `Total Budgeted Financing ($'000)`.
- `measure_type = budget` (budgeted capital-works financing, not actual expenditure).
- `jurisdiction_level = territory`, `jurisdiction = ACT`, `location.state = ACT`; no LGA/postcode.
- Rows are `aggregation_role = additive`, one project × year component each. The printed
  `Total Budgeted Financing` column is used only for reconciliation and is **never emitted**, so a
  project total is never summed with its own year components.

## Unit detection

The unit is detected from the published Socrata column names: every annual column is explicitly
`Budgeted Financing ($'000)`. The metadata check fails if the year columns are ambiguous. Values
are stored as `AUD_thousands` and converted at 100,000 cents per thousand. A source-date unit is
never inferred from individual magnitudes.

## Reconciliation

Every one of the 424 projects is checked: the sum of its five annual financing columns must equal
its printed `Total Budgeted Financing ($'000)` within one $'000 rounding unit.

- Checked projects: **424**
- Mismatches: **0**
- Paged rows fetched: 424 (one 1,000-row page; the paging loop is exercised by the unit test with
  a 25-row page size over 60 synthetic projects and stops after 3 pages).
- Emitted rows: 2,120.

## DB delta and reproduce

Before: **689,273** measures (source absent). After: **691,393** (+2,120 all `act-budget`); no
other source deleted or modified. All 2,120 rows are `territory` / `budget` / `additive`;
violations=0. A second run upserts the same 2,120 natural keys and leaves the DB at **691,393**.

Build note: the first verification run did not request Socrata's hidden `:id`, so 65 duplicate
project/directorate names collapsed on the natural key (2,055 rows). Those **ACT-only** rows were
removed and replaced with the corrected 2,120 rows after adding `:id` to the paging query and the
natural key. No other source row was deleted or modified; the other-source count remained 689,273.

```bash
export MONGO_URL=mongodb://10.10.10.30:27017/ausspend_dev
npm run ingest:act-budget
# [ingest:act-budget] act-budget: success fetched=2120 upserted=2120
# [ingest:act-budget] db source_rows=2120 violations=0 all_measures=691393
# [ingest:act-budget] by_year=2021-22=424,2022-23=424,2023-24=424,2024-25=424,2025-26=424
```

Checks: `npm run typecheck`, `npm run lint`, changed files pass Prettier, `npm test` (82 files,
901 passed, 2 skipped), `npm run build`, alt e2e on `3113/5184` (52 passed) and live alt audit on
`3113/5184` (38/38). Ports 3001/5173 and production nginx were not touched.

## Verify

```bash
mongosh 'mongodb://10.10.10.30:27017/ausspend_dev' --quiet --eval '
  print(db.measures.countDocuments({source_id:"act-budget"}));
  printjson(db.measures.aggregate([{$match:{source_id:"act-budget"}},
    {$group:{_id:{year:"$fiscal_year",level:"$jurisdiction_level",type:"$measure_type"},n:{$sum:1}}},
    {$sort:{"_id.year":1}}]).toArray());
'
# 2120
# 424 rows per year, all territory/budget
```
