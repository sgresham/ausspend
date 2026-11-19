# NSW council GPFS — Blayney Shire Council FY2025-26 evidence

**Status:** implementation evidence only. One council, one audited year. The exact PDF is archived
outside the repo; no PDF or raw table is committed. **Entity:** Blayney Shire Council only.
**No council total, no state or national total, no OLG summary layer, no SOC/other council rows.**
The FY2025-26 column is used; the FY2024-25 comparative inside the statement is never added.

**Checked:** 2026-11-19 (Australia/Sydney).

## 0. Fiscal-year decision (current year)

FY2025-26 is the **current audited standalone year** published by the council at 2026-11-19: the
statements are for the year ended 30 June 2026. The Plans, strategies and reporting page lists
2025-26 as the newest year; no 2026/27 audited statements are posted. The connector targets
`2025-26` and rejects prior years (2024-25/2023-24).

## 1. Discovery and access log

| Step | URL | HTTP | Result |
| --- | --- | --- | --- |
| Official Plans, strategies and reporting page | <https://www.blayney.nsw.gov.au/council/council-information/plans-strategies-and-reporting/plans-and-strategies> | **200** | `text/html`, 68,995 bytes; lists annual reports, financial statements and public notices. |
| FY2025-26 audited financial statements | <https://www.blayney.nsw.gov.au/ArticleDocuments/271/Annual_Financial_Statements-2026%20Blayney%20Shire%20Council%20(1).pdf.aspx> | **200** | `application/pdf`, 3,321,814 bytes, 114 PDF pages; `content-disposition: attachment;filename="Annual Financial Statements-2026 Blayney Shire Council (1).pdf"`. |

**`.pdf.aspx` wrapper preserved.** The statement URL is an ASP.NET `.pdf.aspx` endpoint that returns
a PDF; the exact path (including `%20` and `(1)`) is preserved in the connector, the archive metadata
and the documented fallback pin. Discovery accepts only `blayney.nsw.gov.au` financial-statements
links and ignores annual reports, public notices, budget/planning documents and mirrors.

**Plain fetch.** The PDF serves normally to plain fetch; the connector sends an explicit plain
`curl/8.5.0` User-Agent (plus a broad PDF/HTML `Accept`) for deterministic discovery and download.
Tests assert that header is used.

The exact bytes are SHA-256 re-verified before parsing.

## 2. Exact document

- **Title:** Annual Financial Statements 2025-26 (standalone audited General Purpose Financial
  Statements, year ended 30 June 2026).
- **Financial year:** 2025-26.
- **URL:** `https://www.blayney.nsw.gov.au/ArticleDocuments/271/Annual_Financial_Statements-2026%20Blayney%20Shire%20Council%20(1).pdf.aspx`
- **Bytes:** 3,321,814.
- **PDF pages:** 114.
- **SHA-256:** `a0dff037962dff7951dd22623cbdad2221276a35efac0bbfcd0433eb48241e68`.
- **Archive:** `blayney-gpfs/Annual_Financial_Statements-2026-Blayney-Shire-Council-1-.pdf` under the
  configured source-archive root (outside the repo; not committed). It holds the exact PDF plus
  archive metadata (URL, retrieval date, bytes, SHA-256, content type) and the archive record. The
  connector re-verifies the hash before parsing.

## 3. Printed unit and statement

The Income Statement is on PDF page 5 (printed page 4). It prints `$ '000`. The unit gate requires
**`$ '000` / thousands**; a plain `$`, `$M` or unit-less read is rejected. The adapter reads the
FY2025-26 Actual column only (labelled 2026), not the Original unaudited budget column that prints
before each label.

The FY2025-26 column prints (whole `$ '000`):

```text
Income from continuing operations
  Rates and annual charges                               15,534
  User charges and fees                                   2,035
  Other revenues                                            388
  Grants and contributions provided for operating purposes 6,696
  Grants and contributions provided for capital purposes  3,049
  Interest and investment income                          1,513
  Other income                                              214
  Net gain from the disposal of assets                      – (nil, not emitted)
  Total income from continuing operations                29,429
Expenses from continuing operations
  Employee benefits and on-costs                          7,975
  Materials and services                                  6,312
  Borrowing costs                                           118
  Other expenses                                          1,106
  Net loss from the disposal of assets                      950
  Total expenses ... excluding depreciation              16,461
  Depreciation, amortisation and impairment               7,671
  Operating result from continuing operations             5,297
  Net operating result attributable to Council            5,297
  Net operating result before capital grants              2,248
```

The statement prints **no Total expenses line**. Total expenses is the printed face bridge:
expenses-excluding-depreciation `16,461` + depreciation/amortisation/impairment `7,671` = `24,132`,
which equals the B1-1 "Total functions and activities" expense total.

## 4. Reconciliation (zero tolerance)

All arithmetic in whole printed `$ '000` values:

```text
revenue components:
  15,534 + 2,035 + 388 + 6,696 + 3,049 + 1,513 + 214 = 29,429
  = printed Total income

expense components:
  7,975 + 6,312 + 118 + 1,106 + 950 = 16,461
  = printed expenses excluding depreciation

total expenses:
  16,461 + 7,671 = 24,132
  = printed B1-1 Total functions and activities expenses

operating result:
  29,429 - 24,132 = 5,297
  = printed Operating result

net result:
  5,297 = printed Net operating result attributable to Council

before capital grants:
  5,297 - 3,049 = 2,248
  = printed before-capital result (evidence only)

B1-1:
  income = 29,429
  expenses = 24,132
  operating result = 5,297
  grants = 6,696 + 3,049 = 9,745

other comprehensive income:
  revaluation                  12,806
  joint ventures/associates       904
  sum                          13,710
  = printed Total other comprehensive income for the year

comprehensive income:
  5,297 + 13,710 = 19,007
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
| `rates_and_annual_charges` | Rates and annual charges | 15,534 | 1,553,400,000 | revenue |
| `user_charges_and_fees` | User charges and fees | 2,035 | 203,500,000 | revenue |
| `other_revenues` | Other revenues | 388 | 38,800,000 | revenue |
| `government_grants_operating` | Grants and contributions — operating | 6,696 | 669,600,000 | revenue |
| `government_grants_capital` | Grants and contributions — capital | 3,049 | 304,900,000 | revenue |
| `interest_and_investment_income` | Interest and investment income | 1,513 | 151,300,000 | revenue |
| `other_income` | Other income | 214 | 21,400,000 | revenue |
| `total_revenue` | Total income from continuing operations | 29,429 | 2,942,900,000 | revenue |
| `employee_expenses` | Employee benefits and on-costs | 7,975 | 797,500,000 | expenses |
| `materials_and_services` | Materials and services | 6,312 | 631,200,000 | expenses |
| `borrowing_costs` | Borrowing costs | 118 | 11,800,000 | expenses |
| `other_expenses` | Other expenses | 1,106 | 110,600,000 | expenses |
| `net_loss_from_disposal_of_assets` | Net loss from the disposal of assets | 950 | 95,000,000 | expenses |
| `total_expenses_excluding_depreciation` | Total expenses excluding depreciation | 16,461 | 1,646,100,000 | expenses |
| `depreciation_amortisation_impairment` | Depreciation, amortisation and impairment | 7,671 | 767,100,000 | expenses |
| `total_expenses` | Total expenses (documented bridge) | 24,132 | 2,413,200,000 | expenses |
| `net_result` | Net operating result attributable to Council | 5,297 | 529,700,000 | result |

Every row is `jurisdiction_level: "local"`, `jurisdiction: "NSW"`,
`delivery_entity: "Blayney Shire Council"`, `aggregation_role: "agency_detail"`,
`measure_type: "actual"`, `verified: false`, `data_quality_flag: "provisional/local_government"`.
Government grant rows carry `potential_double_count: true`.

## 6. No-total / no-cross-council rule

- Blayney Shire Council is one entity. No council total, no state/national total and no sum with
  another council, the `dubbo-council` budget/estimate rows, a government program, the PNFC benchmark
  or the OLG summary layer is created.
- The FY2025-26 column is the reporting boundary; the FY2024-25 comparative is not added.
- Revenue, expenses, components and the net result overlap. They are published rows, not an additive
  spending series.
- Every row is `agency_detail` with no `region_id` and no `location`/LGA allocation.

## 7. Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`)

Targeted ingest of **only `blayney-gpfs`** against the shared dev DB:

- total measures **998,998 → 999,015** (exactly **+17**);
- GPFS rows **1480 → 1497**;
- active GPFS `data_sources` **77 → 78**;
- SOC rows (`jurisdiction_level: "soc"`) stayed at **205**; every other per-source count unchanged;
- **0** non-`agency_detail` rows, **0** rows with `region_id`/`location`, one
  `delivery_entity` (`Blayney Shire Council`), all rows `fiscal_year: "2025-26"`;
- `data_sources` has the source `active` with `records_ingested: 17`;
- the latest `ingestion_logs` entry is `status: "success"`, `records_fetched: 17`,
  `records_upserted: 17`.

## 8. How to verify

```bash
# Official page and the exact .pdf.aspx PDF.
curl -sL -o /dev/null -w '%{http_code}\n' \
  -A 'curl/8.5.0' 'https://www.blayney.nsw.gov.au/council/council-information/plans-strategies-and-reporting/plans-and-strategies'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  -A 'curl/8.5.0' \
  'https://www.blayney.nsw.gov.au/ArticleDocuments/271/Annual_Financial_Statements-2026%20Blayney%20Shire%20Council%20(1).pdf.aspx'

# Focused connector tests (18).
TEST_MONGO_URL="mongodb://localhost:27018/ausspend_test_blayneygpfs" \
  npx vitest run --project server server/test/blayney-gpfs.test.ts
```

The focused suite covers the unit gate, exact reconciliation/zero tolerance (including both OCI
components), FY2025-26 acceptance and rejection of 2024-25/2026-27 documents, natural-key/
idempotency, no-cross-council totals and discovery/latest selection (including annual-report/public
notice/mirror rejection, the preserved `.pdf.aspx` pin and the plain-UA header).
