# QLD local government comparative information — financial inputs (Phase 6.9)

Source id: `qld-local-government`. Jurisdiction: QLD, local government only.
This source is deliberately separate from `qld-qgip` (project grants and
procured frontline services) and is never combined with it.

## Source

- CKAN dataset:
  `https://www.data.qld.gov.au/dataset/queensland-local-government-comparative-information-report`
- Resource: **Financial Inputs** CSV (not the rates/personnel/roads/water
  side datasets)
- Exact CSV:
  `https://www.data.qld.gov.au/dataset/c7c0c31e-a844-480d-bfbe-4b689179a5cf/resource/2dd25c9b-cc5b-4c81-876f-97d277e88889/download/qld-local-government-comparative-information-report-cdc-financial-inputs.csv`
- SHA-256: `6cc0ad90b34441992c3b4a9d75d6947436e306f7b41fa0d3379daa51cde75001`
- Bytes: `82,305`
- Licence: Creative Commons Attribution 4.0 International (CC BY 4.0).

The CSV is fetched live from CKAN, archived with SHA-256 outside the repo and
hash-verified before parsing. `fetch_strategy = direct`.

## Shape

One council × financial-year row per published measure. The CSV has 402
council-year rows, 77 councils and six years (2010-11..2015-16; the package
description mentions 2016-17 but the published Financial Inputs CSV ends at
2015-16).

Measures ingested (when published; missing/blank cells are skipped, never
zero-filled):

| `qld_lg_measure`                | CSV column                                                                                                                                                                     | role               |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------ |
| `total_operating_expenses`      | `Total operating expenses before interest (excl unfunded depreciation)` for 2010-11..2012-13; `Total operating expenses before interest * - from 2013/14` for 2013-14..2015-16 | printed total      |
| `employee_expenses`             | `Employee expenses`                                                                                                                                                            | component of total |
| `depreciation_amortisation`     | `Depreciation and amortisation expense`                                                                                                                                        | component of total |
| `interest_paid_borrowing_costs` | `Total Interest paid (borrowing costs) to QTC and other financial institutions`                                                                                                | component of total |

Row counts: total 401, employee 401, depreciation 400, interest 388 —
**1,590 rows**. One council-year (Woorabinda Aboriginal Shire Council,
2015-16) has no printed total; its component rows are still ingested and no
total is invented.

## Mapping and no-sum

- `jurisdiction_level = "local"`, `jurisdiction = "QLD"`,
  `location = { state: "QLD", lga_name: <council> }`,
  `delivery_entity = <council>`.
- `measure_type = "actual"` (reported historical financial inputs, not budget
  or estimate).
- `aggregation_role = "agency_detail"` for every row, so no cross-council or
  cross-measure total can be computed. Components carry
  `qld_lg_component_of = "total_operating_expenses"` and are never added to
  that total.
- `qld_lg_unit = "AUD_thousands"`; `amount_cents = $'000 × 100,000`.
- `data_quality_flag = "provisional"`, `extraction_confidence = "high"`,
  `verified = false`.
- No COFOG mapping is published in this CSV, so `function_code` stays absent.

## Reconciliation

For every council-year with a printed total, the three ingested components
must not exceed that total. All live rows pass; a component larger than the
printed total fails ingestion. The CSV has no printed total row, so no
cross-council total is calculated.

## Live result (2026-11-18)

- 1,590 `qld-local-government` rows.
- DB before 691,469 → after 693,059 (+1,590 QLD local only; every other source
  delta 0, including `qld-qgip`).
- `data_sources`: active, `records_ingested = 1590`, `fetch_strategy = direct`,
  staleness 0.

## Verify

```bash
mongosh 'mongodb://10.10.10.30:27017/ausspend_dev' --quiet --eval '
  db.measures.countDocuments({source_id:"qld-local-government"});
  db.measures.aggregate([{$match:{source_id:"qld-local-government"}},
    {$group:{_id:"$qld_lg_measure",n:{$sum:1}}}]).toArray();
  db.measures.countDocuments({source_id:"qld-qgip"});
'
```

Tests: `server/test/qld-local-government.test.ts` covers CKAN discovery,
Financial Inputs selection, `$’000` conversion, council keys, component/total
labelling, no-sum, idempotency, the component-vs-total reconciliation, and
separation from QGIP.
