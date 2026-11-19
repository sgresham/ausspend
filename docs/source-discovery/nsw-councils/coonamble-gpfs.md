# NSW council GPFS — Coonamble Shire Council FY2024-25 evidence

**Status:** implementation evidence only. One council, one audited year. The exact PDF is archived
outside the repo; no PDF or raw table is committed. **Entity:** Coonamble Shire Council only.
**No council total, no state or national total, no OLG summary layer, no SOC/other council rows.**
The FY2024-25 column is used; the FY2023-24 comparative inside the statement is never added.

**Checked:** 2026-11-19 (Australia/Sydney).

## 0. Fiscal-year decision (current-available, not calendar)

FY2024-25 is the **latest audited standalone General Purpose Financial Statements** published by the
council at 2026-11-19. The council has **not posted an FY2025-26 GPFS**. The accepted
current-available year is therefore FY2024-25; the connector targets `2024-25`, and its stale-year
guard rejects other years rather than silently substituting a 2025-26 or 2023-24 document.

The correct domain is `coonambleshire.nsw.gov.au`; `coonamble.nsw.gov.au` does not resolve. Plain
fetch works (no browser-UA workaround is needed).

## 1. Discovery and access log

| Step                              | URL                                                                                          | HTTP    | Result                                                       |
| --------------------------------- | -------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------ |
| Official Annual Reports page      | <https://www.coonambleshire.nsw.gov.au/council/annual-report>                                | **200** | `text/html`; lists the FY2024-25 statements and prior years. |
| Audited FY2024-25 statements      | <https://www.coonambleshire.nsw.gov.au/Annual_Financial_Statements-2025%20final%20audited.pdf> | **200** | `application/pdf`, 3,992,002 bytes, 118 PDF pages.           |

The connector parses the official page, selects the FY2024-25 statements upload, and ignores annual
reports, annual-report PDFs and prior years. A documented official fallback pin is used only if the
page yields no usable anchor. The exact bytes are SHA-256 re-verified before parsing.

## 2. Exact document

- **Title:** Annual Financial Statement 2024-25 (final audited).
- **Financial year:** 2024-25, for the year ended 30 June 2025.
- **URL:** `https://www.coonambleshire.nsw.gov.au/Annual_Financial_Statements-2025%20final%20audited.pdf`
- **Bytes:** 3,992,002.
- **PDF pages:** 118.
- **SHA-256:** `b58ac76bad53bf610f1ea4f9aeff36e8ecd1eacf3416d41662dd568edf1c1b94`.
- **Archive:** `coonamble-gpfs/` under the configured source-archive root (outside the repo; not
  committed). It holds the exact PDF plus archive metadata (URL, retrieval date, bytes, SHA-256,
  content type) and the archive record. The connector re-verifies the hash before parsing.

## 3. Printed unit and statement

The Income Statement is on PDF page 6 (printed page 5 of 91). It prints `$ '000` for the 2025 columns.
The unit gate requires **`$ '000` / thousands**; a plain `$`, `$M` or unit-less read is rejected. The
adapter reads the FY2024-25 Actual column only.

The FY2024-25 column prints (whole `$ '000`):

```text
Income from continuing operations
  Rates and annual charges                               7,960
  User charges and fees                                 10,335
  Other revenues                                         1,825
  Grants and contributions provided for operating purposes 10,385
  Grants and contributions provided for capital purposes  4,308
  Interest and investment income                         1,334
  Other income                                             117
  Net gain from the disposal of assets                      82
  Total income from continuing operations                36,346
Expenses from continuing operations
  Employee benefits and on-costs                        11,784
  Materials and services                                13,220
  Borrowing costs                                           32
  Other expenses                                         1,051
  Total expenses ... excluding depreciation             26,087
  Depreciation, amortisation and impairment              8,057
  Operating result from continuing operations             2,202
  Net operating result attributable to Council            2,202
  Net operating result before capital grants             (2,106)
```

The statement prints **no Total expenses line** and **no net loss on disposal line**. Total expenses
is the printed face bridge: expenses-excluding-depreciation `26,087` +
depreciation/amortisation/impairment `8,057` = `34,144`, which equals the B1-1 "Total functions and
activities" expense total. Coonamble prints eight non-zero revenue lines (including other income and a
net gain on disposal) and four expense lines (including borrowing costs).

## 4. Reconciliation (zero tolerance)

All arithmetic is in whole printed `$ '000` values:

```text
revenue components:
  7,960 + 10,335 + 1,825 + 10,385 + 4,308 + 1,334 + 117 + 82 = 36,346
  = printed Total income

expense components:
  11,784 + 13,220 + 32 + 1,051 = 26,087
  = printed expenses excluding depreciation

total expenses:
  26,087 + 8,057 = 34,144
  = printed B1-1 Total functions and activities expenses

operating result / net result:
  36,346 - 34,144 = 2,202
  = printed Operating result and net result

before capital grants:
  2,202 - 4,308 = (2,106)
  = printed before-capital result (evidence only)

B1-1 grants and contributions:
  10,385 + 4,308 = 14,693
  = printed B1-1 grants total

other comprehensive income:
  revaluation 10,355 = 10,355
  = printed Total other comprehensive income and Total items not reclassified

comprehensive income:
  2,202 + 10,355 = 12,557
  = printed Total comprehensive income
```

The adapter defers the document with **0 rows** if any printed line is missing, if the unit is not
thousands, or if any of these bridges differs by one thousand. On the audited FY2024-25 report there
is no deferral.

## 5. Extracted entity rows (17, non-additive)

| `gpfs_line_item`                        | Printed/derived label                        | `$ '000` | `amount_cents` | Section  |
| --------------------------------------- | -------------------------------------------- | -------: | -------------: | -------- |
| `rates_and_annual_charges`              | Rates and annual charges                     |    7,960 |    796,000,000 | revenue  |
| `user_charges_and_fees`                 | User charges and fees                        |   10,335 |  1,033,500,000 | revenue  |
| `other_revenues`                        | Other revenues                               |    1,825 |    182,500,000 | revenue  |
| `government_grants_operating`           | Grants and contributions — operating         |   10,385 |  1,038,500,000 | revenue  |
| `government_grants_capital`             | Grants and contributions — capital           |    4,308 |    430,800,000 | revenue  |
| `interest_and_investment_income`        | Interest and investment income               |    1,334 |    133,400,000 | revenue  |
| `other_income`                          | Other income                                 |      117 |     11,700,000 | revenue  |
| `net_gain_from_disposal_of_assets`      | Net gain from the disposal of assets         |       82 |      8,200,000 | revenue  |
| `total_revenue`                         | Total income from continuing operations      |   36,346 |  3,634,600,000 | revenue  |
| `employee_expenses`                     | Employee benefits and on-costs               |   11,784 |  1,178,400,000 | expenses |
| `materials_and_services`                | Materials and services                       |   13,220 |  1,322,000,000 | expenses |
| `borrowing_costs`                       | Borrowing costs                              |       32 |      3,200,000 | expenses |
| `other_expenses`                        | Other expenses                               |    1,051 |    105,100,000 | expenses |
| `total_expenses_excluding_depreciation` | Total expenses excluding depreciation        |   26,087 |  2,608,700,000 | expenses |
| `depreciation_amortisation_impairment`  | Depreciation, amortisation and impairment    |    8,057 |    805,700,000 | expenses |
| `total_expenses`                        | Total expenses (documented bridge)           |   34,144 |  3,414,400,000 | expenses |
| `net_result`                            | Net operating result attributable to Council |    2,202 |    220,200,000 | result   |

Every row is `jurisdiction_level: "local"`, `jurisdiction: "NSW"`,
`delivery_entity: "Coonamble Shire Council"`, `aggregation_role: "agency_detail"`,
`measure_type: "actual"`, `verified: false`, `data_quality_flag: "provisional/local_government"`.
Government grant rows carry `potential_double_count: true`.

## 6. No-total / no-cross-council rule

- Coonamble Shire Council is one entity. No council total, no state/national total and no sum with
  another council, the `dubbo-council` budget/estimate rows, a government program, the PNFC benchmark
  or the OLG summary layer is created.
- The FY2024-25 column is the reporting boundary; the FY2023-24 comparative is not added.
- Revenue, expenses, components and the net result overlap. They are published rows, not an additive
  spending series.
- Every row is `agency_detail` with no `region_id` and no `location`/LGA allocation.

## 7. How to verify

```bash
# Official page and the exact PDF.
curl -sL -o /dev/null -w '%{http_code}\n' 'https://www.coonambleshire.nsw.gov.au/council/annual-report'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  'https://www.coonambleshire.nsw.gov.au/Annual_Financial_Statements-2025%20final%20audited.pdf'

# Focused connector tests (16).
TEST_MONGO_URL="mongodb://localhost:27023/ausspend_test_coonamblegpfs" \
  npx vitest run --project server server/test/coonamble-gpfs.test.ts
```

The focused suite covers the unit gate, exact reconciliation/zero tolerance, FY2024-25
current-available acceptance and rejection of 2023-24/2025-26 substitutions, natural-key/idempotency,
no-cross-council totals and discovery/latest selection (including the documented official fallback
pin).
