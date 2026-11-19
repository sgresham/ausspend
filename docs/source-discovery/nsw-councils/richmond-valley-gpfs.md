# NSW council GPFS — Richmond Valley Council FY2025-26 evidence

**Status:** implementation evidence only. One council, one audited year. The exact PDF is archived
outside the repo; no PDF or raw table is committed. **Entity:** Richmond Valley Council only.
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
| Official Budgets & Financial Reports page | <https://richmondvalley.nsw.gov.au/council/governance/budgets-and-financial-reports/> | **200** | `text/html; charset=utf-8`, 267,397 bytes; carries the Financial Statements series. |
| FY2025-26 financial statements | <https://richmondvalley.nsw.gov.au/wp-content/uploads/2026/10/Richmond-Valley-Council-Financial-Statements-for-the-year-ended-30-June-2026.pdf> | **200** | `application/pdf`, 2,803,124 bytes, 120 PDF pages; `last-modified: Tue, 27 Oct 2026 22:35:24 GMT`. |

The Annual Reports page (<https://richmondvalley.nsw.gov.au/council/governance/annual-reports/>) only
lists annual reports; the financial-statements series is on the **Budgets & Financial Reports** page.
The connector parses that page, selects the **2025/2026 Financial Statements** anchor, and ignores the
annual report, prior years and off-host mirrors. A documented official fallback pin (the exact PDF
URL) is used only if the page yields no usable anchor.

**Plain fetch.** The WordPress media PDFs serve normally to plain fetch; the connector sends an
explicit plain `curl/8.5.0` User-Agent (plus a broad PDF/HTML `Accept`) for deterministic discovery
and download. Tests assert that header is used.

The exact bytes are SHA-256 re-verified before parsing.

## 2. Exact document

- **Title:** 2025/2026 Financial Statements (standalone audited General Purpose Financial Statements,
  year ended 30 June 2026).
- **Financial year:** 2025-26, for the year ended 30 June 2026.
- **URL:** `https://richmondvalley.nsw.gov.au/wp-content/uploads/2026/10/Richmond-Valley-Council-Financial-Statements-for-the-year-ended-30-June-2026.pdf`
- **Bytes:** 2,803,124.
- **PDF pages:** 120.
- **SHA-256:** `aad1a9a65df3fbb58291444b9cb38347b4eb85d025f7dd9e41ecb57005703b2f`.
- **Archive:** `richmond-valley-gpfs/Richmond-Valley-Council-Financial-Statements-for-the-year-ended-30-June-2026.pdf`
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
  Rates and annual charges                               35,348
  User charges and fees                                  21,218
  Other revenues                                             98
  Grants and contributions provided for operating purposes 22,039
  Grants and contributions provided for capital purposes 36,171
  Interest and investment income                          3,099
  Other income                                            3,165
  Total income from continuing operations                121,138
Expenses from continuing operations
  Employee benefits and on-costs                         27,939
  Materials and services                                 31,406
  Borrowing costs                                           640
  Other expenses                                          2,549
  Net loss from the disposal of assets                    6,393
  Total expenses ... excluding depreciation              68,927
  Depreciation, amortisation and impairment              26,519
  Operating result from continuing operations            25,692
  Net operating result attributable to Council           25,692
  Net operating result before capital grants            (10,479)
```

The statement prints **no Total expenses line**. Total expenses is the printed face bridge:
expenses-excluding-depreciation `68,927` + depreciation/amortisation/impairment `26,519` = `95,446`,
which equals the B1-1 "Total functions and activities" expense total.

## 4. Reconciliation (zero tolerance)

All arithmetic is in whole printed `$ '000` values:

```text
revenue components:
  35,348 + 21,218 + 98 + 22,039 + 36,171 + 3,099 + 3,165 = 121,138
  = printed Total income

expense components:
  27,939 + 31,406 + 640 + 2,549 + 6,393 = 68,927
  = printed expenses excluding depreciation

total expenses:
  68,927 + 26,519 = 95,446
  = printed B1-1 Total functions and activities expenses

operating result:
  121,138 - 95,446 = 25,692
  = printed Operating result

net result:
  25,692 = printed Net operating result attributable to Council

before capital grants:
  25,692 - 36,171 = -10,479
  = printed before-capital result (evidence only)

B1-1:
  income = 121,138
  expenses = 95,446
  operating result = 25,692
  grants = 22,039 + 36,171 = 58,210

other comprehensive income:
  revaluation           14,492
  impairment reversal    5,703
  sum                   20,195
  = printed Total other comprehensive income for the year
  = printed Total items not reclassified

comprehensive income:
  25,692 + 20,195 = 45,887
  = printed Total comprehensive income
```

B1-1 income is the face total revenue. The adapter checks `B1-1 operating result = printed net
result`, `B1-1 grants = operating grants + capital grants`, `B1-1 income = face total revenue`,
`B1-1 expenses = face total expenses bridge` and `B1-1 income − B1-1 expenses = printed net result`.
The two printed OCI components are summed and checked against the printed OCI. The before-capital
result is retained in reconciliation evidence only, not emitted as a row.

The adapter defers the document with **0 rows** if any printed line is missing, if the unit is not
thousands, or if any of these bridges differs by one thousand. On the audited FY2025-26 report there
is no deferral.

## 5. Extracted entity rows (17, non-additive)

| `gpfs_line_item` | Printed/derived label | `$ '000` | `amount_cents` | Section |
| --- | --- | ---: | ---: | --- |
| `rates_and_annual_charges` | Rates and annual charges | 35,348 | 3,534,800,000 | revenue |
| `user_charges_and_fees` | User charges and fees | 21,218 | 2,121,800,000 | revenue |
| `other_revenues` | Other revenues | 98 | 9,800,000 | revenue |
| `government_grants_operating` | Grants and contributions — operating | 22,039 | 2,203,900,000 | revenue |
| `government_grants_capital` | Grants and contributions — capital | 36,171 | 3,617,100,000 | revenue |
| `interest_and_investment_income` | Interest and investment income | 3,099 | 309,900,000 | revenue |
| `other_income` | Other income | 3,165 | 316,500,000 | revenue |
| `total_revenue` | Total income from continuing operations | 121,138 | 12,113,800,000 | revenue |
| `employee_expenses` | Employee benefits and on-costs | 27,939 | 2,793,900,000 | expenses |
| `materials_and_services` | Materials and services | 31,406 | 3,140,600,000 | expenses |
| `borrowing_costs` | Borrowing costs | 640 | 64,000,000 | expenses |
| `other_expenses` | Other expenses | 2,549 | 254,900,000 | expenses |
| `net_loss_from_disposal_of_assets` | Net loss from the disposal of assets | 6,393 | 639,300,000 | expenses |
| `total_expenses_excluding_depreciation` | Total expenses excluding depreciation | 68,927 | 6,892,700,000 | expenses |
| `depreciation_amortisation_impairment` | Depreciation, amortisation and impairment | 26,519 | 2,651,900,000 | expenses |
| `total_expenses` | Total expenses (documented bridge) | 95,446 | 9,544,600,000 | expenses |
| `net_result` | Net operating result attributable to Council | 25,692 | 2,569,200,000 | result |

Every row is `jurisdiction_level: "local"`, `jurisdiction: "NSW"`,
`delivery_entity: "Richmond Valley Council"`, `aggregation_role: "agency_detail"`,
`measure_type: "actual"`, `verified: false`, `data_quality_flag: "provisional/local_government"`.
Government grant rows carry `potential_double_count: true`.

## 6. No-total / no-cross-council rule

- Richmond Valley Council is one entity. No council total, no state/national total and no sum with
  another council, the `dubbo-council` budget/estimate rows, a government program, the PNFC benchmark
  or the OLG summary layer is created.
- The FY2025-26 column is the reporting boundary; the FY2024-25 comparative is not added.
- Revenue, expenses, components and the net result overlap. They are published rows, not an additive
  spending series.
- Every row is `agency_detail` with no `region_id` and no `location`/LGA allocation.

## 7. Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`)

Targeted ingest of **only `richmond-valley-gpfs`** against the shared dev DB:

- total measures **998,779 → 998,796** (exactly **+17**);
- GPFS rows **1261 → 1278**;
- active GPFS `data_sources` **64 → 65**;
- SOC rows (`jurisdiction_level: "soc"`) stayed at **205**; every other per-source count unchanged;
- **0** non-`agency_detail` rows, **0** rows with `region_id`/`location`, one
  `delivery_entity` (`Richmond Valley Council`), all rows `fiscal_year: "2025-26"`;
- `data_sources` has the source `active` with `records_ingested: 17`;
- the latest `ingestion_logs` entry is `status: "success"`, `records_fetched: 17`,
  `records_upserted: 17`;
- a second ingest upserted the same 17 SHA-anchored natural keys and left the total at **998,796**
  (idempotent, no duplicates).

## 8. How to verify

```bash
# Official page and the exact financial-statements PDF.
curl -sL -o /dev/null -w '%{http_code}\n' \
  -A 'curl/8.5.0' 'https://richmondvalley.nsw.gov.au/council/governance/budgets-and-financial-reports/'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  -A 'curl/8.5.0' \
  'https://richmondvalley.nsw.gov.au/wp-content/uploads/2026/10/Richmond-Valley-Council-Financial-Statements-for-the-year-ended-30-June-2026.pdf'

# Focused connector tests (17).
TEST_MONGO_URL="mongodb://localhost:27018/ausspend_test_richmondvalleygpfs" \
  npx vitest run --project server server/test/richmond-valley-gpfs.test.ts
```

The focused suite covers the unit gate, exact reconciliation/zero tolerance (including the
two-component OCI sum), FY2025-26 current-available acceptance and rejection of 2024-25/2026-27
substitutions, natural-key/idempotency, no-cross-council totals and discovery/latest selection
(including the documented official fallback pin and the plain-UA header).
