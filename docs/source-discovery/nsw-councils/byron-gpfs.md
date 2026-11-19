# NSW council GPFS — Byron Shire Council FY2025-26 evidence

**Status:** implementation evidence only. One council, one audited year. The exact PDF is archived
outside the repo; no PDF or raw table is committed. **Entity:** Byron Shire Council only.
**No council total, no state or national total, no OLG summary layer, no SOC/other council rows.**
The FY2025-26 column is used; the FY2024-25 comparative inside the statement is never added.

**Checked:** 2026-11-19 (Australia/Sydney).

## 0. Fiscal-year decision (current-available, not calendar)

FY2025-26 is the **latest audited standalone financial statements** published by the council at
2026-11-19: the statements are for the year ended 30 June 2026. The connector targets `2025-26`, and
its stale-year guard rejects other years rather than silently substituting a 2026-27 or 2023-24
document.

## 1. Discovery and access log

| Step | URL | HTTP | Result |
| --- | --- | --- | --- |
| Official Reports on Our Progress page | <https://www.byron.nsw.gov.au/Council/Plans-Strategies/Council-Planning-Reporting/Reports-on-Our-Progress> | **200** | `text/html; charset=utf-8`, 138,477 bytes; lists paired annual reports and financial statements back to 2015-16. |
| FY2025-26 financial statements | <https://www.byron.nsw.gov.au/files/assets/public/v/2/hptrim/financial-management-budgeting-operational-budget-documentation-20262027/final-published-2025-26-financial-statements-byron-shire-council.pdf> | **200** | `application/pdf`, 3,221,859 bytes, 112 PDF pages; `last-modified: Wed, 11 Nov 2026 01:10:01 GMT`, `etag: "e7c31111-fb0c-4ebf-8398-0860056aa0b3"`. |

**Akamai UA quirk.** The same PDF URL returns **200** `application/pdf` to a plain client UA
(`curl/8.5.0`) and **403** to a bare Chrome UA. The connector sends an explicit plain client UA
(plus a broad PDF/HTML `Accept`) for both the listing and the PDF; a focused test asserts that header
is used and contains no `Chrome` token.

The connector parses the official Reports on Our Progress page, selects the **FY2025-26 Financial
Statements** anchor (not the paired annual report), and ignores prior years, special-purpose/special
schedule documents and off-host mirrors. A documented official fallback pin is used only if the page
yields no usable anchor. The exact bytes are SHA-256 re-verified before parsing.

## 2. Exact document

- **Title:** Financial Statements 2025 to 2026 (standalone audited General Purpose Financial
  Statements, year ended 30 June 2026).
- **Financial year:** 2025-26, for the year ended 30 June 2026.
- **URL:** `https://www.byron.nsw.gov.au/files/assets/public/v/2/hptrim/financial-management-budgeting-operational-budget-documentation-20262027/final-published-2025-26-financial-statements-byron-shire-council.pdf`
- **Bytes:** 3,221,859.
- **PDF pages:** 112.
- **SHA-256:** `a28fe05f984ef47a2e1ae158b1500c862a0a5870bb435f8eed737006b3d42aec`.
- **Archive:** `byron-gpfs/final-published-2025-26-financial-statements-byron-shire-council.pdf`
  under the configured source-archive root (outside the repo; not committed). It holds the exact PDF
  plus archive metadata (URL, retrieval date, bytes, SHA-256, content type) and the archive record.
  The connector re-verifies the hash before parsing.

## 3. Printed unit and statement

The Income Statement is on PDF page 6 (printed page 5). It prints `$ '000`. The unit gate requires
**`$ '000` / thousands**; a plain `$`, `$M` or unit-less read is rejected. The adapter reads the
FY2025-26 Actual column only, not the Original unaudited budget column that prints before each label.

The FY2025-26 column prints (whole `$ '000`):

```text
Income from continuing operations
  Rates and annual charges                               70,384
  User charges and fees                                  37,841
  Other revenues                                          2,687
  Grants and contributions provided for operating purposes 17,895
  Grants and contributions provided for capital purposes 53,137
  Interest and investment income                          4,654
  Other income                                            1,970
  Total income from continuing operations                188,568
Expenses from continuing operations
  Employee benefits and on-costs                         38,264
  Materials and services                                 64,620
  Borrowing costs                                         2,536
  Other expenses                                          3,002
  Net loss from the disposal of assets                    5,805
  Total expenses ... excluding depreciation              114,227
  Depreciation, amortisation and impairment              26,499
  Operating result from continuing operations            47,842
  Net operating result attributable to Council           47,842
  Net operating result before capital grants            (5,295)
```

The statement prints **no Total expenses line**. Total expenses is the printed face bridge:
expenses-excluding-depreciation `114,227` + depreciation/amortisation/impairment `26,499` = `140,726`,
which equals the B1-1 "Total functions and activities" expense total.

## 4. Reconciliation (zero tolerance)

All arithmetic is in whole printed `$ '000` values:

```text
revenue components:
  70,384 + 37,841 + 2,687 + 17,895 + 53,137 + 4,654 + 1,970 = 188,568
  = printed Total income

expense components:
  38,264 + 64,620 + 2,536 + 3,002 + 5,805 = 114,227
  = printed expenses excluding depreciation

total expenses:
  114,227 + 26,499 = 140,726
  = printed B1-1 Total functions and activities expenses

operating result:
  188,568 - 140,726 = 47,842
  = printed Operating result

net result:
  47,842 = printed Net operating result attributable to Council

before capital grants:
  47,842 - 53,137 = -5,295
  = printed before-capital result (evidence only)

B1-1:
  income = 188,568
  expenses = 140,726
  operating result = 47,842
  grants = 17,895 + 53,137 = 71,032

other comprehensive income:
  revaluation            -58,766
  impairment reversal        191
  joint ventures             103
  sum                    -58,472
  = printed Total other comprehensive income for the year
  = printed Total items not reclassified

comprehensive income:
  47,842 + (-58,472) = -10,630
  = printed Total comprehensive income
```

B1-1 income is the face total revenue. The adapter checks `B1-1 operating result = printed net
result`, `B1-1 grants = operating grants + capital grants`, `B1-1 income = face total revenue`,
`B1-1 expenses = face total expenses bridge` and `B1-1 income − B1-1 expenses = printed net result`.
The three printed OCI components are summed and checked against the printed total OCI. The
before-capital result is retained in reconciliation evidence only, not emitted as a row.

The adapter defers the document with **0 rows** if any printed line is missing, if the unit is not
thousands, or if any of these bridges differs by one thousand. On the audited FY2025-26 report there
is no deferral.

## 5. Extracted entity rows (17, non-additive)

| `gpfs_line_item` | Printed/derived label | `$ '000` | `amount_cents` | Section |
| --- | --- | ---: | ---: | --- |
| `rates_and_annual_charges` | Rates and annual charges | 70,384 | 7,038,400,000 | revenue |
| `user_charges_and_fees` | User charges and fees | 37,841 | 3,784,100,000 | revenue |
| `other_revenues` | Other revenues | 2,687 | 268,700,000 | revenue |
| `government_grants_operating` | Grants and contributions — operating | 17,895 | 1,789,500,000 | revenue |
| `government_grants_capital` | Grants and contributions — capital | 53,137 | 5,313,700,000 | revenue |
| `interest_and_investment_income` | Interest and investment income | 4,654 | 465,400,000 | revenue |
| `other_income` | Other income | 1,970 | 197,000,000 | revenue |
| `total_revenue` | Total income from continuing operations | 188,568 | 18,856,800,000 | revenue |
| `employee_expenses` | Employee benefits and on-costs | 38,264 | 3,826,400,000 | expenses |
| `materials_and_services` | Materials and services | 64,620 | 6,462,000,000 | expenses |
| `borrowing_costs` | Borrowing costs | 2,536 | 253,600,000 | expenses |
| `other_expenses` | Other expenses | 3,002 | 300,200,000 | expenses |
| `net_loss_from_disposal_of_assets` | Net loss from the disposal of assets | 5,805 | 580,500,000 | expenses |
| `total_expenses_excluding_depreciation` | Total expenses excluding depreciation | 114,227 | 11,422,700,000 | expenses |
| `depreciation_amortisation_impairment` | Depreciation, amortisation and impairment | 26,499 | 2,649,900,000 | expenses |
| `total_expenses` | Total expenses (documented bridge) | 140,726 | 14,072,600,000 | expenses |
| `net_result` | Net operating result attributable to Council | 47,842 | 4,784,200,000 | result |

Every row is `jurisdiction_level: "local"`, `jurisdiction: "NSW"`,
`delivery_entity: "Byron Shire Council"`, `aggregation_role: "agency_detail"`,
`measure_type: "actual"`, `verified: false`, `data_quality_flag: "provisional/local_government"`.
Government grant rows carry `potential_double_count: true`.

## 6. No-total / no-cross-council rule

- Byron Shire Council is one entity. No council total, no state/national total and no sum with another
  council, the `dubbo-council` budget/estimate rows, a government program, the PNFC benchmark or the
  OLG summary layer is created.
- The FY2025-26 column is the reporting boundary; the FY2024-25 comparative is not added.
- Revenue, expenses, components and the net result overlap. They are published rows, not an additive
  spending series.
- Every row is `agency_detail` with no `region_id` and no `location`/LGA allocation.

## 7. Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`)

Targeted ingest of **only `byron-gpfs`** against the shared dev DB:

- total measures **998,745 → 998,762** (exactly **+17**);
- GPFS rows **1227 → 1244**;
- active GPFS `data_sources` **62 → 63**;
- SOC rows (`jurisdiction_level: "soc"`) stayed at **205**; every other per-source count unchanged;
- **0** non-`agency_detail` rows, **0** rows with `region_id`/`location`, one
  `delivery_entity` (`Byron Shire Council`), all rows `fiscal_year: "2025-26"`;
- `data_sources` has the source `active` with `records_ingested: 17`;
- the latest `ingestion_logs` entry is `status: "success"`, `records_fetched: 17`,
  `records_upserted: 17`;
- a second ingest upserted the same 17 SHA-anchored natural keys and left the total at **998,762**
  (idempotent, no duplicates).

## 8. How to verify

```bash
# Official page and the exact financial-statements PDF.
curl -sL -o /dev/null -w '%{http_code}\n' \
  -A 'curl/8.5.0' 'https://www.byron.nsw.gov.au/Council/Plans-Strategies/Council-Planning-Reporting/Reports-on-Our-Progress'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  -A 'curl/8.5.0' \
  'https://www.byron.nsw.gov.au/files/assets/public/v/2/hptrim/financial-management-budgeting-operational-budget-documentation-20262027/final-published-2025-26-financial-statements-byron-shire-council.pdf'

# Focused connector tests (17).
TEST_MONGO_URL="mongodb://localhost:27018/ausspend_test_byrongpfs" \
  npx vitest run --project server server/test/byron-gpfs.test.ts
```

The focused suite covers the unit gate, exact reconciliation/zero tolerance (including the
three-component OCI sum), FY2025-26 current-available acceptance and rejection of 2024-25/2026-27
substitutions, natural-key/idempotency, no-cross-council totals and discovery/latest selection
(including the documented official fallback pin and the plain-UA Akamai header).
