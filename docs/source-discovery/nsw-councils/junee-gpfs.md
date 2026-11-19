# NSW council GPFS — Junee Shire Council FY2025-26 evidence

**Status:** implementation evidence only. One council, one audited year. The exact PDF is archived
outside the repo; no PDF or raw table is committed. **Entity:** Junee Shire Council only.
**No council total, no state or national total, no OLG summary layer, no SOC/other council rows.**
The FY2025-26 column is used; the FY2024-25 comparative inside the statement is never added.

**Checked:** 2026-11-19 (Australia/Sydney).

## 1. Discovery and access log

| Step                            | URL                                                                                              | HTTP    | Result                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------------------------ | ------- | ---------------------------------------------------------------------------- |
| Official Financial Reports page | <https://www.junee.nsw.gov.au/council/documents/financial-reports/>                              | **200** | `text/html`; lists the current and prior standalone financial statements.    |
| Brief's Annual Reports page     | <https://www.junee.nsw.gov.au/council/documents/annual-reports/>                                 | **200** | `text/html`; does not list the current GPFS (only an old 2017-18 statement). |
| Current statements upload       | <https://www.junee.nsw.gov.au/wp-content/uploads/2026/10/Annual_Financial_Statements-2026-1.pdf> | **200** | `application/pdf`, 972,546 bytes, 82 PDF pages.                              |

The connector parses the Financial Reports page, selects the latest dated FY2025-26 statements
upload, and ignores annual reports, notices and prior years. A documented official fallback pin is
used only if the page yields no usable anchor. The exact bytes are SHA-256 re-verified before
parsing.

## 2. Exact document

- **Title:** Annual Financial Statements 2025-26.
- **Financial year:** 2025-26, for the year ended 30 June 2026.
- **URL:** `https://www.junee.nsw.gov.au/wp-content/uploads/2026/10/Annual_Financial_Statements-2026-1.pdf`
- **Bytes:** 972,546.
- **PDF pages:** 82.
- **SHA-256:** `c725ef8a02c29778426dc7be4263e72b070b86c9aeeb901d524eba1d652d5d36`.
- **Archive root:** `~/ausspend-source-archive/junee-gpfs/` (outside the repo; not committed). It
  holds the exact PDF plus archive metadata (URL, retrieval date, bytes, SHA-256) and the archive
  record. The connector re-verifies the hash before parsing.

## 3. Printed unit and statement

The Income Statement is on PDF page 5 (printed page 4). It prints `$ '000` for the 2026 columns. The
unit gate requires **`$ '000` / thousands**; a plain `$`, `$M` or unit-less read is rejected. The
adapter reads the FY2025-26 Actual column only.

The current-year column prints (whole `$ '000`):

```text
Income from continuing operations
  Rates and annual charges                                8,500
  User charges and fees                                   7,043
  Other revenues                                            609
  Grants and contributions provided for operating purposes 9,754
  Grants and contributions provided for capital purposes   1,723
  Interest and investment income                            163
  Other income                                              290
  Net gain from the disposal of assets                      270
  Total income from continuing operations                 28,352
Expenses from continuing operations
  Employee benefits and on-costs                          6,546
  Materials and services                                 10,447
  Borrowing costs                                           505
  Other expenses                                            663
  Net loss from the disposal of assets                        – (nil)
  Total expenses ... excluding depreciation              18,161
  Depreciation, amortisation and impairment               4,112
  Operating result from continuing operations             6,079
  Net operating result for the year attributable to Council 6,079
  Net operating result before capital grants               4,356
```

The statement prints **no Total expenses line**. Total expenses is the printed face bridge:
expenses-excluding-depreciation `18,161` + depreciation/amortisation/impairment `4,112` = `22,273`,
which equals the B1-1 "Total functions and activities" expense total. Junee prints eight revenue
lines (including other income and a net gain on disposal) and four non-zero expense lines; its net
loss on disposal is nil and is not emitted.

## 4. Reconciliation (zero tolerance)

All arithmetic is in whole printed `$ '000` values:

```text
revenue components:
  8,500 + 7,043 + 609 + 9,754 + 1,723 + 163 + 290 + 270 = 28,352
  = printed Total income

expense components:
  6,546 + 10,447 + 505 + 663 = 18,161
  = printed expenses excluding depreciation

total expenses:
  18,161 + 4,112 = 22,273
  = printed B1-1 Total functions and activities expenses

operating result:
  28,352 - 22,273 = 6,079
  = printed Operating result and net operating result

before capital grants:
  6,079 - 1,723 = 4,356
  = printed before-capital result (evidence only)

B1-1 grants and contributions:
  9,754 + 1,723 = 11,477
  = printed B1-1 grants total

comprehensive income:
  6,079 + 10,748 other comprehensive income = 16,827
  = printed Total comprehensive income
```

The adapter defers the document with **0 rows** if any printed line is missing, if the unit is not
thousands, or if any of these bridges differs by one thousand. On the FY2025-26 report there is no
deferral.

## 5. Extracted entity rows (17, non-additive)

| `gpfs_line_item`                        | Printed/derived label                        | `$ '000` | `amount_cents` | Section  |
| --------------------------------------- | -------------------------------------------- | -------: | -------------: | -------- |
| `rates_and_annual_charges`              | Rates and annual charges                     |    8,500 |    850,000,000 | revenue  |
| `user_charges_and_fees`                 | User charges and fees                        |    7,043 |    704,300,000 | revenue  |
| `other_revenues`                        | Other revenues                               |      609 |     60,900,000 | revenue  |
| `government_grants_operating`           | Grants and contributions — operating         |    9,754 |    975,400,000 | revenue  |
| `government_grants_capital`             | Grants and contributions — capital           |    1,723 |    172,300,000 | revenue  |
| `interest_and_investment_income`        | Interest and investment income               |      163 |     16,300,000 | revenue  |
| `other_income`                          | Other income                                 |      290 |     29,000,000 | revenue  |
| `net_gain_from_disposal_of_assets`      | Net gain from the disposal of assets         |      270 |     27,000,000 | revenue  |
| `total_revenue`                         | Total income from continuing operations      |   28,352 |  2,835,200,000 | revenue  |
| `employee_expenses`                     | Employee benefits and on-costs               |    6,546 |    654,600,000 | expenses |
| `materials_and_services`                | Materials and services                       |   10,447 |  1,044,700,000 | expenses |
| `borrowing_costs`                       | Borrowing costs                              |      505 |     50,500,000 | expenses |
| `other_expenses`                        | Other expenses                               |      663 |     66,300,000 | expenses |
| `total_expenses_excluding_depreciation` | Total expenses excluding depreciation        |   18,161 |  1,816,100,000 | expenses |
| `depreciation_amortisation_impairment`  | Depreciation, amortisation and impairment    |    4,112 |    411,200,000 | expenses |
| `total_expenses`                        | Total expenses (documented bridge)           |   22,273 |  2,227,300,000 | expenses |
| `net_result`                            | Net operating result attributable to Council |    6,079 |    607,900,000 | result   |

Every row is `jurisdiction_level: "local"`, `jurisdiction: "NSW"`,
`delivery_entity: "Junee Shire Council"`, `aggregation_role: "agency_detail"`,
`measure_type: "actual"`, `verified: false`, `data_quality_flag: "provisional/local_government"`.
Government grant rows carry `potential_double_count: true`.

## 6. No-total / no-cross-council rule

- Junee Shire Council is one entity. No council total, no state/national total and no sum with
  another council, the `dubbo-council` budget/estimate rows, a government program, the PNFC
  benchmark or the OLG summary layer is created.
- The FY2025-26 column is the reporting boundary; the FY2024-25 comparative is not added.
- Revenue, expenses, components and the net result overlap. They are published rows, not an
  additive spending series.
- Every row is `agency_detail` with no `region_id` and no `location`/LGA allocation.

## 7. How to verify

```bash
# Financial Reports page lists the statements; the current upload is a native PDF.
curl -sL -o /dev/null -w '%{http_code}\n' \
  'https://www.junee.nsw.gov.au/council/documents/financial-reports/'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  'https://www.junee.nsw.gov.au/wp-content/uploads/2026/10/Annual_Financial_Statements-2026-1.pdf'

# Focused connector tests (14).
TEST_MONGO_URL="mongodb://localhost:27017/ausspend_test_junee" \
  npx vitest run --project server server/test/junee-gpfs.test.ts
```

The focused suite covers the unit gate, exact reconciliation/zero tolerance, stale-year rejection,
natural-key/idempotency, no-cross-council totals and discovery/latest selection (including selecting
the latest dated upload and the documented official fallback pin).
