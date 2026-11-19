# NSW council GPFS — Lockhart Shire Council FY2025-26 evidence

**Status:** implementation evidence only. One council, one audited year. The exact PDF is archived
outside the repo; no PDF or raw table is committed. **Entity:** Lockhart Shire Council only.
**No council total, no state or national total, no OLG summary layer, no SOC/other council rows.**
The FY2025-26 column is used; the FY2024-25 comparative inside the statement is never added.

**Checked:** 2026-11-19 (Australia/Sydney).

## 0. Fiscal-year decision

FY2025-26 is the **latest audited standalone 3-in-1 General Purpose Financial Statements** published
by the council at 2026-11-19, for the year ended 30 June 2026. The connector targets `2025-26`, and
its stale-year guard rejects other years rather than silently substituting a prior-year statement,
annual report, operational plan or notice.

## 1. Discovery and access log

| Step                              | URL                                                                                          | HTTP    | Result                                                       |
| --------------------------------- | -------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------ |
| Official Council Policies, Plans and Reports page | <https://lockhart.nsw.gov.au/council/council-policies-plans-reports/>         | **200** | `text/html`; lists the FY2025-26 statements and prior years. |
| Audited FY2025-26 3-in-1 statements | <https://lockhart.nsw.gov.au/wp-content/uploads/2026/11/Annual_Financial_Statements-2026-3-in-1.pdf> | **200** | `application/pdf`, 3,258,064 bytes, 95 PDF pages.            |

The connector parses the official page, selects the FY2025-26 statements upload, and ignores annual
reports, operational/delivery plans, budget documents and prior years. A documented official fallback
pin is used only if the page yields no usable anchor. The exact bytes are SHA-256 re-verified before
parsing.

## 2. Exact document

- **Title:** Annual Financial Statements for the year ended 30 June 2026 (3-in-1).
- **Financial year:** 2025-26, for the year ended 30 June 2026.
- **URL:** `https://lockhart.nsw.gov.au/wp-content/uploads/2026/11/Annual_Financial_Statements-2026-3-in-1.pdf`
- **Bytes:** 3,258,064.
- **PDF pages:** 95.
- **SHA-256:** `e57168fa5be1ef8e4f6facd22f4244887d4e9bdbbb013ef6d3d746c0c63f3212`.
- **Archive:** `lockhart-gpfs/` under the configured source-archive root (outside the repo; not
  committed). It holds the exact PDF plus archive metadata (URL, retrieval date, bytes, SHA-256,
  content type) and the archive record. The connector re-verifies the hash before parsing.

## 3. Printed unit and statement

The Income Statement is on PDF page 5 (printed page 4 of 74). It prints `$ '000` for the 2026 columns.
The unit gate requires **`$ '000` / thousands**; a plain `$`, `$M` or unit-less read is rejected. The
adapter reads the FY2025-26 Actual column only.

The FY2025-26 column prints (whole `$ '000`):

```text
Income from continuing operations
  Rates and annual charges                               4,311
  User charges and fees                                  1,226
  Other revenues                                           811
  Grants and contributions provided for operating purposes 10,823
  Grants and contributions provided for capital purposes  2,698
  Interest and investment income                           246
  Other income                                             179
  Net gain from the disposal of assets                       6
  Total income from continuing operations                20,300
Expenses from continuing operations
  Employee benefits and on-costs                         4,551
  Materials and services                                 6,295
  Borrowing costs                                          125
  Other expenses                                         1,125
  Net loss from the disposal of assets                       – (nil for 2026)
  Total expenses ... excluding depreciation             12,096
  Depreciation, amortisation and impairment              7,079
  Operating result from continuing operations             1,125
  Net operating result attributable to Council            1,125
  Net operating result before capital grants             (1,573)
```

The statement prints **no Total expenses line**. Total expenses is the printed face bridge:
expenses-excluding-depreciation `12,096` + depreciation/amortisation/impairment `7,079` = `19,175`,
which equals the B1-1 "Total functions and activities" expense total. Lockhart prints eight non-zero
revenue lines (including other income and a net gain on disposal) and four expense lines (including
borrowing costs). The Comprehensive Income statement labels its total-OCI line "Other comprehensive
income for the year" (no "Total" prefix), which the adapter reads explicitly.

## 4. Reconciliation (zero tolerance)

All arithmetic is in whole printed `$ '000` values:

```text
revenue components:
  4,311 + 1,226 + 811 + 10,823 + 2,698 + 246 + 179 + 6 = 20,300
  = printed Total income

expense components:
  4,551 + 6,295 + 125 + 1,125 = 12,096
  = printed expenses excluding depreciation

total expenses:
  12,096 + 7,079 = 19,175
  = printed B1-1 Total functions and activities expenses

operating result / net result:
  20,300 - 19,175 = 1,125
  = printed Operating result and net result

before capital grants:
  1,125 - 2,698 = (1,573)
  = printed before-capital result (evidence only)

B1-1 grants and contributions:
  10,823 + 2,698 = 13,521
  = printed B1-1 grants total

other comprehensive income:
  revaluation 30,885 = 30,885
  = printed "Other comprehensive income for the year"

comprehensive income:
  1,125 + 30,885 = 32,010
  = printed Total comprehensive income
```

The adapter defers the document with **0 rows** if any printed line is missing, if the unit is not
thousands, or if any of these bridges differs by one thousand. On the audited FY2025-26 report there
is no deferral.

## 5. Extracted entity rows (17, non-additive)

| `gpfs_line_item`                        | Printed/derived label                        | `$ '000` | `amount_cents` | Section  |
| --------------------------------------- | -------------------------------------------- | -------: | -------------: | -------- |
| `rates_and_annual_charges`              | Rates and annual charges                     |    4,311 |    431,100,000 | revenue  |
| `user_charges_and_fees`                 | User charges and fees                        |    1,226 |    122,600,000 | revenue  |
| `other_revenues`                        | Other revenues                               |      811 |     81,100,000 | revenue  |
| `government_grants_operating`           | Grants and contributions — operating         |   10,823 |  1,082,300,000 | revenue  |
| `government_grants_capital`             | Grants and contributions — capital           |    2,698 |    269,800,000 | revenue  |
| `interest_and_investment_income`        | Interest and investment income               |      246 |     24,600,000 | revenue  |
| `other_income`                          | Other income                                 |      179 |     17,900,000 | revenue  |
| `net_gain_from_disposal_of_assets`      | Net gain from the disposal of assets         |        6 |        600,000 | revenue  |
| `total_revenue`                         | Total income from continuing operations      |   20,300 |  2,030,000,000 | revenue  |
| `employee_expenses`                     | Employee benefits and on-costs               |    4,551 |    455,100,000 | expenses |
| `materials_and_services`                | Materials and services                       |    6,295 |    629,500,000 | expenses |
| `borrowing_costs`                       | Borrowing costs                              |      125 |     12,500,000 | expenses |
| `other_expenses`                        | Other expenses                               |    1,125 |    112,500,000 | expenses |
| `total_expenses_excluding_depreciation` | Total expenses excluding depreciation        |   12,096 |  1,209,600,000 | expenses |
| `depreciation_amortisation_impairment`  | Depreciation, amortisation and impairment    |    7,079 |    707,900,000 | expenses |
| `total_expenses`                        | Total expenses (documented bridge)           |   19,175 |  1,917,500,000 | expenses |
| `net_result`                            | Net operating result attributable to Council |    1,125 |    112,500,000 | result   |

Every row is `jurisdiction_level: "local"`, `jurisdiction: "NSW"`,
`delivery_entity: "Lockhart Shire Council"`, `aggregation_role: "agency_detail"`,
`measure_type: "actual"`, `verified: false`, `data_quality_flag: "provisional/local_government"`.
Government grant rows carry `potential_double_count: true`.

## 6. No-total / no-cross-council rule

- Lockhart Shire Council is one entity. No council total, no state/national total and no sum with
  another council, the `dubbo-council` budget/estimate rows, a government program, the PNFC benchmark
  or the OLG summary layer is created.
- The FY2025-26 column is the reporting boundary; the FY2024-25 comparative is not added.
- Revenue, expenses, components and the net result overlap. They are published rows, not an additive
  spending series.
- Every row is `agency_detail` with no `region_id` and no `location`/LGA allocation.

## 7. How to verify

```bash
# Official page and the exact PDF.
curl -sL -o /dev/null -w '%{http_code}\n' 'https://lockhart.nsw.gov.au/council/council-policies-plans-reports/'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  'https://lockhart.nsw.gov.au/wp-content/uploads/2026/11/Annual_Financial_Statements-2026-3-in-1.pdf'

# Focused connector tests (15).
TEST_MONGO_URL="mongodb://localhost:27022/ausspend_test_lockhartgpfs" \
  npx vitest run --project server server/test/lockhart-gpfs.test.ts
```

The focused suite covers the unit gate, exact reconciliation/zero tolerance, FY2025-26 stale-year
rejection and no-substitution of another year, natural-key/idempotency, no-cross-council totals and
discovery/latest selection (including the documented official fallback pin).
