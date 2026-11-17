# Data granularity audit — available vs ingested detail

**Status: read-only planning audit (2026-11-17).** No ingestion was run, no schema/code/API change
was made and no database write was performed. This document maps, for every active source, what
detail the app stores today against what the publisher actually makes available and what is
inherently aggregate. A separate execution note for P1 (QGIP earlier years) was added below; the
audit body otherwise remains the pre-P1 snapshot described in the next paragraph.

Snapshot database: `mongodb://10.10.10.30:27017/ausspend_dev`, **348,981 measures, 0 synthetic
rows, 15 active data sources, 58 archived source documents**. Hunter Water landed before this audit
(6 rows), so the earlier 348,975 baseline is now 348,981. The count was re-read after writing this
document and is unchanged.

The concern that the SOC rows do not show where spending breaks down is correct, but it is a
structural fact about state-owned-corporation annual reports, not a missing connector field. The SOC
layer is now **24 entity statement lines** (Sydney Water 10, WaterNSW 8, Hunter Water 6). Those are
audited entity totals for revenue, expenses, selected expense components and government grants; they
are not, and cannot be turned into, project or program spending rows from the public statements. The
same distinction runs through the whole audit: some sources publish row-level transactions, some
publish only summary tables, and some are inherently aggregate benchmarks.

## Short recommendation

1. **Do not try to deepen the SOC layer into a spending breakdown.** Keep SOC as entity cards with
   the no-total rule. Only note-level components (employee, depreciation, finance, other) are
   potentially extractable, and they are already components of Total expenses, never additional
   spending.
2. **The best next detail is already row-level and just needs breadth.** QLD QGIP publishes
   payment-level CSVs for 2013-14 through 2024-25, but only 2024-25 was ingested at the audit
   snapshot (now superseded by the P1 section below); AusTender publishes
   multiple contracts and item classifications but only `contracts[0]` is mapped; QLD BP3 publishes
   total estimated cost and expenditure to date but only the 2026-27 budget column is stored.
3. **Budget statements are summary data.** NSW/VIC COFOG, PBS program line items and QLD BP4
   measures are program/function summaries, not transactions. Deeper program/output detail exists in
   the source budget papers, but it must be reconciled to the published statement totals and kept
   non-additive where it overlaps.
4. **ABS GFS and ABS PNFC are benchmarks.** They can be presented as published cells; they cannot be
   decomposed below the official COFOG/level or jurisdiction/flow tables without inventing detail.

## P1 landed — QGIP earlier years (executed 2026-11-17)

The P1 breadth recommendation below was executed after this audit. `qld-qgip` now holds
**200,387 rows**: the original 34,000 for 2024-25 plus **166,387** for 2018-19..2023-24. One CSV
is ingested per fiscal year with its own `fiscal_year` and a per-year natural key (CKAN resource id

- row hash + year), so years cannot collide and a re-run is idempotent (the total was 515,407 both
  times; 2024-25 stayed 34,000 and no other source count changed). Ingested rows by year: 2018-19
  25,015; 2019-20 2,565; 2020-21 36,110; 2021-22 32,011; 2022-23 28,122; 2023-24 42,564. 2020-21 uses
  only the corrected "updated DTMR data" resource, never both published files. Per-year source row
  counts, rejected rows and SHA-256s are recorded in
  [`docs/source-archive/qld-qgip-2018-19-2023-24.json`](source-archive/qld-qgip-2018-19-2023-24.json).

**2019-20 is a partial-coverage year.** The publisher's 2019-20 file leaves `Financial year
expenditure` blank on 22,530 of its 27,308 rows, while most of those rows still carry a cumulative
total-to-date. That cumulative figure is not an annual payment, so it was not substituted or added:
only the 2,565 rows with a published annual payment were ingested, and every 2019-20 record carries
`data_quality_flag` ending `partial_year_source_gap`. The much lower 2019-20 total is therefore a
source gap, not a real spending fall. Licence is CC BY 4.0; units are whole AUD confirmed by the
archived Nov-2026 data dictionary; grants and contracts remain separate measure types and are never
summed, and years are never merged. The snapshot figures in the rest of this document describe the
pre-P1 audit (348,981 measures); the current baseline is **515,407**.

## P2 premise check — AusTender contract breadth (executed 2026-11-17, no ingestion)

**Licence resolved first.** AusTender's site footer states that, with the exception of the
Commonwealth Coat of Arms, Approach to Market (ATM) material and where otherwise noted, all materials
on AusTender are **CC BY 3.0 AU**. Contract notices are not ATM material. The connector now exposes
`AUS_TENDER_LICENSE = 'CC BY 3.0 AU'` and sets `license` on the registered source, so a future run
persists attributable terms instead of “Not yet verified”.

**Then the premise falsifier.** P2 assumes an OCDS release can carry multiple `contracts[]`, so
mapping only `contracts[0]` discards available breadth. That assumption was tested read-only against
the live `contractPublished` feed over the whole ingested window
(**2024-07-01T00:00:00Z .. 2026-11-09T00:00:00Z**, 123 weekly chunks, cursor-paged). The survey read
**173,209 releases** and found:

- **173,209 / 173,209 releases contain exactly one `contracts[]` object** (`{1: 173209}`); zero
  releases have 0 contracts and zero have more than one.
- Every contract carried an `id` and a `value.amount`; there were no missing ids, no missing values
  and no duplicate contract ids within a release.
- Contract ids are the published `CN…` numbers and are 1:1 with `ocid`. Repeated `ocid`s in the feed
  are versions/amendments of the same contract id, not additional contract objects.

Mapping “all `contracts[]`” therefore produces exactly the same rows as mapping `contracts[0]`; it
cannot grow the 117,894-row source. Re-keying the natural key from `ocid` to `ocid` + contract id
would also re-key every existing row and create 117,894 apparent duplicates on the next ingest, and
the brief forbids deletes. **Per the premise falsifier, no ingest was run and no rows were written.**
The `aus-tender` source stays at **117,894** rows and the database stays at **515,413** measures. If
AusTender later publishes genuine multi-contract releases, the connector needs an explicit key
migration and source-history decision before they are mapped.

Database counts read at the P2 check (all unchanged from the current baseline): `qld-qgip` 200,387;
`acnc-charity` 127,606; `aus-tender` 117,894; `grantconnect` 62,128; `data-nsw-ckan` 3,472;
`data-gov-au-pbs` 1,231; `nsw-budget` 1,115; `qld-budget` 1,051; `dubbo-council` 245; `abs-gfs` 169;
`waternsw` 47; `vic-budget` 28; `abs-gfs-pnfc` 18; `sydney-water` 10; `essential-energy` 6;
`hunter-water` 6. Total **515,413**.

## P3 landed — NSW ArcGIS project fields (executed 2026-11-17)

The 803 ArcGIS capital-project rows in `nsw-budget` now carry the published project metadata as
explicit structured fields instead of prose-only `notes`: `project_id`, `agency`, `sector`,
`cluster`, `electorate`, `region`, `lga`, `status`, `category` and `budget_year`. Every value is
copied deterministically from the published `Treasury_Project_Data_20260609_gdb` attributes;
`budget_year` is the published amount column's year (`2025-26`) and `fiscal_year` is unchanged.
Published placeholders (`n.a.`, blank, `null`, `not applicable`, `unknown`) and ambiguous
multi-value labels (`Various`) become absent rather than being guessed. In the live 803 projects
that leaves `project_id` absent on 23 rows (`(none)`), `electorate` on 244, `lga` on 243,
`region` on 266 (238 `Various`, 27 blank, one `Regionnotfound`); those absences are documented,
not filled. `location.lga_name`, `delivery_entity`, `funding_source` and `description` are kept for
backwards compatibility; a `Various` LGA is no longer copied into `location.lga_name` and those
rows carry `data_quality_flag = statewide_only`. **No amount, natural key, row count or measure
type changed**: the source stays at **1,115 rows** (803 projects + 312 statement lines) and the
database at **515,449** measures.

**Correction to the premise.** The 171 ArcGIS features that must stay unallocated are the features
whose `Budget_Year_FY_2025_26_000` is the literal string `n.a.` (171 of 974), not rows with
`Agency_Name = "Unallocated"`; the live layer has no such agency. Those 171 features are still
skipped, never zero-filled and never given an amount or an agency, so they remain metadata-only in
the source layer and cannot enter any total. The 803 priced projects are unaffected. The 312
statement rows keep all ten project fields absent (null), because a sector-level statement line is
not a project; no value is inferred.

These fields are dimensions, never measures. Sectors and agencies are not additive (the same
project's dollars can be grouped by either), and the project amount is a **capital budget**, not
recurrent expense. Do not sum the 803 project rows with the 312 statement rows, across sectors or
across measure types.

After SOC phase 6 (Forestry Corporation of NSW, 7 new rows) the baseline was **515,420**
measures and **76 SOC rows**; `forestry-corporation` contributed 7 rows and every per-source count
above was unchanged (no deletes).

After SOC phase 7 (Landcom, 6 new rows) the current baseline is **515,426** measures and **82 SOC
rows**; `landcom` contributes 6 rows (total revenue 277,187, total expenses 213,995, employee
29,737, depreciation/amortisation 3,040, grant income 2,285 and net result 44,233 $’000) and every
per-source count above is unchanged (no deletes). The original 515,420 measures are all preserved;
Landcom adds six provisional, unverified rows.

After SOC phase 8 (Port Authority of NSW, 5 new rows) the current baseline is **515,431** measures
and **87 SOC rows**; `port-authority-nsw` contributes 5 rows (total revenue 238,254, total expenses
190,953, employee 96,061, depreciation/amortisation 21,650 and net result 36,295 $’000) and every
per-source count above is unchanged (no deletes). The 515,426 measures before this phase are all
preserved; Port Authority of NSW adds five provisional, unverified rows. It separately discloses no
government grants/contributions, so no grant row is emitted (never estimated or zero-filled).

After SOC phase 9 (TAHE, 6 new rows) the current baseline is **515,437** measures and **93 SOC
rows**; `tahe` contributes 6 rows (total revenue 20,143,940, total expenses 1,722,046, employee
10,507, depreciation/amortisation 1,334,576, government grants/contributions 1,269,799 and net
result 18,421,894 $’000) and every per-source count above is unchanged (no deletes). The 515,431
measures before this phase are all preserved; TAHE adds six provisional, unverified rows. Its
separately disclosed Grants and contributions line is flagged potential double count. The FY2023-24
result is dominated by a $17.8bn valuation increment and a grants-recognition change, so it is not
comparable with prior years.

After SOC phase 10 (Sydney Trains, 6 new rows) the current baseline is **515,443** measures and **99
SOC rows**; `sydney-trains` contributes 6 rows (total revenue 1,759,052, total expenses 5,376,430,
employee 1,997,053, depreciation/amortisation 321,716, government grants/contributions 3,500,212 and
net result -128,277 $’000) and every per-source count above is unchanged (no deletes). The 515,437
measures before this phase are all preserved; Sydney Trains adds six provisional, unverified rows.
Its separately disclosed Grants and contributions line is flagged potential double count. Total
revenue excludes grants (presented below the deficit line); Total expenses is the printed “Total
expenses excluding losses” subtotal, with the below-the-line gains/losses included only in the
net-result bridge. The published Volume 2 PDF carries a “Draft for year end June 2025” footer
alongside its signed declarations; that provenance caveat is recorded and two lines are flagged for
human spot-check.

After SOC phase 11 (NSW TrainLink, 6 new rows) the current baseline is **515,449** measures and **105
SOC rows**; `nsw-trainlink` contributes 6 rows (total revenue 97,080, total expenses 377,742,
employee 140,911, depreciation/amortisation 35,419, government grants/contributions 395,366 and
net result 113,817 $’000) and every per-source count above is unchanged (no deletes). The 515,443
measures before this phase are all preserved; NSW TrainLink adds six provisional, unverified rows.
Its separately disclosed Grants and contributions line is flagged potential double count. Total
revenue excludes grants (presented below the deficit line); Total expenses is the printed “Total
expenses excluding losses” subtotal, with the below-the-line gains/losses included only in the
net-result bridge. The report is branded NSW TrainLink but the audited statement is for the legal
entity NSW Trains; that provenance caveat is recorded and two lines are flagged for human
spot-check.

## Method and snapshot evidence

Read-only commands used (no write operations):

```bash
mongosh "mongodb://10.10.10.30:27017/ausspend_dev" --quiet --eval \
  'db.measures.countDocuments({})'
# 348981

mongosh "mongodb://10.10.10.30:27017/ausspend_dev" --quiet --eval \
  'db.measures.aggregate([{$group:{_id:"$source_id",n:{$sum:1}}},{$sort:{n:-1}}]).toArray()'
```

Source evidence was read from the connectors under `server/src/connectors`, the ingestion documents
([FEDERAL_INGESTION.md](../FEDERAL_INGESTION.md), [NSW_LOCAL_INGESTION.md](../NSW_LOCAL_INGESTION.md),
[PHASE4_INGESTION.md](../PHASE4_INGESTION.md), [SOC_INGESTION.md](../SOC_INGESTION.md),
[STATE_SOURCES.md](../STATE_SOURCES.md)), the committed archive manifests in
`docs/source-archive/`, and the official publisher pages cited in each section. No source page,
table or amount is inferred from a row count alone.

Role distribution in the snapshot: `additive` 34,963; `agency_detail` 32; `benchmark` 187;
`expense_total` 43,108; `expense_component` 84,498; `policy_measure` 108; no role 186,085.
Measure types: `actual` 128,000; `contract` 124,236; `grant_award` 89,786; `budget` 6,676;
`estimate` 283.

## Current DB state, by source

> **GPFS delta (2026-11-17):** +18 `actual` / `agency_detail` rows in `dubbo-council-gpfs`
> (Dubbo Regional Council, FY2024-25), reconciled exactly to the OLG totals; a second ingest run
> upserted the same 18 natural keys (idempotent). The first GPFS expansion then added +18
> `actual` / `agency_detail` rows in `city-of-sydney-gpfs` (City of Sydney, FY2024-25), reconciled
> exactly to its own printed Income Statement, B1-1 and comprehensive-income totals. The second
> GPFS expansion added +17 `actual` / `agency_detail` rows in `blacktown-gpfs` (Blacktown City
> Council, FY2024-25), reconciled exactly to its own printed Income Statement, B1-1 and
> comprehensive-income totals. The third GPFS expansion added +17 `actual` / `agency_detail` rows in
> `parramatta-gpfs` (City of Parramatta, FY2024-25), reconciled exactly to its own printed Income
> Statement, B1-1 and comprehensive-income totals. The source-by-source snapshot below is the
> pre-pilot baseline (**515,449**); the live `measures` total is **515,519** and no existing row
> changed. The pre-expansion baseline was **515,467**, then **515,485** after the City of Sydney
> GPFS and **515,502** after Blacktown.

| Source                |    Rows | Measure type(s)                      | Aggregation role(s)                            | Fiscal year(s)                              | Stored granularity and key dimensions                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --------------------- | ------: | ------------------------------------ | ---------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `aus-tender`          | 117,894 | contract                             | none (treated additive)                        | 2024-25, 2025-26, 2026-27                   | One row per OCDS release’s first contract; title/description, supplier, buyer, state, UNSPSC, contract dates, procurement method in notes. No function/category.                                                                                                                                                                                                                                                                                                       |
| `data-gov-au-pbs`     |   1,231 | budget                               | none (treated additive)                        | 2025-26                                     | One row per PBS program-expense line item; portfolio, agency, outcome, program, expense/appropriation type in notes; COFOG only where the portfolio is defensible (1,020/1,231); location literally `Commonwealth`.                                                                                                                                                                                                                                                    |
| `grantconnect`        |  62,128 | grant_award                          | none (treated additive)                        | 2025-26                                     | One row per `GA ID` award; recipient, agency, activity, publish date, value; category, GO ID, activity dates and aggregate flags in notes; no location or function.                                                                                                                                                                                                                                                                                                    |
| `nsw-budget`          |   1,115 | actual 173, budget 832, estimate 110 | none                                           | 2000-01 to 2028-29                          | 312 statement rows (GG/NFPS/PNFC Operating Statement and Table D/HFI expense lines) plus 803 ArcGIS capital projects with 2025-26 budget; project_id/agency/sector/cluster/electorate/region/lga/status/category/budget_year structured on all 803 projects (P3); 171 no-budget features stay metadata-only; function only on 657 rows (capital agency map).                                                                                                           |
| `data-nsw-ckan`       |   3,472 | budget 3,462, actual 10              | none                                           | 2014-15, 2015-16, 2016-17, 2018-19, 2025-26 | 2,211 school-level RAM allocations; 1,251 Budget Paper 2 capital allocations (2014-15 to 2016-17); 10 fleet-invoice rows. Project/agency/LGA; function 3,224 via agency map.                                                                                                                                                                                                                                                                                           |
| `dubbo-council`       |     245 | budget 72, estimate 173              | none                                           | 2025-26 to 2029-30                          | One council, fund-level Income and Expenditure Summary: 124 income lines, 91 expense lines, 30 capital categories; LGA `Dubbo`; 19 capital rows have COFOG. Income rows are not spending.                                                                                                                                                                                                                                                                              |
| `dubbo-council-gpfs`  |      18 | actual                               | agency_detail                                  | 2024-25                                     | Audited FY2024-25 GPFS line items: total revenue, total expenses, employee, depreciation/amortisation/impairment, operating and capital government grants, revenue/expense components and net result; printed `$'000`; no region/LGA; separate source from the 245 budget/estimate rows.                                                                                                                                                                               |
| `city-of-sydney-gpfs` |      18 | actual                               | agency_detail                                  | 2024-25                                     | Audited FY2024-25 GPFS line items: total revenue, total expenses, employee, depreciation/amortisation/impairment, operating and capital government grants, revenue/expense components and net result; printed `$'000`; no region/LGA; separate source; never summed with any other council or state rows.                                                                                                                                                              |
| `blacktown-gpfs`      |      17 | actual                               | agency_detail                                  | 2024-25                                     | Audited FY2024-25 GPFS line items: total revenue, total expenses, employee, depreciation/amortisation/impairment, operating and capital government grants, revenue/expense components and net result; printed `$'000`; no region/LGA; separate source; never summed with any other council or state rows. The printed negative before-capital result is kept in the reconciliation evidence only, because money is stored as non-negative cents.                       |
| `parramatta-gpfs`     |      17 | actual                               | agency_detail                                  | 2024-25                                     | Audited FY2024-25 GPFS line items: total revenue, total expenses, employee, depreciation/amortisation/impairment, operating and capital government grants, revenue/expense components, net loss on disposal and net result; printed `$'000`; no region/LGA; separate source; never summed with any other council or state rows. The printed negative before-capital result is kept in the reconciliation evidence only, because money is stored as non-negative cents. |
| `vic-budget`          |      28 | budget                               | additive 20, agency_detail 8                   | 2025-26, 2026-27                            | 20 COFOG-A general-government expense rows (10 functions × 2 budget years) plus 8 DTF departmental statement rows; statewide only.                                                                                                                                                                                                                                                                                                                                     |
| `qld-budget`          |   1,051 | budget                               | additive 943, policy_measure 108               | 2026-27                                     | 943 BP3 capital projects (project/agency/asset type/SA4) plus 108 BP4 non-additive budget measures; no COFOG; only the 2026-27 amount is stored.                                                                                                                                                                                                                                                                                                                       |
| `qld-qgip`            | 200,387 | grant_award 169,311, contract 31,076 | additive                                       | 2018-19 to 2024-25                          | One row per grant award or procured frontline-service payment, one CSV per year; recipient, ABN, funding agency, category, agreement dates, total-to-date and service location in notes; LGA structured where supplied; no function. 2019-20 is partial (publisher left the annual payment blank on 82% of rows) and flagged.                                                                                                                                          |
| `acnc-charity`        | 127,606 | actual                               | expense_total 43,108, expense_component 84,498 | 2022-23, 2023-24, 2024-25                   | One total-expenses row plus up to five component rows per charity-year; explicit expense category; approximate program-operating state/postcode; no function. 2024 AIS edition spans three fiscal years because charities report different periods.                                                                                                                                                                                                                    |
| `abs-gfs`             |     169 | actual                               | benchmark                                      | 2024-25                                     | Official COFOG-A expense cells for federal, state and local levels; function code on every row; no state field for the Commonwealth cells; no sub-state geography.                                                                                                                                                                                                                                                                                                     |
| `abs-gfs-pnfc`        |      18 | actual                               | benchmark                                      | 2024-25                                     | Nine jurisdictions × two flows (`revenue`, `expense`), totals only; no component lines, no COFOG, no location beyond jurisdiction.                                                                                                                                                                                                                                                                                                                                     |
| `sydney-water`        |      10 | actual                               | agency_detail                                  | 2024-25                                     | Entity statement lines: total revenue, other income, total expenses, employee, depreciation/amortisation, net result, four government-grant/contribution lines.                                                                                                                                                                                                                                                                                                        |
| `waternsw`            |       8 | actual                               | agency_detail                                  | 2024-25                                     | Entity statement lines: total revenue, total expenses, employee, depreciation/amortisation, net result, three government contribution/grant lines.                                                                                                                                                                                                                                                                                                                     |
| `hunter-water`        |       6 | actual                               | agency_detail                                  | 2024-25                                     | Entity statement lines: total revenue, total expenses, employee, depreciation/amortisation, net result, government grants and rebates.                                                                                                                                                                                                                                                                                                                                 |

`null`/absent `aggregation_role` on the transaction and budget sources is the existing model’s
“additive by convention” state; it does not mean those rows are comparable across sources or measure
types. The no-sum rules are listed in §4.

## Source-by-source detail

### Federal

#### `aus-tender` — 117,894 contract notices

- **In DB:** one row per OCDS release, built from `contracts[0]` only; `project_name` from
  `contracts[0].title`, `description`, supplier as `delivery_entity`, buyer as `funding_source`,
  contract/release date as `source_date` and fiscal year, supplier/buyer state, UNSPSC codes from
  `contract.items[].classification`, contract status/period/procurement method in `notes`. The
  contract value is `contracts[0].value.amount` in decimal dollars, stored as integer cents.
  `natural_key = ocid`. 116,948 rows have a title; 117,894 have a description and UNSPSC; 0 have a
  COFOG function or postcode/LGA/SA4.
- **Available at source:** the public OCDS API
  (`https://api.tenders.gov.au/ocds`, `GET /ocds/findByDates/contractPublished/{start}/{end}`) publishes
  release envelopes with `contracts[]`, `parties[]`, `tender` and item classifications. The current
  connector deliberately maps only the first contract in a release and uses items only to collect
  UNSPSC codes. See `FEDERAL_INGESTION.md` (“Mapping (critical)”) and the connector header in
  `server/src/connectors/aus-tender.ts`.
- **Granularity:** already **row-level/contract-level** (a contract notice), not annual spend.
  Contract values can span multiple years and are not the same as cash spent in the fiscal year;
  the backfill caveat in `FEDERAL_INGESTION.md` says the historical run is date-published, not a
  financial-year ledger.
- **Deeper extraction:** **feasible, medium value.** First, map all `contracts[]` entries rather than
  only `contracts[0]`, with a deterministic natural key (`ocid` + contract id) and exact
  reconciliation to each contract’s own value. Second, extract item-level UNSPSC/description rows
  only where item values are published; item rows must be flagged non-additive to the contract total,
  because item sums may not equal the contract value and many items carry no value. Do not invent an
  annual split from a multi-year contract value.
- **Licence / ambiguity:** **Resolved 2026-11-17: CC BY 3.0 AU.** The AusTender site footer states
  that, except for the Commonwealth Coat of Arms, Approach to Market (ATM) material and where
  otherwise noted, all materials on AusTender are licensed under CC BY 3.0 AU; contract notices are
  not ATM material. Attribution: © Commonwealth of Australia (Department of Finance). The connector
  now carries `AUS_TENDER_LICENSE`. Contract values are not spending. A live survey found one
  contract per release, so there is no contract breadth to add — see the P2 premise check below.
  **Priority P2 — premise falsified, no ingestion.**

#### `data-gov-au-pbs` — 1,231 program-expense line items

- **In DB:** one row per CSV line item. `project_name` = program, `description` = outcome,
  `delivery_entity` = department/agency, `funding_source` = portfolio, `function_code` only where the
  portfolio maps defensibly (1,020/1,231), `location.state` = `Commonwealth`. `Expense_type`,
  `Appropriation_type`, `Source_document` and `Source_table` are preserved in `notes` only. Only the
  `2025-26` amount column is stored; the CSV also carries 2024-25 and 2026-27 through 2028-29.
- **Available at source:** the official data.gov.au dataset
  `4f025f38-0c70-45e2-8106-4c29a5e48637` publishes four resources: the PBS entity Excel tables ZIP,
  the Budget Paper No.1 tables ZIP, the Budget Paper No.4 tables ZIP, and the “2025-26 PBS Program
  Expenses Line Items” CSV. The dataset page lists the CSV columns as Portfolio, Department/Entity,
  Outcome, Program, Expense type, Appropriation type, Description, 2024-25, 2025-26, 2026-27,
  2027-28, 2028-29, Source document, Source table and URL. The Excel tables include Table 1.1 Entity
  Resource Statement, Table 1.2 Entity Budget Measures, Table 2.X.1 Budgeted Expenses for Outcome X,
  Table 2.X.2 Program Component Expenses and the departmental/administered financial statements.
  The official page explicitly warns that the line-item CSV totals do **not** equal the Budget
  Paper 1 total because of intra-entity charging, revaluations and grant-funded entities.
- **Granularity:** **program-line summary**, not transaction. The current row is more detailed than
  the COFOG/portfolio summary but less detailed than the Excel entity tables’ sub-totals, and it is
  not a federal total. Units are `$'000` in the referenced PBS tables; the CSV itself carries bare
  integers and no unit column.
- **Deeper extraction:** **feasible, high value for dimensions, medium for new rows.** First half:
  promote `expense_type`, `appropriation_type`, `outcome` and all published year columns to explicit
  structured dimensions (or a separate non-additive series), with each year’s measure type kept
  separate and no cross-year sum. Second half: parse the Excel Table 2.X.2 program-component and
  Table 1.1 resource-statement tables, reconciling every parsed table to its printed sub-total and
  flagging entity sub-totals non-additive to the CSV line items. Never sum CSV lines to “the federal
  total”.
- **Licence / ambiguity:** the official dataset page states **CC BY 4.0 International**, but the live
  source register says “Not yet verified — see connector metadata”. The register should be corrected
  to CC BY 4.0. Other ambiguity: COFOG is not published for every portfolio; 211 rows are properly
  left without a function. **Priority P5** (see Priority list).

#### `grantconnect` — 62,128 grant awards

- **In DB:** one row per `GA ID` award; recipient, agency, activity, publish date and `Value (AUD)`
  are structured. The 15-column export also contains `GO ID`, `Category`, `Start Date`, `End Date`,
  `One-off/Ad hoc`, `Aggregate Grant Award`, `Aggregate Reason`, `Number of Awards Aggregated` and
  `Last Updated`; those are currently written to `notes`, not fields. The export has no location
  column, so no location is stored or invented. `natural_key = grantconnect:<GA ID>`.
- **Available at source:** GrantConnect’s public grant-award list and `DownloadResult` XLSX exports
  (`https://www.grants.gov.au/Ga/ListResult`). `FEDERAL_INGESTION.md` records the verified 15-column
  layout and states there is no public award API/feed; the connector is a manual, SHA-256-archived
  chunk import. Coverage is complete for 2025-07-01..2026-06-30 (365/365 days, 19 files scanned, 17
  accepted, 2 rejected for the >50,000-result cap). The source is not a complete historical ledger.
- **Granularity:** **award-level**. There is no published sub-award/program-line breakdown in the
  export. The aggregate flag and number-of-awards-aggregated columns are the only hints that a row
  represents more than one underlying award.
- **Deeper extraction:** **limited to dimensions and history, not more granularity.** First half:
  expose the existing GO ID, category, activity dates, aggregate flag/reason and last-updated
  columns as structured fields; they are already in the file and require no new network access.
  Second half: extend complete chunk coverage to earlier periods, keeping the cap rule and reporting
  partial coverage honestly. There is no raw recipient address or ABN in the 15-column export, so
  location cannot be recovered from this source alone.
- **Licence / ambiguity:** the source-register/licence constant says **CC BY 4.0 International**;
  the grants.gov.au page footer currently displays **CC BY 3.0 AU**. That discrepancy is unresolved
  and should be recorded in the data-source card until reviewed. The >50,000-result cap is a real
  coverage constraint, not a temporary error. **Priority P9** (see Priority list).

### NSW and local government

> Council-level inventory and pilot plan: [NSW_COUNCILS.md](./NSW_COUNCILS.md). It records that the
> OLG _Your Council_ time-series covers all 128 general purpose councils but only at council-level
> summary/service-category granularity, and that no single official dataset provides GPFS
> statement-line detail for all councils. The 245 `dubbo-council` rows are 2026/27 budget/estimate
> lines, not GPFS actuals; council rows are never summed with state or federal rows.

> Victorian council inventory and pilot plan: [VIC_COUNCILS.md](./VIC_COUNCILS.md). It records that
> the VLGGC annual questionnaire (VGC1/ABS1/ABS2-3) covers all 79 Victorian councils at
> near-statement financial granularity — expenditure/revenue by function and nature, capital
> outlays, balance sheet and cash flow — but is council-supplied and unaudited. For Greater Bendigo
> FY2024-25 its income-statement and balance-sheet totals reconcile exactly to the audited GPFS;
> capital outlays differ by $473,353 and need a documented bridge. The LGPRF/Know Your Council data
> set covers all 79 councils but only with 59 performance indicators (CC BY 4.0), and no single
> official dataset publishes the audited GPFS for all 79. The 28 `vic-budget` rows are statewide
> state-budget rows, not council spending; council rows are never summed with state rows or with
> the ABS GFS local-government aggregate.

#### `nsw-budget` — 1,115 rows (312 statement lines + 803 capital projects)

- **In DB:** 312 rows from the 2025-26 financial-statements workbook (GG, NFPS and PNFC Operating
  Statement expense lines, plus Table D.1–D.4/HFI lines), with measure type mapped from the printed
  Actual/Revised/Budget/Forward-Estimates columns; 803 ArcGIS capital projects with a usable
  2025-26 budget, project name, agency, category/status/electorate/region/LGA and COFOG only where
  the agency map is defensible. Since P3 every project row also carries structured `project_id`,
  `agency`, `sector`, `cluster`, `electorate`, `region`, `lga`, `status`, `category` and
  `budget_year`; the statement rows leave those fields absent. 560 project rows carry a single
  usable LGA and 243 publish `VARIOUS` (multi-LGA), which stays absent. The 171 of the 974 ArcGIS
  features whose published `Budget_Year_FY_2025_26_000` is `n.a.` are skipped, not zero-filled and
  not allocated. Units: financial statements `$m`, HFI `$b`, capital `$'000`.
- **Available at source:** the 12 official 2025-26 XLSX workbooks (financial statements, historical
  fiscal indicators, economy, 8 performance/wellbeing workbooks) plus the ArcGIS
  `Treasury_Project_Data_20260609_gdb` layer, published from
  `https://www.budget.nsw.gov.au/budget-detail/open-data` and
  `https://services2.arcgis.com/Yb2UeNWvQYEwyYDl/arcgis/rest/services/Treasury_Project_Data_20260609_gdb/FeatureServer/0`.
  The manifest
  `docs/source-archive/nsw-budget-2025-26.json` records every file, URL and SHA-256. The live NSW
  Budget page has moved to 2026-27; reproducibility depends on the archived 14 November 2025 Wayback
  snapshot. The financial statements contain revenue, taxation, receipts, balance sheet and cash-flow
  lines; the connector deliberately ingests only Operating Statement expense lines and three HFI
  indicators. The ArcGIS layer also publishes project status, electorate, region, agency, sector,
  cluster and project category; P3 promoted all of those to structured fields.
- **Granularity:** **summary statement lines plus project-level capital**. The statement rows are
  sector-level published totals, not agency/program budgets. The 803 capital rows are project-level
  for one budget year, but only the 2025-26 budget amount is stored; the layer does not provide a
  full project cost series in the ingested field.
- **Deeper extraction:** **first half executed in P3 (no new dollar rows).** The ArcGIS
  status/electorate/region/sector/cluster/agency/category fields are now structured dimensions on
  the 803 project rows, and the 171 no-budget features remain metadata-only. Remaining: ingest the
  Budget Paper 2/3 agency/program statements from the official budget papers or the targeted
  data.nsw resources, reconciling each statement to the published operating total. Never add GG,
  PNFC and NFPS statement rows together; they overlap by construction. Do not treat capital budget
  as recurrent expense.
- **Licence / ambiguity:** NSW Budget open data is **CC BY 3.0 AU** per the archive manifest and
  attribution “© State of New South Wales (NSW Treasury), (2025)”. The current live page is a later
  budget; the 2025-26 page is an archived snapshot. COFOG for capital is a conservative agency map
  and remains provisional. **Priority P3** (see Priority list).

#### `data-nsw-ckan` — 3,472 rows across three selected datasets

- **In DB:** 2,211 school-level Resource Allocation Model (RAM) budget rows for 2025-26; 1,251 NSW
  Budget Paper 2 capital allocations (628 rows 2016-17, 431 2015-16, 192 2014-15); 10 fleet-vehicle
  actual rows for 2018-19. Project/school name, agency, LGA, amount and source resource are stored;
  3,224 rows have a COFOG function via the agency map; 855 have an LGA; the rest are statewide-only
  or missing.
- **Available at source:** the whole data.nsw.gov.au CKAN portal
  (`https://data.nsw.gov.au/data/`, the connector comment cites roughly 16,907 datasets) is
  deliberately **not** harvested. Nine targeted `package_search` queries feed a
  curated set: RAM school funding (CSV, explicit `$`), NSW Budget Paper 2 2016-17 Infrastructure
  Statement (DataStore, unit not stated; `$'000` assumed and provisional), and fleet-vehicle spend
  (XLSX, `$` from cell format). The media-expenditure 2024/2025 DOCX and a fleet PDF are recorded as
  deferred resources, not ingested. The manifest `docs/source-archive/data-nsw-ckan.json` records
  the discovery queries and selected resources.
- **Granularity:** **row-level for RAM and BP2 projects**, **actual invoice-level for fleet**. The
  school RAM allocation is one school-year allocation, not actual school spend; BP2 allocations are
  budgeted capital, not actual; fleet is historical actual reported spend. Unit handling is
  per-resource and one unit is not stated by CKAN metadata, so those rows are provisional.
- **Deeper extraction:** **feasible, medium value.** First half: ingest the deferred media-expenditure
  DOCX through the shared PDF/DOCX foundation and add any further targeted dataset only after
  checking unit, measure type and licence per dataset. Second half: extend the RAM/BP2 history where
  the portal publishes earlier editions. Do not harvest the whole portal; each dataset needs a
  mapping and a no-double-count decision. BP2 project allocations overlap the NSW capital budget
  source at the program level, so cross-source totals are invalid.
- **Licence / ambiguity:** the source register says “Creative Commons Attribution (per CKAN dataset
  metadata)”. That is a pointer, not a verified licence for every selected dataset; each dataset’s
  CKAN licence must be checked before publishing. Unit ambiguity on BP2 is already flagged
  (`$'000` assumed, all rows provisional). **Priority P7** (see Priority list).

#### `dubbo-council` — 245 rows, one council

- **In DB:** 245 rows from the adopted 2026/27 Budget and Forward Forecasts PDF: 124 income lines,
  91 expense summary lines and 30 capital-works category rows for the Consolidated, General, Water
  and Sewer funds. All rows carry `location.lga_name = Dubbo`; 19 capital rows have a COFOG code;
  others have no function. Units are `$'000` (unit thousands detected in the PDF header), and the
  connector rejects a section whose row/column totals do not reconcile.
- **Available at source:** the council’s published budget PDF
  (`https://www.dubbo.nsw.gov.au/ArticleDocuments/290/20262027%20Budget%20and%20Forecasts%20including%20Capital%20-%20Adopted.PDF.aspx`),
  archived with SHA-256. The PDF contains the fund-level Income and Expenditure Summary (page 2) and
  a Capital Expenditure section; the adapter reads those sections only. The source is one council,
  not a local-government dataset.
- **Granularity:** **fund-level summary**, not program/activity or project detail. The 124 income
  lines are **not spending** even though they are stored as measures with a positive amount; they
  must be filtered out of any spending view. The 91 expense lines are summary categories, and the 30
  capital rows are categories, not individual capital projects.
- **Deeper extraction:** **feasible, low-medium value, one council at a time.** First half: add an
  explicit section/flow field so income and expense rows cannot be mixed, and parse the published
  program/activity expense budgets if the PDF exposes them, reconciling to the fund totals. Second
  half: parse the individual capital project list with its own total reconciliation. Do not generalise
  the adapter to other councils; each council has a different layout.
- **Licence / ambiguity:** “© Dubbo Regional Council. Published council documents used here for
  public-interest research; not an open-data licence grant.” Income lines are currently in the same
  collection as expenses; that is the most important ambiguity to fix before any UI spending total.
  **Priority P8** (see Priority list).

#### `dubbo-council-gpfs` — 18 rows, audited GPFS pilot

- **In DB:** 18 `actual` / `agency_detail` rows for Dubbo Regional Council's audited FY2024-25
  General Purpose Financial Statements. This is a **separate source** from `dubbo-council` (the
  adopted 2026/27 budget with 245 budget/estimate rows); the two are never summed.
- **Source:** discovered from the official reporting page
  <https://www.dubbo.nsw.gov.au/About-Council/Our-Responsibilities/reporting> (no hard-coded PDF
  URL). The FY2024-25 statements PDF is 1,807,768 bytes, SHA-256
  `d9213cea468547a318548dfd72d7faa0d9fd2da81bcf6835138d10b58914a43f`, archived outside the repo.
- **Unit and reconciliation:** the printed unit is explicit `$'000` (thousands) on the income
  statement and note B1-1. The connector emits nothing unless the income-statement revenue lines,
  the printed total revenue, the printed expenses excluding depreciation plus the printed
  depreciation/amortisation/impairment, note B1-1's `Total functions and activities` expense total,
  the net result and the net result before capital grants all reconcile exactly. Revenue
  `$234,927,000` and expenses `$174,925,000` match the OLG FY2024-25 anchors exactly; net result is
  `$60,002,000` and the before-capital result is `$276,000`. Employee expenses are `$49,204,000`;
  depreciation/amortisation/impairment is `$57,859,000`; operating government grants are
  `$20,061,000` and capital government grants are `$59,726,000`.
- **No double count:** every row is `aggregation_role: "agency_detail"` with
  `gpfs_line_item`/`gpfs_component_of`; there is no `region_id` or `location`/LGA field. The generic
  additive API and the Dubbo area panel therefore exclude the rows, and they cannot be summed with
  the 245 `dubbo-council` summary rows. Government grant rows carry
  `potential_double_count: true`.
- **Licence / ambiguity:** “© Dubbo Regional Council. Published council documents used here for
  public-interest research; not an open-data licence grant.” The source is one council and one
  year; no cross-council, LGA-wide or project-level allocation is created.

#### `city-of-sydney-gpfs` — 18 rows, audited GPFS expansion

- **In DB:** 18 `actual` / `agency_detail` rows for the Council of the City of Sydney's audited
  FY2024-25 General Purpose Financial Statements. This is a **separate source** from every other
  source; the rows are never summed with Dubbo, another council, the data.nsw LGA-tagged state rows
  or any other state row.
- **Source:** discovered from the official annual-report page
  <https://www.cityofsydney.nsw.gov.au/research-reports/annual-report> (no hard-coded PDF URL). The
  link text “Financial statements 2024/25” resolves to the FY2024-25 statements PDF, 2,285,656
  bytes, SHA-256 `b52e7a1ecdde5bea6937f2d3040e04ed340a6db8cceb959d51c73e84504f623b`, archived
  outside the repo. Statements authorised for issue by Council on 27 October 2025; annual-report
  page published 20 November 2025.
- **Unit and reconciliation:** the printed unit is explicit `$'000` (thousands) on the income
  statement (p6), Statement of Comprehensive Income (p7) and note B1-1 (p16). The connector emits
  nothing unless the income-statement revenue lines sum to the printed total revenue (`$909,748`
  thousand), the printed expenses excluding depreciation (`$646,072`) plus the printed
  depreciation/amortisation/impairment (`$130,214`) equal the printed B1-1 total expenses
  (`$776,286`), the net result (`$133,462`) equals the B1-1 operating result and the Statement of
  Comprehensive Income net result, and the before-capital result (`$22,131`) equals net result minus
  capital grants. Employee expenses are `$306,623,000`; operating government grants are
  `$15,652,000` and capital government grants are `$111,331,000` (sum `$126,983` = B1-1 grants).
- **No double count:** every row is `aggregation_role: "agency_detail"` with
  `gpfs_line_item`/`gpfs_component_of`; there is no `region_id` or `location`/LGA field. The generic
  additive API and area panels therefore exclude the rows. Total expenses is the printed B1-1 total,
  never a component sum. Government grant rows carry `potential_double_count: true`.
- **Licence / ambiguity:** “© City of Sydney. Published council documents used here for
  public-interest research; not an open-data licence grant.” The source is one council and one year;
  no cross-council, LGA-wide or project-level allocation is created. The B1-1 function/activity
  split is not emitted as rows because its three-column budget/actual layout has dash-valued cells
  that cannot be positioned reliably from text.

### State budgets and state expenditure

#### `vic-budget` — 28 rows

- **In DB:** 20 additive COFOG-A general-government expense rows (10 functions × 2 budget years
  2025-26 and 2026-27) plus 8 non-additive Department of Treasury and Finance statement rows. Units
  are `$m`, confirmed from the workbook; Transport is stored as `045` and flagged as a provisional
  mapping that must not be rolled into `04`.
- **Available at source:** the DataVic CKAN datasets
  `state-budget-2026-27-aggregate-financial-statements`
  (`https://discover.data.vic.gov.au/dataset/state-budget-2026-27-aggregate-financial-statements`)
  and `state-budget-2026-27-departmental-statements`. The COFOG workbook has actual/revised/budget/
  forward-estimate columns; only the two budget columns are ingested. The departmental package
  contains one XLSX per department; only the DTF statement is ingested. The State Capital Program
  (Budget Paper No. 4) XLSX and the Victorian Infrastructure Pipeline are also published and are not
  ingested. See `PHASE4_INGESTION.md` and the manifest `docs/source-archive/vic-budget-2026-27.json`.
- **Granularity:** **aggregate COFOG summary plus one agency’s non-additive statement**. The COFOG
  rows are the official consolidated general-government expense totals by function; the DTF rows
  overlap that consolidated series and are shown as agency detail only.
- **Deeper extraction:** **feasible, high value.** First half: ingest all departmental statement
  workbooks as `agency_detail`, each reconciled to its own printed operating statement and excluded
  from every consolidated total. Second half: ingest the State Capital Program BP4 at project level
  as a separate capital series, clearly not summed with recurrent COFOG expenses. Optionally add the
  actual/revised columns as separate measure types after deciding how to present them; never sum them
  with budget columns.
- **Licence / ambiguity:** CC BY 4.0; attribution “© State of Victoria (Department of Treasury and
  Finance), 2026”. Transport mapping is unconfirmed and must remain flagged. **Priority P4** (see
  Priority list).

#### `qld-budget` — 1,051 rows

- **In DB:** 943 BP3 capital projects (`aggregation_role: additive`, 2026-27 budget) plus 108 BP4
  budget measures (`aggregation_role: policy_measure`, explicitly non-additive). BP3 stores project
  name, agency, asset type and SA4 text; raw latitude/longitude text is kept in notes only and never
  parsed or averaged. BP4 stores the measure, department and report section; revenue measures and
  blank/zero/negative 2026-27 amounts are excluded. No COFOG function is defensible; every row is
  provisional. Units are `$'000`, confirmed by the archived BP3/BP4 dictionaries.
- **Available at source:** the data.qld CKAN BP3 Capital Statement CSV and BP4 Budget Measures CSV
  (`https://www.data.qld.gov.au/dataset/2026-27-state-budget-budget-paper-3-capital-statement` and
  `https://www.data.qld.gov.au/dataset/e37910f7-0ae5-4a20-9e59-dcaa30517080`), plus their data
  dictionaries and explanatory notes (manifest
  `docs/source-archive/qld-budget-2026-27.json`). The BP3 CSV also publishes `Total Estimated Cost`,
  `Expenditure to 30-06-26`, `Post 2026-27`, latitude and longitude; the current connector stores
  only `Budget 2026-27` and keeps the coordinates in notes. BP4 has expense and capital measure
  sections; BP4 revenue measures are deliberately excluded. Budget Paper 2 and Service Delivery
  Statements are published as PDFs on budget.qld.gov.au and are not ingested.
- **Granularity:** **project-level capital and policy-measure summary**. BP3 is a project capital
  series, not a complete QLD expense total. BP4 measures overlap the BP3 capital program (the
  ingestion doc records seven project names in both), so BP4 is non-additive by design.
- **Deeper extraction:** **feasible, high value.** First half: add the published `Total Estimated
Cost` and `Expenditure to 30-06-26` as separate non-additive fields on the existing 943 projects
  (not summable with the 2026-27 budget), and promote project status/asset type where already
  present. Second half: parse Budget Paper 2 / Service Delivery Statements for agency and output
  expense detail, reconciling each statement and keeping it separate from the BP3 capital series.
  Never add BP3 and BP4.
- **Licence / ambiguity:** CC BY 4.0; attribution “© State of Queensland (Queensland Treasury),
  2026”. The BP3 CSV does not state its unit; the dictionary is the unit proof. SA4 text can contain
  multiple SA4s and is not an LGA. **Priority P6** (see Priority list).

#### `qld-qgip` — 200,387 payment rows (2018-19..2024-25)

- **In DB:** 169,311 grant awards and 31,076 procured frontline-service payments across 2018-19 to
  2024-25 (including the original 34,000 for 2024-25), each `aggregation_role: additive`. One CSV is
  ingested per year; each record keeps its own `fiscal_year` and a per-year natural key (resource id
  - row hash + year). Recipient legal entity, ABN, recipient type, program title, purpose, category,
    assistance type, funding agency, money source, funding use, agreement duration/start/end, total
    funding to date and service-delivery postcode/suburb/LGA are preserved in notes; the LGA is
    structured where supplied. No COFOG function. Units are whole AUD per the QGIP data dictionary.
- **Available at source:** the official data.qld QGIP consolidated-view dataset
  (`https://www.data.qld.gov.au/dataset/queensland-government-investment-portal-expenditure-data-consolidated-view`)
  publishes yearly expenditure CSVs from 2013-14 through 2024-25, plus the data dictionary. The
  dataset page confirms
  annual updates and warns that program names/machinery-of-government changes make cross-year
  comparison imperfect. The CSV’s `Assistance type1` has five values: Grant, Frontline service
  procurement, Concession, Loan and Direct government investment. The connector ingests only the
  first two; out-of-scope (Concession/Loan/Direct government investment) and zero-dollar in-scope
  rows are rejected per year. The connector ingests 2018-19..2024-25; 2013-14..2017-18 remain.
- **Granularity:** **payment/award-level actual expenditure**, the most granular state spending in
  the app. It is still not a complete state budget: only grants and procured frontline services are
  in scope, and some recipient details are aggregated for privacy. `Total funding under this
agreement to date` is a multi-year cumulative amount, never the annual payment and never added to
  it. 2019-20 is partial: the published file leaves the annual payment blank on 22,530 of 27,308
  rows, so only the 2,565 published annual payments are stored and flagged.
- **Deeper extraction:** **partly done.** 2018-19..2023-24 were ingested with the same
  Grant/Frontline mapping and per-year natural keys. Remaining: add 2013-14 through 2017-18 (their
  files are smaller and need the same check), then add Concession, Loan and Direct government
  investment as explicitly separate non-grant, non-contract series after a legal/semantic review;
  they are not the same kind of spending and must never be summed with grants or contracts.
- **Licence / ambiguity:** CC BY 4.0; attribution “© State of Queensland (Queensland Treasury),
  2025”. The dataset page says individual-recipient details may be aggregated for privacy. Program
  names change across years; do not join years by name without a reviewed crosswalk. **Priority P1**
  (see Priority list).

### Charity

#### `acnc-charity` — 127,606 rows

- **In DB:** 43,108 charity-year total-expenses rows (`expense_total`) plus 84,498 component rows
  (`expense_component`) across the five published expense categories: employee, interest,
  grants/donations in Australia, grants/donations outside Australia and all other. The 2024 AIS
  edition spans fiscal years 2022-23 (37 rows), 2023-24 (86,261) and 2024-25 (41,308) because
  charities report different periods. State is present for 99,754 rows and postcode for 3,509, all
  derived from program operating locations and flagged approximate; multi-state charities get no
  state. No COFOG function. Units are whole AUD, confirmed by the explanatory notes.
- **Available at source:** the data.gov.au ACNC 2024 AIS dataset
  `276ec1bc-4971-461c-88bc-be9f3c99a0f8`
  (`https://data.gov.au/data/dataset/acnc-2024-annual-information-statement-ais-data`) publishes the
  AIS CSV, an XLSX copy, the programs CSV/XLSX,
  group-members XLSX and the explanatory notes. The dataset page says it is updated weekly and that
  the AIS collects programs, HR and financial information; the connector reads only the expense,
  identity and program-location columns needed for this spending layer. The programs CSV supplies
  operating locations, not program-level dollars. The explanatory notes define the five expense
  components and the whole-dollar unit.
- **Granularity:** **charity-year expense category**. It is row-level for a charity’s reported
  expense category, but it is inherently aggregate below that: there is no published program-level
  expense amount in this dataset, and a charity’s total + components are two different roles, never
  additive to one another. 106 of 54,233 AIS rows differ from their component sum by $1 for source
  rounding; those rows keep only the total and are not forced to reconcile.
- **Deeper extraction:** **not available for more spending detail.** First half: add structured
  charity size/registration/ABN and AIS edition, and optionally retain earlier AIS editions for
  comparison. Second half: add other AIS financial dimensions only if they are clearly non-spending
  context (revenue, assets, employees) and never mix them into expense totals. Do not claim
  program-level charity spending; the source does not publish it. Geography is approximate at best.
- **Licence / ambiguity:** CC BY 3.0 Australia; attribution to ACNC. Charity expenses are not
  government spending and must never be added to government program totals. Location is a program
  operating location, not an expense-incurred address. **Priority P10** (see Priority list).

### Benchmarks

#### `abs-gfs` — 169 COFOG-A benchmark cells

- **In DB:** official COFOG-A expense cells for FY2024-25, with a function code on every row and
  `aggregation_role: benchmark`, `verified: true`. The connector ingests Table 9 (Commonwealth and
  the eight state/territory governments) and Table 10 (local government), skipping the “Total
  expenses” row and the “All levels of government” columns. Transport is published separately and
  stored as `045`; it must never be rolled into `04`. Units are `$m`, read from the workbook.
- **Available at source:** the ABS GFS Annual 2024-25 release
  (`https://www.abs.gov.au/statistics/economy/government/government-finance-statistics-annual/2024-25`)
  publishes the Key Tables workbook plus separate general-government, PNFC, non-financial-public-
  sector, public-financial-corporation and total-public-sector cubes, and the COFOG expense tables
  used here. The release page confirms the 2024-25 reference period, release date 21 April 2026 and
  the full data-download list. The ABS SDMX API has no GFS/COFOG dataflow; the XLSX is the approved
  fallback.
- **Granularity:** **inherently aggregate benchmark**. The cells are official top-down statistics
  by COFOG purpose and level of government. There is no project, agency, program or sub-state row to
  extract. Adding more GFS tables would add other published aggregates (revenue, net worth, PNFC,
  NFPS), not spending detail. The “All levels of government” column is a sum across levels and is
  deliberately excluded.
- **Deeper extraction:** **not appropriate for spending detail.** The only defensible extension is
  another reference year or another published GFS table, presented as a benchmark with the same
  no-sum rule. Never decompose a COFOG cell into projects or add GFS to project data.
- **Licence / ambiguity:** CC BY 4.0; attribution “© Commonwealth of Australia 2026 (ABS)”. The
  ABS SDMX absence is verified, not assumed. **Priority P11** (see Priority list).

#### `abs-gfs-pnfc` — 18 PNFC benchmark cells

- **In DB:** nine jurisdictions (Australia all-levels plus the eight states/territories) × two flows
  (`total_revenue`, `total_expenses`) for FY2024-25, all `aggregation_role: benchmark`, `verified:
true`. Component lines are deliberately not ingested, so revenue/expense totals cannot be double
  counted. Units are `$m`; revenue and expense are never summed.
- **Available at source:** the ABS GFS Annual 2024-25 release publishes nine separate PNFC operating-
  statement cubes, one per jurisdiction. Each cube contains component lines (sales, subsidies,
  interest, etc.) in addition to the two totals; the connector ingests only the published totals.
  The ABS SDMX API has no PNFC/GFS dataflow.
- **Granularity:** **inherently aggregate sector benchmark**. The components are still sector-level
  and cannot be attributed to a project or a location. Summing jurisdictions would double count
  inter-jurisdiction flows; summing revenue and expense would be meaningless.
- **Deeper extraction:** **low value and high risk.** Component lines could be added as separate
  benchmark line items, but they remain aggregate and must not be added to the totals or to SOC/
  entity data. This is a presentation/reference extension, not a spending-detail extension.
- **Licence / ambiguity:** CC BY 4.0. Never add PNFC to government program spending, SOC entities,
  charity expenses or the COFOG benchmark. **Priority P11** (see Priority list).

### NSW state-owned corporations (SOC)

The SOC layer is deliberately an **entity statement** layer. The brief’s “8 SOC rows” concern is
the same issue for all three entities: the app stores published statement lines, and the public
annual reports do not publish government-program-style project or LGA spending rows. The current
snapshot has 24 SOC rows: Sydney Water 10, WaterNSW 8, Hunter Water 6. Each is `measure_type:
actual`, `aggregation_role: agency_detail`, `verified: false`, with a `soc_line_item`, printed label,
unit `$'000` and entity. The API/UI never add them to government spending, to the PNFC benchmark or
to each other.

- **`sydney-water` — 10 rows.** Total revenue, other income, total expenses, employee expenses,
  depreciation/amortisation, net result and four government grant/contribution lines. Source:
  Annual Report 2024-25, face statement page 151; exact PDF
  `https://www.sydneywater.com.au/content/dam/sydneywater/documents/sydney-water-annual-report-2024-25.pdf`.
  Four government grant/contribution rows are flagged `potential_double_count: true`. Total expenses
  is derived from the two printed expense totals and accepted only when the profit-before-tax and
  after-tax bridges reconcile exactly.
- **`waternsw` — 8 rows.** Total revenue, total expenses, employee, depreciation/amortisation, net
  result and three government contribution/grant lines. Source: Annual Report 2024-25, consolidated
  statement page 59, grants note page 64; exact PDF
  `https://www.waternsw.com.au/documents/publications/general-publications/annual-reports/WaterNSW-Annual-Report-2024-2025.pdf`.
  Three government contribution/grant rows are flagged potential double count. The report was
  retrieved via the NSW Parliament mirror because the official host bot-blocks non-browser clients;
  the archive record preserves both URLs and the SHA-256.
- **`hunter-water` — 6 rows.** Total revenue, total expenses, employee, depreciation/amortisation,
  net result and government grants and rebates. Source: Annual Report 2024-25, statement page 77,
  revenue note page 84, operational note page 86; exact PDF
  `https://www.hunterwater.com.au/documents/assets/src/uploads/documents/Annual-Reports-Past-Reports/Annual-report-2024-25.pdf`.
  The government grants/rebates row is flagged potential double count. The audited statement prints
  a one-dollar NPAT/tax arithmetic rounding; the printed NPAT is retained and flagged for human
  spot-check, not used in reconciliation.

**Available but not ingested:** note-level components (employee, depreciation/amortisation, finance
costs, other operating expenses, superannuation, revaluation) are published in the statements and
notes; some are already stored. Deeper extraction could add further note components, but they are
components of the printed totals and must never be added to them. There is no published entity
segment/program/LGA dollar breakdown in these audited statements. **Do not start WaterNSW
deep-detail work here; that is item p67.** Licence: each report is © the corporation and used for
public-interest research, not an open-data licence grant. Other states do not use the same legal
class or publish one comparable list; the state-by-state inventory and no-sum boundaries are in
[docs/SOC_MULTI_STATE.md](./SOC_MULTI_STATE.md) (planning only; no other state row is ingested).
**Priority P12 — do not deepen as a
spending breakdown.**

**Deep-detail update (2026-11-17, item p67):** the WaterNSW 2024-25 notes do publish parseable,
reconciling line-item tables beyond the face statement. The deep-detail item added 39 note rows
(Note 2 water-supply segments, Note 4 other-revenue categories, Note 5 employee components, Note 6
other-operating categories, Note 7 depreciation components, Note 8 finance-cost components and the
cash-flow capital-expenditure outflow), each reconciling exactly in `$’000` to its printed note
subtotal. Every added row is `aggregation_role: agency_detail` and carries
`soc_component_of`/`soc_note`, so it is a component and never additional spending. WaterNSW is now
**47 rows** and the SOC layer **63 rows** (Sydney Water 10, WaterNSW 47, Hunter Water 6); the DB
total is **349,020** (348,981 + 39 new rows, no deletes). See `SOC_INGESTION.md` §2A for the
page/table/reconciliation evidence.

## Unit and reconciliation register

Every amount is stored as integer cents. The published unit is never inferred from magnitude; it is
read from a workbook/PDF header, a CSV data dictionary or an explicit column/cell marker.

| Source                                       | Published unit                            | Stored conversion                              | Unit evidence                                                                                              |
| -------------------------------------------- | ----------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `aus-tender`                                 | AUD decimal dollars                       | ×100 cents                                     | `contracts[0].value.amount`, connector mapping                                                             |
| `data-gov-au-pbs`                            | `$'000` in PBS tables                     | ×1,000 dollars, ×100 cents                     | referenced PBS table columns; CSV is bare integers                                                         |
| `grantconnect`                               | `Value (AUD)` decimal dollars             | ×100 cents                                     | verified 15-column export                                                                                  |
| `nsw-budget`                                 | `$m` financial; `$b` HFI; `$'000` capital | ×100,000,000; ×100,000,000,000; ×100,000 cents | workbook headers / ArcGIS field name                                                                       |
| `data-nsw-ckan`                              | `$`, `$'000`, `$m`, `$b` per resource     | per-resource multiplier                        | column header, cell format or closest published convention (BP2 flagged provisional)                       |
| `dubbo-council`                              | `$'000`                                   | ×100,000 cents                                 | PDF header; sections rejected if unit ambiguous                                                            |
| `dubbo-council-gpfs`                         | `$'000`                                   | ×100,000 cents                                 | printed income-statement and B1-1 header; missing/conflicting unit rejects all rows                        |
| `city-of-sydney-gpfs`                        | `$'000`                                   | ×100,000 cents                                 | printed income-statement, comprehensive-income and B1-1 headers; missing/conflicting unit rejects all rows |
| `vic-budget`                                 | `$m`                                      | ×100,000,000 cents                             | workbook sheet                                                                                             |
| `qld-budget`                                 | `$'000`                                   | ×100,000 cents                                 | archived BP3/BP4 dictionaries                                                                              |
| `qld-qgip`                                   | whole AUD                                 | ×100 cents                                     | QGIP data dictionary                                                                                       |
| `acnc-charity`                               | whole AUD                                 | ×100 cents                                     | ACNC explanatory notes                                                                                     |
| `abs-gfs`                                    | `$m`                                      | ×100,000,000 cents                             | Key Tables workbook row 7                                                                                  |
| `abs-gfs-pnfc`                               | `$m`                                      | ×100,000,000 cents                             | PNFC workbook row 6                                                                                        |
| `sydney-water` / `waternsw` / `hunter-water` | `$'000`                                   | ×100,000 cents                                 | printed statement header                                                                                   |

**No-sum rules that any deeper extraction must preserve**

- Never sum across `measure_type` values or across `actual`/`budget`/`estimate`.
- Never add `aggregation_role: benchmark` (ABS GFS/PNFC) to project, government, charity or SOC data.
- Never add `agency_detail` (SOC, VIC DTF, Dubbo GPFS, City of Sydney GPFS) to consolidated or government program
  totals, and never sum the GPFS revenue total, expense total and their components together.
- Never add `policy_measure` (QLD BP4) to additive project rows (BP3) or to any total.
- Never add `expense_total` and `expense_component` (ACNC) together; never add SOC total lines and
  their note components together.
- Never add capital and recurrent series, contract values and annual spend, income and expense, or
  `Total funding under this agreement to date` and the annual QGIP payment.
- Never use ABS “All levels of government” columns or GFS total rows in a sum.
- Never sum PBS line items as a federal total; the publisher says they do not reconcile to Budget
  Paper 1.
- Never present a cross-source total as a spending total. Source families overlap by design.

## Licence and ambiguity register

| Source                                       | Licence                                                         | Ambiguity / action                                                                                                               |
| -------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `aus-tender`                                 | CC BY 3.0 AU (AusTender site footer; contract notices, not ATM) | Contract values are not annual spend. Live feed has one contract per release (173,209 surveyed, 2026-11-17), so P2 adds no rows. |
| `data-gov-au-pbs`                            | CC BY 4.0 (official dataset page)                               | Source register still says not verified; correct it. CSV totals ≠ BP1 total.                                                     |
| `grantconnect`                               | Register: CC BY 4.0 International; site footer: CC BY 3.0 AU    | Reconcile the licence discrepancy. Manual export, >50,000 cap.                                                                   |
| `nsw-budget`                                 | CC BY 3.0 AU                                                    | 2025-26 source is an archived snapshot; live page moved. Capital COFOG provisional.                                              |
| `data-nsw-ckan`                              | “CC BY per CKAN dataset”                                        | Verify each selected dataset’s licence. BP2 unit is assumed `$'000` and provisional.                                             |
| `dubbo-council`                              | © Dubbo Regional Council; public-interest research              | Income lines are stored as measures; separate income from spending before any total.                                             |
| `dubbo-council-gpfs`                         | © Dubbo Regional Council; public-interest research              | Audited GPFS line items only; non-additive agency detail; no region/LGA; never summed with the 245 budget/summary rows.          |
| `city-of-sydney-gpfs`                        | © City of Sydney; public-interest research                      | Audited GPFS line items only; non-additive agency detail; no region/LGA; never summed with any other council or state rows.      |
| `vic-budget`                                 | CC BY 4.0                                                       | Transport `045` mapping unconfirmed; do not roll into `04`. Only one department ingested.                                        |
| `qld-budget`                                 | CC BY 4.0                                                       | Project SA4 text can be multi-valued and is not an LGA. BP4 overlaps BP3.                                                        |
| `qld-qgip`                                   | CC BY 4.0                                                       | Recipient details may be privacy-aggregated; program names change across years.                                                  |
| `acnc-charity`                               | CC BY 3.0 Australia                                             | Charity expenses are not government spending; location is approximate program location.                                          |
| `abs-gfs`                                    | CC BY 4.0                                                       | Benchmark; no sub-state or project decomposition. SDMX has no GFS dataflow.                                                      |
| `abs-gfs-pnfc`                               | CC BY 4.0                                                       | Benchmark; never add to SOC/entity/government data or across jurisdictions/flows.                                                |
| `sydney-water` / `waternsw` / `hunter-water` | © each corporation; public-interest research                    | Entity statement lines only; no program/project/LGA dollars. Never add to each other or to government spending.                  |

## Priority list — one source family per item

“First half” is the smaller, lower-risk step that should land first; “second half” is the deeper step
that needs more reconciliation or human review. No item below is authorised by this audit; this is a
planning list only.

| Priority | Source family                                | First half (lands first)                                                                                                                                                                                                                                                            | Second half                                                                                                                                                                                   | Guard                                                                                                                        |
| -------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **P1**   | `qld-qgip`                                   | **Landed 2026-11-17:** 2018-19 to 2023-24 annual CSVs ingested with the existing Grant/Frontline mapping and per-year natural keys (166,387 rows; 200,387 total incl. 2024-25). 2019-20 is partial and flagged because its published annual-payment column is blank on 82% of rows. | Add 2013-14 to 2017-18, then Concession/Loan/Direct government investment as separate non-grant, non-contract series after review.                                                            | Whole AUD; grants and contracts never summed; agreement total-to-date never added to the annual payment.                     |
| **P2**   | `aus-tender`                                 | **Premise checked 2026-11-17: no breadth to add.** Licence resolved (CC BY 3.0 AU); the live feed carried exactly one `contracts[]` object in all 173,209 releases over the ingested window, so “map all contracts” reproduces the existing 117,894 rows. No ingest, no re-key.     | Add item-level UNSPSC/description rows where item values exist, flagged non-additive; add multiple-supplier/amendment handling only if the publisher starts emitting multi-contract releases. | Contract value is not annual spend; item sums must not be added to contract totals; re-keying would duplicate existing rows. |
| **P3**   | `nsw-budget`                                 | **Done 2026-11-17:** ArcGIS project_id/agency/sector/cluster/electorate/region/lga/status/category/budget_year promoted to structured fields; the 171 no-budget features stay metadata-only.                                                                                        | Ingest Budget Paper 2/3 agency/program statements, reconciling each to its printed operating total; keep GG/PNFC/NFPS separate.                                                               | Never add sectors together; capital budget is not recurrent expense.                                                         |
| **P4**   | `vic-budget`                                 | Ingest all departmental statement workbooks as `agency_detail`, each reconciled to its own statement.                                                                                                                                                                               | Ingest the State Capital Program (BP4) at project level as a separate capital series; consider actual/revised columns as separate measure types.                                              | Department rows overlap consolidated COFOG; capital is not recurrent; do not roll `045` into `04`.                           |
| **P5**   | `data-gov-au-pbs`                            | Promote `expense_type`, `appropriation_type`, `outcome` and all published year columns to explicit dimensions/series.                                                                                                                                                               | Parse Excel Table 2.X.2 program-component and Table 1.1 resource-statement tables with printed sub-total reconciliation.                                                                      | PBS line items are not the federal total; entity sub-totals are non-additive; never sum years.                               |
| **P6**   | `qld-budget`                                 | Add `Total Estimated Cost` and `Expenditure to 30-06-26` as separate non-additive fields on the existing 943 BP3 projects.                                                                                                                                                          | Parse Budget Paper 2 / Service Delivery Statements for agency/output expense detail.                                                                                                          | BP3 capital ≠ complete QLD expense; BP4 overlaps BP3; never sum BP3+BP4.                                                     |
| **P7**   | `data-nsw-ckan`                              | Ingest the deferred media-expenditure DOCX via the shared PDF/DOCX foundation; verify its unit and licence.                                                                                                                                                                         | Add earlier RAM/BP2 editions or further targeted datasets, each with its own mapping.                                                                                                         | Do not harvest the whole portal; BP2 overlaps NSW capital at program level.                                                  |
| **P8**   | `dubbo-council`                              | Add a section/flow field so income and expense rows cannot be mixed; parse program/activity expense budgets if published.                                                                                                                                                           | Parse the individual capital project list with its own total reconciliation.                                                                                                                  | One council only; income is not spending; `$'000` unit/total gate stays.                                                     |
| **P9**   | `grantconnect`                               | Promote GO ID, category, activity dates, aggregate flag/reason and last-updated to structured fields from the existing export.                                                                                                                                                      | Extend cap-safe complete coverage to earlier periods.                                                                                                                                         | No public API/scraper; partial coverage must stay visible; no location data available.                                       |
| **P10**  | `acnc-charity`                               | Add structured AIS edition/charity size/registration/ABN and retain earlier AIS editions for comparison.                                                                                                                                                                            | Add non-spending context fields (revenue/assets/employees) only as clearly separate context.                                                                                                  | No program-level expense exists; total and components never summed; charity ≠ government.                                    |
| **P11**  | `abs-gfs` / `abs-gfs-pnfc`                   | No spending-detail extraction. Optionally add the prior reference year as a benchmark comparison.                                                                                                                                                                                   | No decomposition. Keep the published cells and the no-sum rules.                                                                                                                              | Inherently aggregate; SDMX has no GFS/PNFC dataflow; never add to project/SOC data.                                          |
| **P12**  | `sydney-water` / `waternsw` / `hunter-water` | Do not deepen as a spending breakdown. Keep the 24 entity statement lines, unit badge and no-total rule.                                                                                                                                                                            | Only note-level components if a future item explicitly asks; never add components to totals.                                                                                                  | Entity-level by law/reporting; no program/LGA/project dollars; WaterNSW deep detail is p67, not this item.                   |

## Recommendation

- **Keep the SOC layer honest.** The 24 SOC rows are the deepest public audited figures for those
  entities. A UI that shows them as “where the money goes” is showing entity totals, not a spending
  breakdown; the fix is presentation and explanation, not a deeper connector.
- **Spend effort where the publisher already publishes transactions.** QGIP (P1) and QLD BP3 (P6)
  have the largest gap between available detail and ingested detail per unit of work. AusTender P2
  was checked on 2026-11-17 and has no extra contract objects to map. QGIP is the clearest win
  because the schema is already understood and the publisher has twelve annual files.
- **Add program/agency detail only with reconciliation.** VIC all-department statements (P4), NSW
  Budget Paper 2/3 (P3) and PBS Excel tables (P5) are valuable, but each needs a printed total to
  reconcile against and a non-additive role where it overlaps a consolidated series.
- **Do not manufacture detail for ACNC or ABS.** ACNC has five expense components and program
  locations, not program dollars. ABS GFS/PNFC are official aggregates. Both are better presented as
  what they are than expanded into pseudo-projects.
- **Fix the two register-level data-quality items first:** the Dubbo income/expense mixing and the
  PBS/GrantConnect licence discrepancies. They are cheap documentation/code-adjacent fixes and they
  prevent a misleading spending total.

## Reproduce the audit

```bash
# Total and per-source counts (read-only)
mongosh "mongodb://10.10.10.30:27017/ausspend_dev" --quiet --eval \
  'db.measures.countDocuments({}); db.measures.aggregate([{$group:{_id:"$source_id",n:{$sum:1}}},{$sort:{n:-1}}]).toArray()'

# Role, measure-type and field coverage (read-only; no writes)
mongosh "mongodb://10.10.10.30:27017/ausspend_dev" --quiet --eval \
  'db.measures.aggregate([{$group:{_id:"$aggregation_role",n:{$sum:1}}}]).toArray()'

# Source register and archive documents (read-only)
mongosh "mongodb://10.10.10.30:27017/ausspend_dev" --quiet --eval \
  'db.data_sources.find({},{_id:0,source_id:1,status:1,records_ingested:1,license:1}).sort({source_id:1}).toArray(); db.source_documents.countDocuments({})'
```

Expected snapshot values: total **348,981**; sources 15; source documents 58; synthetic rows 0.
Writing this document performed no database operation; the post-write count is still 348,981.
