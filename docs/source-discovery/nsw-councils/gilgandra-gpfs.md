# NSW council GPFS — Gilgandra Shire Council FY2025-26 evidence

**Status:** implementation evidence only. One council, one audited year. The exact PDF is archived
outside the repo; no PDF or raw table is committed. **Entity:** Gilgandra Shire Council only.
**No council total, no state or national total, no OLG summary layer, no SOC/other council rows.**
The FY2025-26 column is used; the FY2024-25 comparative inside the statement is never added.

**Checked:** 2026-11-19 (Australia/Sydney).

## 0. Fiscal-year decision

FY2025-26 is the **latest audited standalone General Purpose Financial Statements** published by the
council at 2026-11-19, for the year ended 30 June 2026 (auditor's report dated 29 October 2026). The
connector targets `2025-26`, and its stale-year guard rejects other years rather than silently
substituting a prior-year statement, annual report, budget or notice.

## 1. Discovery and access log (with UA probe)

| Step                              | URL                                                                                                | HTTP    | Result                                                                 |
| --------------------------------- | -------------------------------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------- |
| Official Financial Statements page (plain UA) | <https://www.gilgandra.nsw.gov.au/Your-Council/About-Council/Financial-information/Financial-Statements> | **200** | `text/html`; lists the FY2025-26 statements and prior years.      |
| Audited FY2025-26 statements (plain client UA) | <https://www.gilgandra.nsw.gov.au/files/assets/public/v/1/economic-development/inland-rail/submissions/annual_financial_statements-2026.pdf> | **200** | `application/pdf`, 1,365,525 bytes.                                   |
| Same PDF (bare Chrome UA)         | same URL                                                                                             | **403** | `text/html`, 545 bytes — WAF rejects a bare browser UA.                |

**Method recorded.** The host's Akamai WAF returns 200 `application/pdf` to a plain client UA
(`curl/8.5.0` or Node's default fetch) and 403 to a bare Chrome UA. The connector therefore sends an
explicit plain `curl/8.5.0` User-Agent (plus a broad PDF/HTML `Accept`) for both the listing and the
PDF; a focused test asserts that header is used and contains no `Chrome` token.

The connector parses the official page, selects the FY2025-26 statements upload, and ignores annual
reports, budget documents and prior years. A documented official fallback pin is used only if the page
yields no usable anchor. The exact bytes are SHA-256 re-verified before parsing.

## 2. Exact document

- **Title:** Annual Financial Statements 2026.
- **Financial year:** 2025-26, for the year ended 30 June 2026.
- **URL:** `https://www.gilgandra.nsw.gov.au/files/assets/public/v/1/economic-development/inland-rail/submissions/annual_financial_statements-2026.pdf`
- **Bytes:** 1,365,525.
- **PDF pages:** 98.
- **SHA-256:** `e7929405861b2e9d6e5da1422016eb96c44b437c8dba0a5999f4dbe748236ab0`.
- **Archive:** `gilgandra-gpfs/` under the configured source-archive root (outside the repo; not
  committed). It holds the exact PDF plus archive metadata (URL, retrieval date, bytes, SHA-256,
  content type) and the archive record. The connector re-verifies the hash before parsing.

## 3. Printed unit and statement

The Income Statement is on PDF page 6 (printed page 5 of 64). It prints `$ '000` for the 2026 columns.
The unit gate requires **`$ '000` / thousands**; a plain `$`, `$M` or unit-less read is rejected. The
adapter reads the FY2025-26 Actual column only.

The FY2025-26 column prints (whole `$ '000`):

```text
Income from continuing operations
  Rates and annual charges                               7,931
  User charges and fees                                 23,542
  Other revenues                                         1,072
  Grants and contributions provided for operating purposes 13,408
  Grants and contributions provided for capital purposes  4,067
  Interest and investment income                         1,854
  Net gain from the disposal of assets                     187
  Total income from continuing operations                52,061
Expenses from continuing operations
  Employee benefits and on-costs                        23,744
  Materials and services                                12,688
  Borrowing costs                                          182
  Other expenses                                           680
  Total expenses ... excluding depreciation             37,294
  Depreciation, amortisation and impairment              10,275
  Operating result from continuing operations             4,492
  Net operating result attributable to Council            4,492
  Net operating result before capital grants                425
```

The statement prints **no Total expenses line**, **no other-income line** and **no net loss on
disposal line**. Total expenses is the printed face bridge: expenses-excluding-depreciation `37,294`
+ depreciation/amortisation/impairment `10,275` = `47,569`, which equals the B1-1 "Total functions and
activities" expense total. Gilgandra prints seven non-zero revenue lines (including a net gain on
disposal) and four expense lines (including borrowing costs).

## 4. Reconciliation (zero tolerance)

All arithmetic is in whole printed `$ '000` values:

```text
revenue components:
  7,931 + 23,542 + 1,072 + 13,408 + 4,067 + 1,854 + 187 = 52,061
  = printed Total income

expense components:
  23,744 + 12,688 + 182 + 680 = 37,294
  = printed expenses excluding depreciation

total expenses:
  37,294 + 10,275 = 47,569
  = printed B1-1 Total functions and activities expenses

operating result / net result:
  52,061 - 47,569 = 4,492
  = printed Operating result and net result

before capital grants:
  4,492 - 4,067 = 425
  = printed before-capital result (evidence only)

B1-1 grants and contributions:
  13,408 + 4,067 = 17,475
  = printed B1-1 grants total

other comprehensive income:
  5,955 revaluation = 5,955
  = printed Total other comprehensive income and Total items not reclassified

comprehensive income:
  4,492 + 5,955 = 10,447
  = printed Total comprehensive income
```

The adapter defers the document with **0 rows** if any printed line is missing, if the unit is not
thousands, or if any of these bridges differs by one thousand. On the audited FY2025-26 report there
is no deferral.

## 5. Extracted entity rows (16, non-additive)

| `gpfs_line_item`                        | Printed/derived label                        | `$ '000` | `amount_cents` | Section  |
| --------------------------------------- | -------------------------------------------- | -------: | -------------: | -------- |
| `rates_and_annual_charges`              | Rates and annual charges                     |    7,931 |    793,100,000 | revenue  |
| `user_charges_and_fees`                 | User charges and fees                        |   23,542 |  2,354,200,000 | revenue  |
| `other_revenues`                        | Other revenues                               |    1,072 |    107,200,000 | revenue  |
| `government_grants_operating`           | Grants and contributions — operating         |   13,408 |  1,340,800,000 | revenue  |
| `government_grants_capital`             | Grants and contributions — capital           |    4,067 |    406,700,000 | revenue  |
| `interest_and_investment_income`        | Interest and investment income               |    1,854 |    185,400,000 | revenue  |
| `net_gain_from_disposal_of_assets`      | Net gain from the disposal of assets         |      187 |     18,700,000 | revenue  |
| `total_revenue`                         | Total income from continuing operations      |   52,061 |  5,206,100,000 | revenue  |
| `employee_expenses`                     | Employee benefits and on-costs               |   23,744 |  2,374,400,000 | expenses |
| `materials_and_services`                | Materials and services                       |   12,688 |  1,268,800,000 | expenses |
| `borrowing_costs`                       | Borrowing costs                              |      182 |     18,200,000 | expenses |
| `other_expenses`                        | Other expenses                               |      680 |     68,000,000 | expenses |
| `total_expenses_excluding_depreciation` | Total expenses excluding depreciation        |   37,294 |  3,729,400,000 | expenses |
| `depreciation_amortisation_impairment`  | Depreciation, amortisation and impairment    |   10,275 |  1,027,500,000 | expenses |
| `total_expenses`                        | Total expenses (documented bridge)           |   47,569 |  4,756,900,000 | expenses |
| `net_result`                            | Net operating result attributable to Council |    4,492 |    449,200,000 | result   |

Every row is `jurisdiction_level: "local"`, `jurisdiction: "NSW"`,
`delivery_entity: "Gilgandra Shire Council"`, `aggregation_role: "agency_detail"`,
`measure_type: "actual"`, `verified: false`, `data_quality_flag: "provisional/local_government"`.
Government grant rows carry `potential_double_count: true`.

## 6. No-total / no-cross-council rule

- Gilgandra Shire Council is one entity. No council total, no state/national total and no sum with
  another council, the `dubbo-council` budget/estimate rows, a government program, the PNFC benchmark
  or the OLG summary layer is created.
- The FY2025-26 column is the reporting boundary; the FY2024-25 comparative is not added.
- Revenue, expenses, components and the net result overlap. They are published rows, not an additive
  spending series.
- Every row is `agency_detail` with no `region_id` and no `location`/LGA allocation.

## 7. How to verify

```bash
# Official page and the exact PDF (plain UA required; bare Chrome UA gets 403).
curl -sL -o /dev/null -w '%{http_code}\n' 'https://www.gilgandra.nsw.gov.au/Your-Council/About-Council/Financial-information/Financial-Statements'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  'https://www.gilgandra.nsw.gov.au/files/assets/public/v/1/economic-development/inland-rail/submissions/annual_financial_statements-2026.pdf'

# Focused connector tests (16).
TEST_MONGO_URL="mongodb://localhost:27021/ausspend_test_gilgandragpfs" \
  npx vitest run --project server server/test/gilgandra-gpfs.test.ts
```

The focused suite covers the unit gate, exact reconciliation/zero tolerance, FY2025-26 stale-year
rejection and no-substitution of another year, natural-key/idempotency, no-cross-council totals,
discovery/latest selection (including the documented official fallback pin) and the plain-UA WAF
header.
