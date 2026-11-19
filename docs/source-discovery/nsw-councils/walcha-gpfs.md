# NSW council GPFS — Walcha Council FY2024-25 evidence

**Status:** implementation evidence only. One council, one audited year. The exact PDF is archived
outside the repo; no PDF or raw table is committed. **Entity:** Walcha Council only.
**No council total, no state or national total, no OLG summary layer, no SOC/other council rows.**
The FY2024-25 column is used; the FY2023-24 comparative inside the statement is never added.

**Checked:** 2026-11-19 (Australia/Sydney).

## 0. Fiscal-year decision (current-available, not calendar)

FY2024-25 is the **latest audited standalone General Purpose Financial Statements** published by the
council at 2026-11-19. The council has **not posted an FY2025-26 GPFS**, and its annual-report page is
stale (latest posted 2022-23). The accepted current-available year is therefore FY2024-25; the
connector targets `2024-25`, and its stale-year guard rejects other years rather than silently
substituting a 2025-26 or 2023-24 document.

## 1. Discovery and access log

| Step                              | URL                                                                                          | HTTP    | Result                                                       |
| --------------------------------- | -------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------ |
| Official 2024-2025 Financial Statements page | <https://walcha.nsw.gov.au/2024-2025-financial-statements/>                       | **200** | `text/html`; links the GPFS, special-purpose and special-schedules PDFs. |
| Audited FY2024-25 GPFS            | <https://walcha.nsw.gov.au/wp-content/uploads/2025/12/Walcha-Council-General-Purpose-Financial-Statements-20242025.pdf> | **200** | `application/pdf`, 1,883,547 bytes, 77 PDF pages.            |

The connector parses the official page, selects the **General Purpose** Financial Statements anchor,
and rejects the special-purpose and special-schedules PDFs, the annual report link and prior years. A
documented official fallback pin is used only if the page yields no usable anchor. The exact bytes are
SHA-256 re-verified before parsing.

## 2. Exact document

- **Title:** General Purpose Financial Statements 2024-2025.
- **Financial year:** 2024-25, for the year ended 30 June 2025.
- **URL:** `https://walcha.nsw.gov.au/wp-content/uploads/2025/12/Walcha-Council-General-Purpose-Financial-Statements-20242025.pdf`
- **Bytes:** 1,883,547.
- **PDF pages:** 77.
- **SHA-256:** `cc328f754a73a986cb4161cfcd462343b0b5893e85956cc03edb23f04b513e6c`.
- **Archive:** `walcha-gpfs/` under the configured source-archive root (outside the repo; not
  committed). It holds the exact PDF plus archive metadata (URL, retrieval date, bytes, SHA-256,
  content type) and the archive record. The connector re-verifies the hash before parsing.

## 3. Printed unit and statement

The Income Statement is on PDF page 6 (printed page 5). It prints `$ '000` for the 2025 columns. The
unit gate requires **`$ '000` / thousands**; a plain `$`, `$M` or unit-less read is rejected. The
adapter reads the FY2024-25 Actual column only.

The FY2024-25 column prints (whole `$ '000`):

```text
Income from continuing operations
  Rates and annual charges                               7,380
  User charges and fees                                  5,990
  Other revenues                                           654
  Grants and contributions provided for operating purposes 6,598
  Grants and contributions provided for capital purposes 12,185
  Interest and investment income                           872
  Other income                                             843
  Net gain from the disposal of assets                       – (nil)
  Total income from continuing operations                34,522
Expenses from continuing operations
  Employee benefits and on-costs                         9,214
  Materials and services                                 8,537
  Borrowing costs                                          177
  Other expenses                                           425
  Net loss from the disposal of assets                     722
  Total expenses ... excluding depreciation             19,075
  Depreciation, amortisation and impairment              5,112
  Operating result from continuing operations            10,335
  Business combinations — Gain from business combinations 7,520
  Net operating result attributable to Council           17,855
  Net operating result before capital grants              5,670
```

The statement prints **no Total expenses line**. Total expenses is the printed face bridge:
expenses-excluding-depreciation `19,075` + depreciation/amortisation/impairment `5,112` = `24,187`,
which equals the B1-1 "Total functions and activities" expense total. Walcha also prints a
**below-the-line** "Business combinations — Gain from business combinations" (`7,520`) between the
operating result and the net result.

## 4. Reconciliation (zero tolerance)

All arithmetic is in whole printed `$ '000` values:

```text
revenue components:
  7,380 + 5,990 + 654 + 6,598 + 12,185 + 872 + 843 = 34,522
  = printed Total income

expense components:
  9,214 + 8,537 + 177 + 425 + 722 = 19,075
  = printed expenses excluding depreciation

total expenses:
  19,075 + 5,112 = 24,187
  = printed B1-1 Total functions and activities expenses

operating result:
  34,522 - 24,187 = 10,335
  = printed Operating result

net result:
  10,335 + 7,520 business-combination gain = 17,855
  = printed Net operating result attributable to Council

before capital grants:
  17,855 - 12,185 = 5,670
  = printed before-capital result (evidence only)

B1-1:
  income 34,522 + 7,520 = 42,042
  expenses = 24,187
  operating result = 17,855 = printed net result
  grants 6,598 + 12,185 = 18,783

other comprehensive income:
  revaluation 37,537 = 37,537
  = printed Total other comprehensive income and Total items not reclassified

comprehensive income:
  17,855 + 37,537 = 55,392
  = printed Total comprehensive income
```

B1-1 income is **not** the face total revenue: it includes the business-combination gain. The adapter
checks `B1-1 income = face total revenue + business-combination gain`, `B1-1 operating result =
printed net result` and `B1-1 income − B1-1 expenses = printed net result`. The business-combination
gain and before-capital result are retained in reconciliation evidence only, not emitted as rows.

The adapter defers the document with **0 rows** if any printed line is missing, if the unit is not
thousands, or if any of these bridges differs by one thousand. On the audited FY2024-25 report there
is no deferral.

## 5. Extracted entity rows (17, non-additive)

| `gpfs_line_item`                        | Printed/derived label                        | `$ '000` | `amount_cents` | Section  |
| --------------------------------------- | -------------------------------------------- | -------: | -------------: | -------- |
| `rates_and_annual_charges`              | Rates and annual charges                     |    7,380 |    738,000,000 | revenue  |
| `user_charges_and_fees`                 | User charges and fees                        |    5,990 |    599,000,000 | revenue  |
| `other_revenues`                        | Other revenues                               |      654 |     65,400,000 | revenue  |
| `government_grants_operating`           | Grants and contributions — operating         |    6,598 |    659,800,000 | revenue  |
| `government_grants_capital`             | Grants and contributions — capital           |   12,185 |  1,218,500,000 | revenue  |
| `interest_and_investment_income`        | Interest and investment income               |      872 |     87,200,000 | revenue  |
| `other_income`                          | Other income                                 |      843 |     84,300,000 | revenue  |
| `total_revenue`                         | Total income from continuing operations      |   34,522 |  3,452,200,000 | revenue  |
| `employee_expenses`                     | Employee benefits and on-costs               |    9,214 |    921,400,000 | expenses |
| `materials_and_services`                | Materials and services                       |    8,537 |    853,700,000 | expenses |
| `borrowing_costs`                       | Borrowing costs                              |      177 |     17,700,000 | expenses |
| `other_expenses`                        | Other expenses                               |      425 |     42,500,000 | expenses |
| `net_loss_from_disposal_of_assets`      | Net loss from the disposal of assets         |      722 |     72,200,000 | expenses |
| `total_expenses_excluding_depreciation` | Total expenses excluding depreciation        |   19,075 |  1,907,500,000 | expenses |
| `depreciation_amortisation_impairment`  | Depreciation, amortisation and impairment    |    5,112 |    511,200,000 | expenses |
| `total_expenses`                        | Total expenses (documented bridge)           |   24,187 |  2,418,700,000 | expenses |
| `net_result`                            | Net operating result attributable to Council |   17,855 |  1,785,500,000 | result   |

Every row is `jurisdiction_level: "local"`, `jurisdiction: "NSW"`,
`delivery_entity: "Walcha Council"`, `aggregation_role: "agency_detail"`,
`measure_type: "actual"`, `verified: false`, `data_quality_flag: "provisional/local_government"`.
Government grant rows carry `potential_double_count: true`.

## 6. No-total / no-cross-council rule

- Walcha Council is one entity. No council total, no state/national total and no sum with another
  council, the `dubbo-council` budget/estimate rows, a government program, the PNFC benchmark or the
  OLG summary layer is created.
- The FY2024-25 column is the reporting boundary; the FY2023-24 comparative is not added.
- Revenue, expenses, components and the net result overlap. They are published rows, not an additive
  spending series.
- Every row is `agency_detail` with no `region_id` and no `location`/LGA allocation.

## 7. How to verify

```bash
# Official page and the exact GPFS PDF.
curl -sL -o /dev/null -w '%{http_code}\n' 'https://walcha.nsw.gov.au/2024-2025-financial-statements/'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  'https://walcha.nsw.gov.au/wp-content/uploads/2025/12/Walcha-Council-General-Purpose-Financial-Statements-20242025.pdf'

# Focused connector tests (17).
TEST_MONGO_URL="mongodb://localhost:27025/ausspend_test_walchagpfs" \
  npx vitest run --project server server/test/walcha-gpfs.test.ts
```

The focused suite covers the unit gate, exact reconciliation/zero tolerance (including the
business-combination bridge and B1-1 income), FY2024-25 current-available acceptance and rejection of
2023-24/2025-26 substitutions, natural-key/idempotency, no-cross-council totals and discovery/latest
selection (including the documented official fallback pin).
