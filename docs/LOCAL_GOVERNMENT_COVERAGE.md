# Local government coverage

**Status as at 2026-11-18.** Phase 1 covers **Queensland** (`qld-local-government`); Phase 2 adds
**Western Australia** (`wa-mycouncil`). TAS/VIC/SA/NT are not added; the runner has an explicit
priority-order extension point for them.

## QLD — source and package

- source id: `qld-local-government` (existing; not duplicated)
- package: <https://www.data.qld.gov.au/dataset/queensland-local-government-comparative-information-report>
- CKAN package id: `queensland-local-government-comparative-information-report`
- publisher: Queensland Department of Local Government, Water and Volunteers
- licence: Creative Commons Attribution 4.0 International (CC BY 4.0)
- package metadata modified: **2025-06-12**; every CSV resource last modified **2022-11-25**
- archive root: `/home/steve/ausspend-source-archive/qld-local-government` (outside the repo)
- no duplicate QLD source and no `qld-qgip` rows are touched.

## Package audit (12 resources)

Row/council counts are the printed CSV rows and distinct council labels found in the downloaded
resources. "Valid councils" for ingested resources are the council labels that survive the
`Local Government`/`Council Name` + financial-year checks.

| Resource                                     | Format |   Rows |                               Council labels | Years                   | Published unit/measure                                    | This phase                                                                                                              |
| -------------------------------------------- | ------ | -----: | -------------------------------------------: | ----------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Financial Inputs**                         | CSV    |    402 |                                           77 | FY2010-11–FY2015-16 (6) | `$'000`; income, expense, interest, balance-sheet columns | **Ingested**: 30 financial measures → 8,026 rows                                                                        |
| **Road Data**                                | CSV    |    408 |                                78 (77 valid) | FY2010-11–FY2015-16 (6) | km, counts, m² and `$'000` expenditure                    | **Ingested**: 10 `$'000` expenditure/depreciation measures → 3,295 rows; non-financial and asset-value columns excluded |
| General Rate Data                            | CSV    | 14,580 | 122 labels (category rows, not 122 councils) | FY2010-11–FY2016-17 (7) | cents in the `$`; minimum general rate `$`                | Not ingested: rating policy, not council spending                                                                       |
| Personnel data                               | CSV    |    402 |                                           78 | FY2010-11–FY2015-16 (6) | FTE counts, hours worked/lost                             | Not ingested: non-spending                                                                                              |
| Rate revenue                                 | CSV    |    402 |                                           78 | FY2010-11–FY2015-16 (6) | `$'000` revenue components                                | Not ingested this phase; future financial-input candidate                                                               |
| Residential rating data                      | CSV    |  1,633 |                                           67 | FY2010-11–FY2016-17 (7) | `$` per property                                          | Not ingested: rates notices, not council spending                                                                       |
| Separate and Special rates                   | CSV    |  2,258 |                                           60 | FY2011-12–FY2016-17 (6) | amount rated per property (no explicit `$'000` unit)      | Not ingested                                                                                                            |
| Trade waste                                  | CSV    |    931 |                                           44 | FY2011-12–FY2016-17 (6) | categories/basis; no dollar amounts                       | Not ingested: non-financial                                                                                             |
| Waste services                               | CSV    |    402 |                                           78 | FY2010-11–FY2015-16 (6) | `$'000` collection cost plus counts/tonnes                | Not ingested this phase; future financial-input candidate                                                               |
| Water and sewer charges                      | CSV    |  2,813 |                                           77 | FY2010-11–FY2016-17 (7) | `$` charges and kl allowances                             | Not ingested this phase                                                                                                 |
| Local government water and sewer connections | CSV    |    461 |                                           78 | FY2009-10–FY2015-16 (7) | connection counts                                         | Not ingested: non-spending                                                                                              |
| Explanatory Notes                            | DOCX   |      — |                                            — | —                       | definitions                                               | Reference only; not ingested                                                                                            |

No newer QLD comparative years are present in the package. FY2016-17 appears in some rating and
charge resources but **not** in Financial Inputs or Road Data; FY2016-17+ financial/road coverage is
a documented gap, not reconstructed from another source.

## Source and unit decisions

### Financial Inputs

- Every printed `$'000` column is a separate, non-additive council-year measure.
- Existing four measure keys are preserved exactly:
  `total_operating_expenses`, `employee_expenses`, `depreciation_amortisation`,
  `interest_paid_borrowing_costs`.
- Added 26 measures covering net rates/utility charges, total operating income, unfunded
  depreciation, total operating expenses excluding depreciation, QTC/other interest and
  repayments, finance leases, cash/deposits, receivables, current assets, PP&E additions, capital
  works in progress, current/non-current interest-bearing liabilities, total current liabilities,
  community equity, total borrowings and councillor remuneration.
- Old/new printed label variants are handled explicitly:
  - total operating expenses old label → new `from 2013/14` label;
  - total operating expenses excluding depreciation old → new label;
  - councillor remuneration old → net-of-capitalised-expenses new label.
- Existing reconciliation is retained: employee + depreciation + total interest must not exceed the
  printed total operating expenses; the QTC + other interest split must not exceed total interest.
  No equality is forced where the source prints a total with other omitted components.
- `measure_type: "actual"`, `data_quality_flag: "provisional"`, `aggregation_role: "agency_detail"`.

### Road Data

- Ingested only the printed `$'000` expenditure/depreciation columns:
  - capital renewal on existing roads;
  - capital upgrade on existing roads;
  - capital expansion on new roads;
  - total capital expenditure on roads;
  - total maintenance expenditure on roads;
  - expenditure on existing bridges and major culverts;
  - capital expenditure on new bridges and major culverts;
  - total expenditure — bridges and culverts;
  - depreciation expense for roads;
  - total expenditure — roads, bridges and major culverts.
- **Excluded**: linear kilometres, traffic-band kilometres, bridge counts, decking area, culvert
  counts, floodway area, current replacement cost, written-down value and the year last
  revalued. Those are physical attributes or asset-stock values, not spending; no count is
  relabelled as a dollar amount.
- The component columns carry `qld_lg_component_of` for the printed totals they belong to
  (capital components → total capital; bridge/culvert components → total bridges/culverts), but
  no component is added to a total by the connector. Some published rows have missing components,
  so no equality check is imposed on Road Data totals.
- `measure_type: "actual"`, `data_quality_flag: "provisional"`, `aggregation_role: "agency_detail"`.

## Row mapping and provenance

Every row has:

- `source_id: "qld-local-government"`
- `jurisdiction_level: "local"`, `jurisdiction: "QLD"`
- `delivery_entity` and `location.lga_name` = the published council name
- `location.state: "QLD"`
- `measure_type: "actual"`
- integer cents after `$'000` × 100,000 conversion
- `source_dataset` = Financial Inputs or Road Data dataset
- `source_url` = the exact CKAN resource URL
- `notes` = unit, printed column, component/total relationship and non-additivity caveat
- `category` = stable measure key (`employee_expenses`, `road_capital_renewal_expenditure`, …);
  the four original financial measures also retain `qld_lg_measure` for compatibility.
- natural key = `qld-local-government:` + SHA-256 of `council | fiscal_year | measure`, so the
  existing 1,590 keys are unchanged and Road Data keys cannot collide with financial-input keys.
- COFOG is blank: the published comparative CSV is not a COFOG-classified statement, so no
  function code is invented.

## Non-additivity and QGIP separation

- No cross-council, cross-year, cross-resource or cross-measure total is computed or stored.
- Every row is `agency_detail`; the API cannot add it to an additive spending total.
- `qld-qgip` is a separate state-to-local grants/procurement source. It is never duplicated into
  this source, and these council financial/road rows are never summed with QGIP.
- No state budget, ABS GFS, other council, or other state local-government source is touched.

## WA — MyCouncil actual expenditure and snapshot

- source id: `wa-mycouncil`
- service root: <https://prod-mycouncil-services.azurewebsites.net/data.svc/>
- metadata: <https://prod-mycouncil-services.azurewebsites.net/data.svc/$metadata> (45,290 B)
- public site: <https://mycouncil.wa.gov.au/>
- licence/caveat: **© Government of Western Australia — MyCouncil**. Controlled public financial
  snapshot, **not audited general-purpose financial statements**; not a whole-of-government
  open-data licence grant.
- archive root: `/home/steve/ausspend-source-archive/wa-mycouncil` (outside the repo)

### OData audit

`$metadata` exposes **29 entity sets**; the connector validates the required `vw_LG_Expenditure`
and `vw_LG_FinanceActuals` properties before reading pages.

| Entity set                              |   Rows | Councils | Years                    | Unit/measure                                                                        | This phase                                                              |
| --------------------------------------- | -----: | -------: | ------------------------ | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **vw_LG_Expenditure**                   | 24,196 |      139 | FY2010-11–FY2024-25 (15) | whole AUD; program expenditure, including a printed council `Total Expenditure` row | **Ingested**: 24,007 non-additive rows; 11 programs + Total Expenditure |
| **vw_LG_FinanceActuals**                |  1,813 |      140 | FY2012-13–FY2024-25 (13) | whole AUD; revenue/employee/asset snapshot                                          | **Ingested**: TotalRevenue + EmployeeCost where positive → 3,554 rows   |
| vw_LG_FinanceBudget                     |      — |        — | —                        | budget revenue                                                                      | **Not queried**; separate from actuals and from `wa-budget`             |
| vw_LG_GrantData                         |      — |        — | —                        | state grant amounts                                                                 | **Not queried**; never mixed with council actuals                       |
| vw_LG_List / vw_LG_Details / other sets |      — |        — | —                        | council/suburb/other data                                                           | Reference only; not ingested                                            |

The 189 `vw_LG_Expenditure` rows not emitted have no valid council/year/program or a negative
expenditure. The `vw_LG_FinanceActuals` zeros are treated as unavailable snapshot values, not
published zero-dollar actuals; only positive TotalRevenue/EmployeeCost values are emitted.

### Unit and spot-check

The OData fields are whole dollars. MyCouncil displays the same value with a `$` prefix; the
connector converts whole AUD ×100 to integer cents. Live spot-check for **Swan FY2024/25**:

- `vw_LG_Expenditure` Total Expenditure: **284,214,363** → `28,421,436,300` cents.
- MyCouncil `/Council/getExpenditureTableForCouncil/119` prints **$284,214,363** for the same
  council-year — exact match.

No COFOG mapping is invented: the MyCouncil `Program` labels are WA local-government program
areas, not COFOG, so `function_code` is left blank and rows are `provisional`.

### Paging, keys and separation

- OData paging uses `$select`, `$orderby`, `$top=1000` and `$skip`; live run used **25**
  expenditure pages and **2** finance pages.
- Natural key includes source + MyCouncil `LGId` + `fiscal_year` + program/line, so the same
  council/program in another year never collides.
- Every row has `jurisdiction_level: "local"`, `jurisdiction: "WA"`,
  `delivery_entity`/`location.lga_name` = council name, `location.state: "WA"`,
  `measure_type: "actual"`, `aggregation_role: "agency_detail"` and `verified: false`.
- No row is a cross-council total. `Total Expenditure` is a council-level printed row, not a
  statewide total.
- `wa-budget` remains the separate WA state budget source and was not touched. MyCouncil budget
  and grant sets were not queried.

### Verification (2026-11-18)

- Live fetch: 24,007 expenditure + 3,554 finance = **27,561** non-additive rows; 139 councils;
  FY2010-11–FY2024-25.
- Shared DB: all `measures` **703,210 → 730,771** (+27,561); `wa-mycouncil` 0 → 27,561;
  `qld-local-government` **11,321** unchanged; `qld-qgip` **200,387** unchanged;
  `wa-budget` **855** unchanged. Only new source: `wa-mycouncil`.
- Second run: counts unchanged, source rows still 27,561, all measures still 730,771.
- Archive: `metadata.xml` 45,290 B SHA-256
  `1432ce5a437298a62d3277e92fb230a3636cea4b155457e6dc527cfc1a15e210`;
  `records.json` SHA-256
  `3ad0bc966797938a3131b73c6f9391aec714c2177d9bc870487f0997cfd10dbe`.

## Ingestion

```bash
MONGO_URL=mongodb://localhost:27017/ausspend_dev npm run ingest:local-gov
# one source only:
MONGO_URL=... npx tsx scripts/ingest-local-gov.ts --source=qld-local-government
# dry run:
LOCAL_GOV_DRY_RUN=1 npm run ingest:local-gov
```

The runner order is `qld-local-government` → `wa-mycouncil`. The extension point for
TAS/VIC/SA/NT is `LOCAL_GOVERNMENT_SOURCES` in `scripts/ingest-local-gov.ts`; each future source
must also be registered in the connector registry and must have its own source id and non-additive
rules.

## Verification (2026-11-18)

- Live CKAN fetch and parse: Financial Inputs **8,026** rows / 77 councils / 6 years; Road Data
  **3,295** rows / 77 valid councils / 6 years; total **11,321** rows.
- Shared DB: `qld-local-government` **1,590 → 11,321** (+9,731); all `measures` **693,479 →
  703,210** (+9,731, intended source only); `qld-qgip` **200,387** unchanged; only source whose
  count changed is `qld-local-government`.
- Existing 1,590 natural keys/amounts are unchanged (canonical digest
  `c64a986ca283d228864207b040d8d11e36ea6f297b788055e6e2fb783b2cea1e` before and after).
- Second run: no new rows, source count still 11,321, all-measures count still 703,210.
- Archive: `qld-local-government-financial-inputs.csv` 82,305 B SHA-256
  `6cc0ad90b34441992c3b4a9d75d6947436e306f7b41fa0d3379daa51cde75001`;
  `qld-local-government-road-data.csv` 83,903 B SHA-256
  `dc6225f2bb0bd6407a214ed60249aeffbf69cb70830622f689da43a94c9b1786`.
  Both are archived outside the repo with `.meta.json` files and source records.
