# NSW council GPFS — Bourke Shire Council FY2025-26 evidence

**Status:** implementation evidence only. One council, one audited year. The exact PDF is archived
outside the repo; no PDF or raw table is committed. **Entity:** Bourke Shire Council only.
**No council total, no state or national total, no OLG summary layer, no SOC/other council rows.**
The FY2025-26 column is used; the FY2024-25 comparative inside the statement is never added.

**Checked:** 2026-11-19 (Australia/Sydney).

## 0. Fiscal-year decision

FY2025-26 is the **latest audited standalone General Purpose Financial Statements** published by the
council at 2026-11-19 (for the year ended 30 June 2026, authorised for issue on 28 September 2026).
The connector targets `2025-26`, and its stale-year guard rejects other years rather than silently
substituting a prior-year statement, annual report, budget review or notice.

## 1. Discovery and access log

| Step                              | URL                                                                                          | HTTP    | Result                                                       |
| --------------------------------- | -------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------ |
| Official Reports page             | <https://bourke.nsw.gov.au/council/reports/>                                                 | **200** | `text/html`; lists the FY2025-26 statements and prior years. |
| Audited FY2025-26 statements      | <https://bourke.nsw.gov.au/wp-content/uploads/2026/10/Annual-Financial-Statements-2025-2026.pdf> | **200** | `application/pdf`, 3,413,641 bytes, 88 PDF pages.            |

The connector parses the official Reports page, selects the FY2025-26 statements upload, and ignores
annual reports, quarterly budget review statements (QBRS), public notices, special-purpose
statements and prior years. A documented official fallback pin is used only if the page yields no
usable anchor. The WordPress media path carries an upload year/month (`/2026/10/`); the fiscal-year
parser skips that non-consecutive `2026-10` candidate and reads the document's `2025-2026` range. The
exact bytes are SHA-256 re-verified before parsing.

## 2. Exact document

- **Title:** Annual Financial Statements 2025-2026.
- **Financial year:** 2025-26, for the year ended 30 June 2026.
- **URL:** `https://bourke.nsw.gov.au/wp-content/uploads/2026/10/Annual-Financial-Statements-2025-2026.pdf`
- **Bytes:** 3,413,641.
- **PDF pages:** 88.
- **SHA-256:** `9441ad45d329e66ed888da82673e027b4d662b858308b4bb5ddd14ce1b41bce5`.
- **Archive:** `bourke-gpfs/` under the configured source-archive root (outside the repo; not
  committed). It holds the exact PDF plus archive metadata (original URL, retrieval date, bytes,
  SHA-256, content type) and the archive record. The connector re-verifies the hash before parsing.

## 3. Printed unit and statement

The Income Statement is on PDF page 6 (printed page 5 of 88). It prints `$ '000` for the 2026 columns.
The unit gate requires **`$ '000` / thousands**; a plain `$`, `$M` or unit-less read is rejected. The
adapter reads the FY2025-26 Actual column only.

The FY2025-26 column prints (whole `$ '000`):

```text
Income from continuing operations
  Rates and annual charges                               5,024
  User charges and fees                                  7,180
  Other revenues                                         2,220
  Grants and contributions provided for operating purposes 30,590
  Grants and contributions provided for capital purposes  4,172
  Interest and investment income                         1,599
  Other income                                             358
  Net gain from the disposal of assets                       – (nil)
  Total income from continuing operations                51,143
Expenses from continuing operations
  Employee benefits and on-costs                         9,206
  Materials and services                                17,915
  Borrowing costs                                          196
  Other expenses                                           642
  Net loss from the disposal of assets                     280
  Total expenses ... excluding depreciation             28,239
  Depreciation, amortisation and impairment              10,895
  Operating result from continuing operations            12,009
  Net operating result for the year attributable to Council 12,009
  Net operating result before capital grants              7,837
```

The statement prints **no Total expenses line**. Total expenses is the printed face bridge:
expenses-excluding-depreciation `28,239` + depreciation/amortisation/impairment `10,895` = `39,134`,
which equals the B1-1 "Total functions and activities" expense total. Bourke prints seven non-zero
revenue lines (its net gain on disposal is nil, so it is not emitted) and five expense lines
(including borrowing costs and a net loss on disposal).

## 4. Reconciliation (zero tolerance)

All arithmetic is in whole printed `$ '000` values:

```text
revenue components:
  5,024 + 7,180 + 2,220 + 30,590 + 4,172 + 1,599 + 358 = 51,143
  = printed Total income

expense components:
  9,206 + 17,915 + 196 + 642 + 280 = 28,239
  = printed expenses excluding depreciation

total expenses:
  28,239 + 10,895 = 39,134
  = printed B1-1 Total functions and activities expenses

operating result / net result:
  51,143 - 39,134 = 12,009
  = printed Operating result and net result

before capital grants:
  12,009 - 4,172 = 7,837
  = printed before-capital result (evidence only)

B1-1 grants and contributions:
  30,590 + 4,172 = 34,762
  = printed B1-1 grants total

comprehensive income:
  12,009 + 22,603 other comprehensive income = 34,612
  = printed Total comprehensive income
```

The adapter defers the document with **0 rows** if any printed line is missing, if the unit is not
thousands, or if any of these bridges differs by one thousand. On the audited FY2025-26 report there
is no deferral.

## 5. Extracted entity rows (17, non-additive)

| `gpfs_line_item`                        | Printed/derived label                       | `$ '000` | `amount_cents` | Section  |
| --------------------------------------- | ------------------------------------------- | -------: | -------------: | -------- |
| `rates_and_annual_charges`              | Rates and annual charges                    |    5,024 |    502,400,000 | revenue  |
| `user_charges_and_fees`                 | User charges and fees                       |    7,180 |    718,000,000 | revenue  |
| `other_revenues`                        | Other revenues                              |    2,220 |    222,000,000 | revenue  |
| `government_grants_operating`           | Grants and contributions — operating        |   30,590 |  3,059,000,000 | revenue  |
| `government_grants_capital`             | Grants and contributions — capital          |    4,172 |    417,200,000 | revenue  |
| `interest_and_investment_income`        | Interest and investment income              |    1,599 |    159,900,000 | revenue  |
| `other_income`                          | Other income                                |      358 |     35,800,000 | revenue  |
| `total_revenue`                         | Total income from continuing operations     |   51,143 |  5,114,300,000 | revenue  |
| `employee_expenses`                     | Employee benefits and on-costs              |    9,206 |    920,600,000 | expenses |
| `materials_and_services`                | Materials and services                      |   17,915 |  1,791,500,000 | expenses |
| `borrowing_costs`                       | Borrowing costs                             |      196 |     19,600,000 | expenses |
| `other_expenses`                        | Other expenses                              |      642 |     64,200,000 | expenses |
| `net_loss_from_disposal_of_assets`      | Net loss from the disposal of assets        |      280 |     28,000,000 | expenses |
| `total_expenses_excluding_depreciation` | Total expenses excluding depreciation       |   28,239 |  2,823,900,000 | expenses |
| `depreciation_amortisation_impairment`  | Depreciation, amortisation and impairment   |   10,895 |  1,089,500,000 | expenses |
| `total_expenses`                        | Total expenses (documented bridge)          |   39,134 |  3,913,400,000 | expenses |
| `net_result`                            | Net operating result attributable to Council |   12,009 |  1,200,900,000 | result   |

Every row is `jurisdiction_level: "local"`, `jurisdiction: "NSW"`,
`delivery_entity: "Bourke Shire Council"`, `aggregation_role: "agency_detail"`,
`measure_type: "actual"`, `verified: false`, `data_quality_flag: "provisional/local_government"`.
Government grant rows carry `potential_double_count: true`.

## 6. No-total / no-cross-council rule

- Bourke Shire Council is one entity. No council total, no state/national total and no sum with
  another council, the `dubbo-council` budget/estimate rows, a government program, the PNFC benchmark
  or the OLG summary layer is created.
- The FY2025-26 column is the reporting boundary; the FY2024-25 comparative is not added.
- Revenue, expenses, components and the net result overlap. They are published rows, not an additive
  spending series.
- Every row is `agency_detail` with no `region_id` and no `location`/LGA allocation.

## 7. How to verify

```bash
# Official page lists the statements; the current upload is a native PDF.
curl -sL -o /dev/null -w '%{http_code}\n' 'https://bourke.nsw.gov.au/council/reports/'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  'https://bourke.nsw.gov.au/wp-content/uploads/2026/10/Annual-Financial-Statements-2025-2026.pdf'

# Focused connector tests (15).
TEST_MONGO_URL="mongodb://localhost:27019/ausspend_test_bourkegpfs" \
  npx vitest run --project server server/test/bourke-gpfs.test.ts
```

The focused suite covers the unit gate, exact reconciliation/zero tolerance, FY2025-26 stale-year
rejection and no-substitution of another year, natural-key/idempotency, no-cross-council totals and
discovery/latest selection (including the documented official fallback pin).
