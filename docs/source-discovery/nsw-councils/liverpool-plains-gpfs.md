# NSW council GPFS — Liverpool Plains Shire Council FY2025-26 evidence

**Status:** implementation evidence only. One council, one audited year. The exact PDF is archived
outside the repo; no PDF or raw table is committed. **Entity:** Liverpool Plains Shire Council only.
**No council total, no state or national total, no OLG summary layer, no SOC/other council rows.**
The FY2025-26 column is used; the FY2024-25 comparative inside the statement is never added.

**Checked:** 2026-11-19 (Australia/Sydney).

## 0. Fiscal-year decision (current year)

FY2025-26 is the **current audited standalone year** published by the council at 2026-11-19: the
statements are for the year ended 30 June 2026. The Audited Financial Statements page lists the year
ended 30 June 2026 as the newest document; no 2026/27 audited statements are posted. The connector
targets `2025-26` and rejects prior years (2024-25/2023-24).

## 1. Discovery and access log

| Step | URL | HTTP | Result |
| --- | --- | --- | --- |
| Official Audited Financial Statements page | <https://www.liverpoolplains.nsw.gov.au/Council/Accessing-Council-information/Corporate-and-Statutory-Reporting/Audited-Financial-Statements> | **200** | `text/html`, 98,567 bytes; lists financial statements for the years ended 30 June 2026, 2025, 2024, 2023, 2022 and 2021. |
| FY2025-26 audited financial statements | <https://www.liverpoolplains.nsw.gov.au/files/assets/public/v/2/governance/corporate-and-statutory-reporting/financial-statements/annual-financial-statements-year-ended-30-june-2026.pdf> | **200** | `application/pdf`, 3,419,279 bytes, 96 PDF pages; `last-modified: Mon, 09 Nov 2026 00:55:02 GMT`, `etag: "96d9a421-d622-4db8-85cb-685afdbc286a"`. |

The connector parses the official Audited Financial Statements page, selects the **year ended
30 June 2026** anchor, and ignores annual reports, public notices, budget/planning documents, prior
years and off-host mirrors. A documented official fallback pin (the exact PDF URL) is used only if the
page yields no usable anchor.

**Plain fetch.** The PDF serves normally to plain fetch; the connector sends an explicit plain
`curl/8.5.0` User-Agent (plus a broad PDF/HTML `Accept`) for deterministic discovery and download.
Tests assert that header is used.

The exact bytes are SHA-256 re-verified before parsing.

## 2. Exact document

- **Title:** Annual Financial Statements — Year Ended 30 June 2026 (standalone audited General
  Purpose Financial Statements).
- **Financial year:** 2025-26.
- **URL:** `https://www.liverpoolplains.nsw.gov.au/files/assets/public/v/2/governance/corporate-and-statutory-reporting/financial-statements/annual-financial-statements-year-ended-30-june-2026.pdf`
- **Bytes:** 3,419,279.
- **PDF pages:** 96.
- **SHA-256:** `118f0ac06fd6ce9d575c90e543c8bc6791eb687c7b1b535658b5c05ed8245bf5`.
- **Archive:** `liverpool-plains-gpfs/annual-financial-statements-year-ended-30-june-2026.pdf` under
  the configured source-archive root (outside the repo; not committed). It holds the exact PDF plus
  archive metadata (URL, retrieval date, bytes, SHA-256, content type) and the archive record. The
  connector re-verifies the hash before parsing.

## 3. Printed unit and statement

The Income Statement is on PDF page 5 (printed page 3). It prints `$ '000`. The unit gate requires
**`$ '000` / thousands**; a plain `$`, `$M` or unit-less read is rejected. The adapter reads the
FY2025-26 Actual column only (labelled 2026), not the Original unaudited budget column that prints
before each label.

The FY2025-26 column prints (whole `$ '000`):

```text
Income from continuing operations
  Rates and annual charges                               16,004
  User charges and fees                                   7,286
  Grants and contributions provided for operating purposes 8,183
  Grants and contributions provided for capital purposes 7,312
  Other revenues                                            442
  Interest and investment income                          1,779
  Other income                                              236
  Net gain from the disposal of assets                      – (nil, not emitted)
  Total income from continuing operations                41,242
Expenses from continuing operations
  Employee benefits and on-costs                         12,025
  Materials and services                                 14,447
  Borrowing costs                                         1,013
  Other expenses                                            672
  Net loss from the disposal of assets                    5,337
  Total expenses ... excluding depreciation              33,494
  Depreciation, amortisation and impairment              17,778
  Operating result from continuing operations           (10,030)
  Net operating result attributable to Council          (10,030)
  Net operating result before capital grants            (17,342)
```

The statement prints **no Total expenses line**. Total expenses is the printed face bridge:
expenses-excluding-depreciation `33,494` + depreciation/amortisation/impairment `17,778` = `51,272`,
which equals the B1-1 "Total functions and activities" expense total.

## 4. Reconciliation (zero tolerance)

All arithmetic in whole printed `$ '000` values:

```text
revenue components:
  16,004 + 7,286 + 8,183 + 7,312 + 442 + 1,779 + 236 = 41,242
  = printed Total income

expense components:
  12,025 + 14,447 + 1,013 + 672 + 5,337 = 33,494
  = printed expenses excluding depreciation

total expenses:
  33,494 + 17,778 = 51,272
  = printed B1-1 Total functions and activities expenses

operating result:
  41,242 - 51,272 = -10,030
  = printed Operating result (loss)

net result:
  -10,030 = printed Net operating result attributable to Council (stored with negative sign marker)

before capital grants:
  -10,030 - 7,312 = -17,342
  = printed before-capital result (evidence only)

B1-1:
  income = 41,242
  expenses = 51,272
  operating result = -10,030
  grants = 8,183 + 7,312 = 15,495

other comprehensive income:
  revaluation           11,750
  = printed Total other comprehensive income for the year

comprehensive income:
  -10,030 + 11,750 = 1,720
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
| `rates_and_annual_charges` | Rates and annual charges | 16,004 | 1,600,400,000 | revenue |
| `user_charges_and_fees` | User charges and fees | 7,286 | 728,600,000 | revenue |
| `other_revenues` | Other revenues | 442 | 44,200,000 | revenue |
| `government_grants_operating` | Grants and contributions — operating | 8,183 | 818,300,000 | revenue |
| `government_grants_capital` | Grants and contributions — capital | 7,312 | 731,200,000 | revenue |
| `interest_and_investment_income` | Interest and investment income | 1,779 | 177,900,000 | revenue |
| `other_income` | Other income | 236 | 23,600,000 | revenue |
| `total_revenue` | Total income from continuing operations | 41,242 | 4,124,200,000 | revenue |
| `employee_expenses` | Employee benefits and on-costs | 12,025 | 1,202,500,000 | expenses |
| `materials_and_services` | Materials and services | 14,447 | 1,444,700,000 | expenses |
| `borrowing_costs` | Borrowing costs | 1,013 | 101,300,000 | expenses |
| `other_expenses` | Other expenses | 672 | 67,200,000 | expenses |
| `net_loss_from_disposal_of_assets` | Net loss from the disposal of assets | 5,337 | 533,700,000 | expenses |
| `total_expenses_excluding_depreciation` | Total expenses excluding depreciation | 33,494 | 3,349,400,000 | expenses |
| `depreciation_amortisation_impairment` | Depreciation, amortisation and impairment | 17,778 | 1,777,800,000 | expenses |
| `total_expenses` | Total expenses (documented bridge) | 51,272 | 5,127,200,000 | expenses |
| `net_result` | Net operating result attributable to Council | -10,030 | 1,003,000,000 | result |

The `net_result` row carries `gpfs_printed_sign: "negative"`; every other row is stored as a positive
magnitude. Every row is `jurisdiction_level: "local"`, `jurisdiction: "NSW"`,
`delivery_entity: "Liverpool Plains Shire Council"`, `aggregation_role: "agency_detail"`,
`measure_type: "actual"`, `verified: false`, `data_quality_flag: "provisional/local_government"`.
Government grant rows carry `potential_double_count: true`.

## 6. No-total / no-cross-council rule

- Liverpool Plains Shire Council is one entity. No council total, no state/national total and no sum
  with another council, the `dubbo-council` budget/estimate rows, a government program, the PNFC
  benchmark or the OLG summary layer is created.
- The FY2025-26 column is the reporting boundary; the FY2024-25 comparative is not added.
- Revenue, expenses, components and the net result overlap. They are published rows, not an additive
  spending series.
- Every row is `agency_detail` with no `region_id` and no `location`/LGA allocation.

## 7. Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`)

Targeted ingest of **only `liverpool-plains-gpfs`** against the shared dev DB:

- total measures **999,015 → 999,032** (exactly **+17**);
- GPFS rows **1497 → 1514**;
- active GPFS `data_sources` **78 → 79**;
- SOC rows (`jurisdiction_level: "soc"`) stayed at **205**; every other per-source count unchanged;
- **0** non-`agency_detail` rows, **0** rows with `region_id`/`location`, one
  `delivery_entity` (`Liverpool Plains Shire Council`), all rows `fiscal_year: "2025-26"`;
- `data_sources` has the source `active` with `records_ingested: 17`;
- the latest `ingestion_logs` entry is `status: "success"`, `records_fetched: 17`,
  `records_upserted: 17`.

## 8. How to verify

```bash
# Official page and the exact PDF.
curl -sL -o /dev/null -w '%{http_code}\n' \
  -A 'curl/8.5.0' 'https://www.liverpoolplains.nsw.gov.au/Council/Accessing-Council-information/Corporate-and-Statutory-Reporting/Audited-Financial-Statements'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  -A 'curl/8.5.0' \
  'https://www.liverpoolplains.nsw.gov.au/files/assets/public/v/2/governance/corporate-and-statutory-reporting/financial-statements/annual-financial-statements-year-ended-30-june-2026.pdf'

# Focused connector tests (17).
TEST_MONGO_URL="mongodb://localhost:27018/ausspend_test_liverpoolplainsgpfs" \
  npx vitest run --project server server/test/liverpool-plains-gpfs.test.ts
```

The focused suite covers the unit gate, exact reconciliation/zero tolerance (including the negative
net result sign marker), FY2025-26 acceptance and rejection of 2024-25/2026-27 documents,
natural-key/idempotency, no-cross-council totals and discovery/latest selection (including
annual-report/public-notice/mirror rejection, the documented official fallback pin and the plain-UA
header).
