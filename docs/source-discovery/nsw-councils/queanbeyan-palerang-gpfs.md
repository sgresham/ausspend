# NSW council GPFS — Queanbeyan-Palerang Regional Council FY2025-26 evidence

**Status:** implementation evidence only. One council, one audited year. The exact PDF is archived
outside the repo; no PDF or raw table is committed. **Entity:** Queanbeyan-Palerang Regional Council
only. **No council total, no state or national total, no OLG summary layer, no SOC/other council
rows.** The FY2025-26 column is used; the FY2024-25 comparative inside the statement is never added.

**Checked:** 2026-11-19 (Australia/Sydney).

## 0. Fiscal-year decision (current-available, not calendar)

FY2025-26 is the **latest audited standalone financial statements** published by the council at
2026-11-19: the statements are for the year ended 30 June 2026. The connector targets `2025-26`, and
its stale-year guard rejects other years rather than silently substituting a 2026-27 or 2023-24
document.

## 1. Discovery and access log

| Step | URL | HTTP | Result |
| --- | --- | --- | --- |
| Official Budgets-and-Planning page | <https://www.qprc.nsw.gov.au/Council/Council-Business/Budgets-and-Planning> | **200** | `text/html; charset=utf-8`, 133,462 bytes; lists paired annual report + financial statements PDFs from 2015-16. |
| FY2025-26 financial statements | <https://www.qprc.nsw.gov.au/files/assets/public/v/1/council/budgets-and-planning/financial_statements-2025-2026.pdf> | **200** | `application/pdf`, 3,320,800 bytes, 97 PDF pages. |

The connector parses the official Budgets-and-Planning page, accepts the financial statements anchor,
and ignores the paired annual report, prior years and off-host mirrors. A documented official
fallback pin (the exact PDF URL) is used only if the page yields no usable anchor.

**Akamai UA quirk.** The host is UA-sensitive: a plain client UA (`curl/8.5.0`) returns **200**
`application/pdf`; a bare Chrome UA returns **403** (`text/html`, 518 bytes). The connector sends an
explicit plain client UA (plus a broad PDF/HTML `Accept`) for both the listing and the PDF; a focused
test asserts that header is used.

The exact bytes are SHA-256 re-verified before parsing.

## 2. Exact document

- **Title:** Financial Statements 2025-26 (standalone audited General Purpose Financial Statements,
  year ended 30 June 2026).
- **Financial year:** 2025-26, for the year ended 30 June 2026.
- **URL:** `https://www.qprc.nsw.gov.au/files/assets/public/v/1/council/budgets-and-planning/financial_statements-2025-2026.pdf`
- **Bytes:** 3,320,800.
- **PDF pages:** 97.
- **SHA-256:** `81908dc2ad97c2f9c2a5cff3217096e587d45b3d9be153944914a9a26ae79b51`.
- **Archive:** `queanbeyan-palerang-gpfs/financial_statements-2025-2026.pdf` under the configured
  source-archive root (outside the repo; not committed). It holds the exact PDF plus archive metadata
  (URL, retrieval date, bytes, SHA-256, content type) and the archive record. The connector
  re-verifies the hash before parsing.

## 3. Printed unit and statement

The Income Statement is on PDF page 5 (printed page 4). It prints `$ '000`. The unit gate requires
**`$ '000` / thousands**; a plain `$`, `$M` or unit-less read is rejected. The adapter reads the
FY2025-26 Actual column only, not the Original unaudited budget column that prints before each label.

The FY2025-26 column prints (whole `$ '000`):

```text
Income from continuing operations
  Rates and annual charges                              125,200
  User charges and fees                                  52,972
  Other revenues                                          1,834
  Grants and contributions provided for operating purposes 19,052
  Grants and contributions provided for capital purposes 59,340
  Interest and investment income                         13,978
  Other income                                            5,660
  Total income from continuing operations                278,036
Expenses from continuing operations
  Employee benefits and on-costs                         55,436
  Materials and services                                 82,414
  Borrowing costs                                        10,729
  Other expenses                                          3,795
  Net loss from the disposal of assets                   16,345
  Total expenses ... excluding depreciation             168,719
  Depreciation, amortisation and impairment              47,965
  Operating result from continuing operations            61,352
  Net operating result attributable to Council           61,352
  Net operating result before capital grants              2,012
```

The statement prints **no Total expenses line**. Total expenses is the printed face bridge:
expenses-excluding-depreciation `168,719` + depreciation/amortisation/impairment `47,965` =
`216,684`, which equals the B1-1 "Total functions and activities" expense total.

## 4. Reconciliation (zero tolerance)

All arithmetic is in whole printed `$ '000` values:

```text
revenue components:
  125,200 + 52,972 + 1,834 + 19,052 + 59,340 + 13,978 + 5,660 = 278,036
  = printed Total income

expense components:
  55,436 + 82,414 + 10,729 + 3,795 + 16,345 = 168,719
  = printed expenses excluding depreciation

total expenses:
  168,719 + 47,965 = 216,684
  = printed B1-1 Total functions and activities expenses

operating result:
  278,036 - 216,684 = 61,352
  = printed Operating result

net result:
  61,352 = printed Net operating result attributable to Council

before capital grants:
  61,352 - 59,340 = 2,012
  = printed before-capital result (evidence only)

B1-1:
  income = 278,036
  expenses = 216,684
  operating result = 61,352
  grants = 19,052 + 59,340 = 78,392

other comprehensive income:
  revaluation           123,457
  = printed Total other comprehensive income for the year

comprehensive income:
  61,352 + 123,457 = 184,809
  = printed Total comprehensive income
```

B1-1 income is the face total revenue. The adapter checks `B1-1 operating result = printed net
result`, `B1-1 grants = operating grants + capital grants`, `B1-1 income = face total revenue`,
`B1-1 expenses = face total expenses bridge` and `B1-1 income − B1-1 expenses = printed net result`.
The single printed OCI component is checked against the printed OCI. The before-capital result is
retained in reconciliation evidence only, not emitted as a row.

The adapter defers the document with **0 rows** if any printed line is missing, if the unit is not
thousands, or if any of these bridges differs by one thousand. On the audited FY2025-26 report there
is no deferral.

## 5. Extracted entity rows (17, non-additive)

| `gpfs_line_item` | Printed/derived label | `$ '000` | `amount_cents` | Section |
| --- | --- | ---: | ---: | --- |
| `rates_and_annual_charges` | Rates and annual charges | 125,200 | 12,520,000,000 | revenue |
| `user_charges_and_fees` | User charges and fees | 52,972 | 5,297,200,000 | revenue |
| `other_revenues` | Other revenues | 1,834 | 183,400,000 | revenue |
| `government_grants_operating` | Grants and contributions — operating | 19,052 | 1,905,200,000 | revenue |
| `government_grants_capital` | Grants and contributions — capital | 59,340 | 5,934,000,000 | revenue |
| `interest_and_investment_income` | Interest and investment income | 13,978 | 1,397,800,000 | revenue |
| `other_income` | Other income | 5,660 | 566,000,000 | revenue |
| `total_revenue` | Total income from continuing operations | 278,036 | 27,803,600,000 | revenue |
| `employee_expenses` | Employee benefits and on-costs | 55,436 | 5,543,600,000 | expenses |
| `materials_and_services` | Materials and services | 82,414 | 8,241,400,000 | expenses |
| `borrowing_costs` | Borrowing costs | 10,729 | 1,072,900,000 | expenses |
| `other_expenses` | Other expenses | 3,795 | 379,500,000 | expenses |
| `net_loss_from_disposal_of_assets` | Net loss from the disposal of assets | 16,345 | 1,634,500,000 | expenses |
| `total_expenses_excluding_depreciation` | Total expenses excluding depreciation | 168,719 | 16,871,900,000 | expenses |
| `depreciation_amortisation_impairment` | Depreciation, amortisation and impairment | 47,965 | 4,796,500,000 | expenses |
| `total_expenses` | Total expenses (documented bridge) | 216,684 | 21,668,400,000 | expenses |
| `net_result` | Net operating result attributable to Council | 61,352 | 6,135,200,000 | result |

Every row is `jurisdiction_level: "local"`, `jurisdiction: "NSW"`,
`delivery_entity: "Queanbeyan-Palerang Regional Council"`, `aggregation_role: "agency_detail"`,
`measure_type: "actual"`, `verified: false`, `data_quality_flag: "provisional/local_government"`.
Government grant rows carry `potential_double_count: true`.

## 6. No-total / no-cross-council rule

- Queanbeyan-Palerang Regional Council is one entity. No council total, no state/national total and no
  sum with another council, the `dubbo-council` budget/estimate rows, a government program, the PNFC
  benchmark or the OLG summary layer is created.
- The FY2025-26 column is the reporting boundary; the FY2024-25 comparative is not added.
- Revenue, expenses, components and the net result overlap. They are published rows, not an additive
  spending series.
- Every row is `agency_detail` with no `region_id` and no `location`/LGA allocation.

## 7. Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`)

Targeted ingest of **only `queanbeyan-palerang-gpfs`** against the shared dev DB:

- total measures **998,829 → 998,846** (exactly **+17**);
- GPFS rows **1311 → 1328**;
- active GPFS `data_sources` **67 → 68**;
- SOC rows (`jurisdiction_level: "soc"`) stayed at **205**; every other per-source count unchanged;
- **0** non-`agency_detail` rows, **0** rows with `region_id`/`location`, one
  `delivery_entity` (`Queanbeyan-Palerang Regional Council`), all rows `fiscal_year: "2025-26"`;
- `data_sources` has the source `active` with `records_ingested: 17`;
- the latest `ingestion_logs` entry is `status: "success"`, `records_fetched: 17`,
  `records_upserted: 17`;
- a second ingest upserted the same 17 SHA-anchored natural keys and left the total at **998,846**
  (idempotent, no duplicates).

## 8. How to verify

```bash
# Official page and the exact financial statements PDF (plain UA; Chrome UA 403).
curl -sL -o /dev/null -w '%{http_code}\n' \
  -A 'curl/8.5.0' 'https://www.qprc.nsw.gov.au/Council/Council-Business/Budgets-and-Planning'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  -A 'curl/8.5.0' \
  'https://www.qprc.nsw.gov.au/files/assets/public/v/1/council/budgets-and-planning/financial_statements-2025-2026.pdf'

# Focused connector tests (17).
TEST_MONGO_URL="mongodb://localhost:27018/ausspend_test_qprcgpfs" \
  npx vitest run --project server server/test/queanbeyan-palerang-gpfs.test.ts
```

The focused suite covers the unit gate, exact reconciliation/zero tolerance (including the
single-component OCI), FY2025-26 current-available acceptance and rejection of 2024-25/2026-27
substitutions, natural-key/idempotency, no-cross-council totals and discovery/latest selection
(including annual-report rejection, the documented official fallback pin and the plain-UA header).
