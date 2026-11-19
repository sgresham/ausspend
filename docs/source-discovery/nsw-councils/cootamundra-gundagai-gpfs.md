# NSW council GPFS — Cootamundra-Gundagai Regional Council FY2024-25 evidence

**Status:** implementation evidence only. One council, one audited year. The exact PDF is archived
outside the repo; no PDF or raw table is committed. **Entity:** Cootamundra-Gundagai Regional Council
only. **No council total, no state or national total, no OLG summary layer, no SOC/other council
rows.** The FY2024-25 column is used; the FY2023-24 comparative inside the statement is never added.

**Checked:** 2026-11-19 (Australia/Sydney).

## 0. Fiscal-year decision (latest audited, not current calendar)

FY2024-25 is the **latest audited standalone General Purpose Financial Statements** published by the
council at 2026-11-19. The council has **not published an FY2025-26 GPFS** yet. The brief's accepted
current-available year is therefore FY2024-25; the connector targets `2024-25`, and its stale-year
guard rejects other years rather than silently substituting a 2025-26 or 2023-24 document.

## 1. Discovery and access log

| Step                                              | URL                                                                                                                                     | HTTP    | Result                                                               |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------- | -------------------------------------------------------------------- |
| Official Annual Reports and Progress Reports page | <https://www.cgrc.nsw.gov.au/council-plans-and-reports/annual-reports-and-progress-reports/>                                            | **200** | `text/html`; lists the audited FY2024-25 statements and prior years. |
| Audited FY2024-25 statements                      | <https://www.cgrc.nsw.gov.au/wp-content/uploads/2026/01/Cootamundra-Gundagai-Regional-Council-Financial-Statements-2024-25-Audited.pdf> | **200** | `application/pdf`, 2,565,827 bytes, 103 PDF pages.                   |

The connector parses the official page, selects the FY2024-25 audited statements upload, and ignores
annual reports, public notices and prior years. A documented official fallback pin is used only if
the page yields no usable anchor. The exact bytes are SHA-256 re-verified before parsing.

## 2. Exact document

- **Title:** Cootamundra-Gundagai Regional Council Financial Statements 2024-25 (Audited).
- **Financial year:** 2024-25, for the year ended 30 June 2025.
- **URL:** `https://www.cgrc.nsw.gov.au/wp-content/uploads/2026/01/Cootamundra-Gundagai-Regional-Council-Financial-Statements-2024-25-Audited.pdf`
- **Bytes:** 2,565,827.
- **PDF pages:** 103.
- **SHA-256:** `d53910f5cb422c4f8b85872156805d3b3a21a910fb2fcbf4e472bcad1af13599`.
- **Archive root:** `~/ausspend-source-archive/cootamundra-gundagai-gpfs/` (outside the repo; not
  committed). It holds the exact PDF plus archive metadata (URL, retrieval date, bytes, SHA-256) and
  the archive record. The connector re-verifies the hash before parsing.

## 3. Printed unit and statement

The Income Statement is on PDF page 5 (printed page 4 of 79). It prints `$ '000` for the 2025
columns. The unit gate requires **`$ '000` / thousands**; a plain `$`, `$M` or unit-less read is
rejected. The adapter reads the FY2024-25 Actual column only.

The FY2024-25 column prints (whole `$ '000`):

```text
Income from continuing operations
  Rates and annual charges                               19,807
  User charges and fees                                  14,182
  Other revenues                                            885
  Grants and contributions provided for operating purposes 9,263
  Grants and contributions provided for capital purposes   6,300
  Interest and investment income                          1,683
  Other income                                              994
  Total income from continuing operations                 53,114
Expenses from continuing operations
  Employee benefits and on-costs                         14,801
  Materials and services                                 23,282
  Borrowing costs                                           298
  Other expenses                                          1,435
  Net loss from the disposal of assets                    2,242
  Total expenses ... excluding depreciation              42,058
  Depreciation, amortisation and impairment              13,274
  Operating result from continuing operations             (2,218)
  Net operating result for the year attributable to Council (2,218)
  Net operating result before capital grants              (8,518)
```

The statement prints **no Total expenses line**. Total expenses is the printed face bridge:
expenses-excluding-depreciation `42,058` + depreciation/amortisation/impairment `13,274` = `55,332`,
which equals the B1-1 "Total functions and activities" expense total. CGRC prints seven revenue lines
(including other income; its net gain on disposal is nil) and five expense lines (including borrowing
costs and a net loss on disposal).

## 4. Reconciliation (zero tolerance)

All arithmetic is in whole printed `$ '000` values:

```text
revenue components:
  19,807 + 14,182 + 885 + 9,263 + 6,300 + 1,683 + 994 = 53,114
  = printed Total income

expense components:
  14,801 + 23,282 + 298 + 1,435 + 2,242 = 42,058
  = printed expenses excluding depreciation

total expenses:
  42,058 + 13,274 = 55,332
  = printed B1-1 Total functions and activities expenses

operating result:
  53,114 - 55,332 = (2,218)
  = printed Operating result and net operating result

before capital grants:
  (2,218) - 6,300 = (8,518)
  = printed before-capital result (evidence only)

B1-1 grants and contributions:
  9,263 + 6,300 = 15,563
  = printed B1-1 grants total

comprehensive income:
  (2,218) + 17,777 other comprehensive income = 15,559
  = printed Total comprehensive income
```

The adapter defers the document with **0 rows** if any printed line is missing, if the unit is not
thousands, or if any of these bridges differs by one thousand. On the audited FY2024-25 report there
is no deferral.

## 5. Extracted entity rows (17, non-additive)

| `gpfs_line_item`                        | Printed/derived label                        | `$ '000` | `amount_cents` | Section                       |
| --------------------------------------- | -------------------------------------------- | -------: | -------------: | ----------------------------- |
| `rates_and_annual_charges`              | Rates and annual charges                     |   19,807 |  1,980,700,000 | revenue                       |
| `user_charges_and_fees`                 | User charges and fees                        |   14,182 |  1,418,200,000 | revenue                       |
| `other_revenues`                        | Other revenues                               |      885 |     88,500,000 | revenue                       |
| `government_grants_operating`           | Grants and contributions — operating         |    9,263 |    926,300,000 | revenue                       |
| `government_grants_capital`             | Grants and contributions — capital           |    6,300 |    630,000,000 | revenue                       |
| `interest_and_investment_income`        | Interest and investment income               |    1,683 |    168,300,000 | revenue                       |
| `other_income`                          | Other income                                 |      994 |     99,400,000 | revenue                       |
| `total_revenue`                         | Total income from continuing operations      |   53,114 |  5,311,400,000 | revenue                       |
| `employee_expenses`                     | Employee benefits and on-costs               |   14,801 |  1,480,100,000 | expenses                      |
| `materials_and_services`                | Materials and services                       |   23,282 |  2,328,200,000 | expenses                      |
| `borrowing_costs`                       | Borrowing costs                              |      298 |     29,800,000 | expenses                      |
| `other_expenses`                        | Other expenses                               |    1,435 |    143,500,000 | expenses                      |
| `net_loss_from_disposal_of_assets`      | Net loss from the disposal of assets         |    2,242 |    224,200,000 | expenses                      |
| `total_expenses_excluding_depreciation` | Total expenses excluding depreciation        |   42,058 |  4,205,800,000 | expenses                      |
| `depreciation_amortisation_impairment`  | Depreciation, amortisation and impairment    |   13,274 |  1,327,400,000 | expenses                      |
| `total_expenses`                        | Total expenses (documented bridge)           |   55,332 |  5,533,200,000 | expenses                      |
| `net_result`                            | Net operating result attributable to Council |  (2,218) |    221,800,000 | result (negative sign marker) |

Every row is `jurisdiction_level: "local"`, `jurisdiction: "NSW"`,
`delivery_entity: "Cootamundra-Gundagai Regional Council"`, `aggregation_role: "agency_detail"`,
`measure_type: "actual"`, `verified: false`, `data_quality_flag: "provisional/local_government"`.
Government grant rows carry `potential_double_count: true`. The `net_result` row stores a non-negative
magnitude and carries `gpfs_printed_sign: "negative"`.

## 6. No-total / no-cross-council rule

- Cootamundra-Gundagai Regional Council is one entity. No council total, no state/national total and
  no sum with another council, the `dubbo-council` budget/estimate rows, a government program, the
  PNFC benchmark or the OLG summary layer is created.
- The FY2024-25 column is the reporting boundary; the FY2023-24 comparative is not added.
- Revenue, expenses, components and the net result overlap. They are published rows, not an
  additive spending series.
- Every row is `agency_detail` with no `region_id` and no `location`/LGA allocation.

## 7. How to verify

```bash
# Annual Reports page lists the audited statements; the current upload is a native PDF.
curl -sL -o /dev/null -w '%{http_code}\n' \
  'https://www.cgrc.nsw.gov.au/council-plans-and-reports/annual-reports-and-progress-reports/'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  'https://www.cgrc.nsw.gov.au/wp-content/uploads/2026/01/Cootamundra-Gundagai-Regional-Council-Financial-Statements-2024-25-Audited.pdf'

# Focused connector tests (15).
TEST_MONGO_URL="mongodb://localhost:27017/ausspend_test_cgrc" \
  npx vitest run --project server server/test/cootamundra-gundagai-gpfs.test.ts
```

The focused suite covers the unit gate, exact reconciliation/zero tolerance (including a negative net
result), FY2024-25 stale-year rejection and no-substitution of a different year, natural-key/
idempotency, no-cross-council totals and discovery/latest selection (including the documented official
fallback pin).
