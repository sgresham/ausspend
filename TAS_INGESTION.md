# TAS Budget — Budget Paper No. 1 COFOG table (Phase 6.7)

Source id: `tas-budget`. Jurisdiction: TAS, state level only. This phase does
not touch any other state, federal, local or SOC source.

## Premise and source

The Tasmanian budget is document-heavy. Budget Paper No. 1 is a **digital PDF**
(selectable text, not a scan); the premise falsifier is satisfied because an
expense table is extractable, not image-only.

- Budget page:
  `https://www.treasury.tas.gov.au/budget-and-financial-management/2026-27-tasmanian-budget`
- BP1 PDF:
  `https://www.treasury.tas.gov.au/Documents/2026-27%20Budget%20Paper%20No.%201%2c%20Budget%20Strategy%20and%20Estimates.PDF`
- SHA-256: `f9e4b1bc1d4f337623ba8cda84f2a6a1b94de66070ecddc27065cfd4c163a488`
- Bytes: `1,678,498`
- Licence: © Government of Tasmania. Used for public-interest research; no
  open-data licence statement was found on the page.

The connector discovers the BP1 link from the budget page, downloads the PDF,
archives it with SHA-256 outside the repo and verifies the hash before
extraction (`fetch_strategy = direct`).

## Extracted table

**Table 9.16 — General Government Expenses from Transactions by Purpose**
(chapter 9, page 245). It is explicitly COFOG-A classified, prints `$m` for
all six columns and has a printed total.

| Column                    | Fiscal year | measure_type |
| ------------------------- | ----------- | ------------ |
| 2025-26 Estimated Outcome | 2025-26     | estimate     |
| 2025-26 Budget            | 2025-26     | budget       |
| 2026-27 Budget            | 2026-27     | budget       |
| 2027-28 Forward Estimate  | 2027-28     | estimate     |
| 2028-29 Forward Estimate  | 2028-29     | estimate     |
| 2029-30 Forward Estimate  | 2029-30     | estimate     |

11 printed category lines × 6 columns = **66 rows**.

### COFOG mapping

Only the printed category labels are mapped; no agency or purpose mapping is
invented:

| Printed line                       | function_code             |
| ---------------------------------- | ------------------------- |
| General public services            | 01                        |
| Public order and safety            | 03                        |
| Economic affairs                   | 04                        |
| Environmental protection           | 05                        |
| Housing and community amenities    | 06                        |
| Health                             | 07                        |
| Recreation, culture and religion   | 08                        |
| Education                          | 09                        |
| Social protection                  | 10                        |
| Transport                          | 045                       |
| Nominal interest on superannuation | _(none — non-COFOG line)_ |

Transport is printed separately at COFOG subdivision 045; the printed
"Economic affairs" line is the table's own residual line. Nominal interest on
superannuation is not a COFOG function; it is retained only so the rows
reconcile to the printed total and is flagged in its notes.

### Unit guard and reconciliation

- Every header must print `$m` for all six value columns; a missing or
  different unit fails ingestion.
- The 11 printed category lines must sum to the printed total for every year:
  10,506.2 / 10,638.5 / 10,788.1 / 10,394.1 / 10,464.8 / 10,980.7 $m. All six
  years reconcile; a mismatch fails ingestion.

## Row semantics

- `jurisdiction_level = "state"`, `jurisdiction = "TAS"`,
  `location = { state: "TAS" }` (state-wide only; no LGA/postcode invented).
- `amount_cents` = $m × 100,000,000.
- `aggregation_role = "benchmark"` — a whole-of-government COFOG aggregate,
  **non-additive** in the generic spending totals; never summed across years or
  with another source.
- `data_quality_flag = "provisional"`, `extraction_confidence = "high"`
  (digital table, exact total reconciliation), `verified = false`.
- `source_dataset = "2026-27 TAS Budget Paper No. 1 — Budget Strategy and
Estimates"`, exact PDF `source_url`, `tas_budget_table = "Table 9.16"`,
  `tas_budget_column` and `tas_budget_unit = "AUD_millions"`.
- Agency-level tables are in Budget Paper No. 2 and are outside this item.

## Live result (2026-11-18)

- 66 `tas-budget` rows: 11 categories × 6 columns.
- DB before 691,393 → after 691,459 (+66 TAS only; other sources delta 0).
- `data_sources`: active, `records_ingested = 66`, `fetch_strategy = direct`,
  staleness 0.

## Verify

```bash
mongosh 'mongodb://10.10.10.30:27017/ausspend_dev' --quiet --eval '
  db.measures.countDocuments({source_id:"tas-budget"});
  db.measures.aggregate([{$match:{source_id:"tas-budget"}},
    {$group:{_id:{measure:"$measure_type",fn:"$function_code"},n:{$sum:1}}}]).toArray();
'
```

Tests: `server/test/tas-budget.test.ts` covers the `$m` guard, the 66-row
parse, COFOG mapping (including the non-COFOG line), measure-type/year
columns, total reconciliation, natural keys, idempotency, no-sum and no
deletes.
