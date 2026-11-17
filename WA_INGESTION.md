# WA Budget — CKAN EFO ingestion (Phase 6.3)

Source id: `wa-budget`. Jurisdiction: WA, state level only. This phase does
not touch any other state, SOC, federal or local source.

## Premise falsifier: no machine-readable BP2

`catalogue.data.wa.gov.au` has three budget packages, all titled **Western
Australia Budget Economic and Fiscal Outlook Table and Chart Data** (Budget
Paper No. 3):

- 2014-15, 2015-16 and 2016-17.

There is **no machine-readable Budget Paper No. 2 agency-expense dataset** in
the catalogue. The premise falsifier therefore holds. The connector extracts
the strongest clean machine-readable EFO tables and marks them provisional; it
does not guess a BP2 layout or a COFOG mapping.

Latest package (selected by CKAN `package_search?q=budget`, then
`package_show`):

- Package:
  `2016-17-western-australia-budget-economic-and-fiscal-outlook-table-and-chart-data`
- Page:
  `https://catalogue.data.wa.gov.au/dataset/2016-17-western-australia-budget-economic-and-fiscal-outlook-table-and-chart-data`
- Licence: **Custom (Personal & Academic Use)** — not an open-data licence
  grant. The source/licence is recorded verbatim on `data_sources`.

### Adopted workbooks

| Workbook                                | CKAN resource                                                                      | SHA-256                                                            | Bytes   |
| --------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------- |
| Chapter 5 — General Government Expenses | `.../resource/cc3ef8b3-03b3-4b53-9322-57a5f1f94e95/download/2016-17-chapter5.xlsx` | `ce6e5afa5770dcde360f2e11f91c5af12b69720ce1303afb52d2542e54dc3950` | 141,983 |
| Chapter 6 — Asset Investment            | `.../resource/388f9c64-f7bf-4a1b-96e2-6abbfec1b9f7/download/2016-17-chapter6.xlsx` | `78797c887367035749ddd48c417be3cd87bf7d67ec135410446f6860f83d8989` | 73,661  |

Both are archived with SHA-256 outside the repo and hash-verified before
parsing. On 2026-11-17 the CKAN resource endpoint intermittently answered with
an AWS WAF challenge (`HTTP 202`, zero-byte `text/html`). The connector then
reuses the exact SHA-256-verified archive copies; it never ingests a partial or
substituted workbook. `fetch_strategy` remains `direct` and the warning is
recorded on the run.

## Mapping (855 rows)

### Chapter 5 — 845 rows

`Table 1..19` are per-minister/agency **major spending changes since the
2015-16 Mid Year Review**, with five year columns and an explicit `$m` unit.
They are changes (policy measures), not total agency expenses, so:

- `wa_budget_measure = "major_spending_change"`
- `aggregation_role = "policy_measure"` — never additive
- `potential_double_count = true`
- `data_quality_flag = "provisional"`
- `extraction_confidence = "medium"`
- `function_code` is absent: no COFOG mapping is published, so none is
  invented.
- Chapter 5 prints no table total; rows are not summed into any invented
  total.

### Chapter 6 Table 1 — 10 rows

Asset investment in roads and public transport by agency:

- Main Roads and Public Transport Authority are ingested as agency rows.
- The printed **Total** row is used for reconciliation only; it is not
  ingested.
- `wa_budget_measure = "asset_investment"`
- `aggregation_role = "agency_detail"`, `potential_double_count = false`
- `data_quality_flag = "provisional"`, `extraction_confidence = "high"`

Unit guard and reconciliation:

- Every adopted table must print `2015-16..2019-20` and `$m` over the five
  value columns. A missing/mismatched year or unit **fails ingestion**.
- Chapter 6 Table 1 must reconcile each year: agency rows sum to the printed
  Total. The source notes columns may not add due to rounding; one published
  `$m` of rounding is allowed (2015-16 is 1,473 vs printed 1,474), a larger
  mismatch fails ingestion. All five years pass.

### Common fields

- `fiscal_year` is the column year.
- `measure_type` follows the documented WA budget convention: 2015-16
  `actual`, 2016-17 `budget`, 2017-18..2019-20 `estimate`.
- `amount_cents` = absolute $m × 100,000,000 cents; negative measures are
  stored as magnitudes with `wa_printed_sign = "negative"`.
- `jurisdiction_level = "state"`, `jurisdiction = "WA"`,
  `location = { state: "WA" }` (state-wide only; no LGA/postcode is invented).
- `source_dataset = "2016-17 WA Budget Paper No. 3 — Economic and Fiscal
Outlook"`, exact workbook `source_url`, `verified = false`.
- `wa_budget_table` records the exact table (`Chapter 5 Table 6`, etc.).

No row is additive in the generic spending totals: Chapter 5 is
`policy_measure`, Chapter 6 is `agency_detail`. The API never sums these rows
with each other, with years, or with another source.

## Live result (2026-11-17)

- 855 `wa-budget` rows: 845 major spending changes + 10 asset investment.
- Measure types: 76 actual, 209 budget, 570 estimate.
- Before/after DB: 684,059 → 684,914 (+855 WA only; every other source delta 0).
- `data_sources`: `wa-budget` active, `records_ingested = 855`,
  `fetch_strategy = direct`, staleness 0.

## Verify

```bash
# WA row count and measure/table split
mongosh 'mongodb://10.10.10.30:27017/ausspend_dev' --quiet --eval '
  db.measures.countDocuments({source_id:"wa-budget"});
  db.measures.aggregate([{$match:{source_id:"wa-budget"}},
    {$group:{_id:{measure:"$wa_budget_measure",type:"$measure_type"},n:{$sum:1}}}]).toArray();
'
# unit/sign and no-sum evidence
mongosh 'mongodb://10.10.10.30:27017/ausspend_dev' --quiet --eval '
  db.measures.find({source_id:"wa-budget"}, {amount_cents:1,wa_printed_sign:1,aggregation_role:1,wa_budget_table:1}).limit(3)
'
```

Tests: `server/test/wa-budget.test.ts` covers CKAN package/resource selection,
the `$m` unit guard, Chapter 6 total reconciliation, the documented
actual/budget/estimate convention, natural keys, idempotency, negative printed
signs, no-sum semantics and no deletes.
