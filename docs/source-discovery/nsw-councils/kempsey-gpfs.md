# NSW council GPFS — Kempsey Shire Council FY2025-26 evidence

**Status:** implementation evidence only. One council, one audited year. The exact PDF is archived
outside the repo; no PDF or raw table is committed. **Entity:** Kempsey Shire Council only.
**No council total, no state or national total, no OLG summary layer, no SOC/other council rows.**
The FY2025-26 column is used; the FY2024-25 comparative inside the statement is never added.

**Checked:** 2026-11-19 (Australia/Sydney).

## 0. Fiscal-year decision (current-available, not calendar)

FY2025-26 is the **latest audited standalone financial statements** published by the council at
2026-11-19: the annual report's Part C is for the year ended 30 June 2026. The connector targets
`2025-26`, and its stale-year guard rejects other years rather than silently substituting a 2026-27
or 2023-24 document.

## 1. Discovery and access log

| Step | URL | HTTP | Result |
| --- | --- | --- | --- |
| Official Annual reports & publications page | <https://www.kempsey.nsw.gov.au/Your-Council/Publications/Annual-reports-publications> | **200** | `text/html; charset=utf-8`, 112,185 bytes; lists the split annual report parts A/B/C. |
| FY2025-26 Part C audited statements | <https://www.kempsey.nsw.gov.au/files/sharedassets/public/v/1/docs/departments/corporate-performance/planning-amp-reporting/2026-27/10-2-3-2025-26-annual-report-part-c-audited-financial-statements.pdf> | **200** | `application/pdf`, 3,663,303 bytes, 108 PDF pages. |

The annual report is split into parts; **Part C** is the audited financial statements. The connector
parses the official page, accepts only a Part C anchor that contains the financial statements, and
ignores Part A/B narrative parts, prior years, earlier undated Part C uploads and off-host mirrors.
A documented official fallback pin (the exact PDF URL) is used only if the page yields no usable
anchor.

**Fiscal-year parsing.** Current URLs carry the publication folder (`/2026-27/`) before the document
file name (`2025-26`). The link parser therefore uses the **last** consecutive year range in the URL,
so the current Part C maps to `2025-26`, not the folder year.

**Akamai UA quirk.** The host is UA-sensitive: a plain client UA (`curl/8.5.0`) returns **200**
`application/pdf`; a bare Chrome UA can return **403**. The connector sends an explicit plain client
UA (plus a broad PDF/HTML `Accept`) for both the listing and the PDF; a focused test asserts that
header is used.

The exact bytes are SHA-256 re-verified before parsing.

## 2. Exact document

- **Title:** 2025-26 Annual Report Part C — Audited Financial Statements (standalone audited General
  Purpose Financial Statements, year ended 30 June 2026).
- **Financial year:** 2025-26, for the year ended 30 June 2026.
- **URL:** `https://www.kempsey.nsw.gov.au/files/sharedassets/public/v/1/docs/departments/corporate-performance/planning-amp-reporting/2026-27/10-2-3-2025-26-annual-report-part-c-audited-financial-statements.pdf`
- **Bytes:** 3,663,303.
- **PDF pages:** 108.
- **SHA-256:** `41de47285941f3b7bb9c44f07710fa5de7c6ee18cc780a95b6932a55c202cca1`.
- **Archive:** `kempsey-gpfs/10-2-3-2025-26-annual-report-part-c-audited-financial-statements.pdf`
  under the configured source-archive root (outside the repo; not committed). It holds the exact PDF
  plus archive metadata (URL, retrieval date, bytes, SHA-256, content type) and the archive record.
  The connector re-verifies the hash before parsing.

## 3. Printed unit and statement

The Income Statement is on PDF page 5 (printed page 4). It prints `$ '000`. The unit gate requires
**`$ '000` / thousands**; a plain `$`, `$M` or unit-less read is rejected. The adapter reads the
FY2025-26 Actual column only, not the Original unaudited budget column that prints before each label.

The FY2025-26 column prints (whole `$ '000`):

```text
Income from continuing operations
  Rates and annual charges                               59,174
  User charges and fees                                  22,184
  Other revenues                                          3,013
  Grants and contributions provided for operating purposes 30,848
  Grants and contributions provided for capital purposes 53,755
  Interest and investment income                          8,805
  Total income from continuing operations                177,779
Expenses from continuing operations
  Employee benefits and on-costs                         34,710
  Materials and services                                 36,590
  Borrowing costs                                         2,924
  Other expenses                                          3,427
  Net loss from the disposal of assets                    4,881
  Total expenses ... excluding depreciation              82,532
  Depreciation, amortisation and impairment              28,560
  Operating result from continuing operations            66,687
  Net operating result attributable to Council           66,687
  Net operating result before capital grants             12,932
```

Kempsey prints **six revenue lines** (there is no separate "Other income" line) and five expense
lines. The statement prints **no Total expenses line**; total expenses is the printed face bridge:
expenses-excluding-depreciation `82,532` + depreciation/amortisation/impairment `28,560` = `111,092`,
which equals the B1-1 "Total functions and activities" expense total.

## 4. Reconciliation (zero tolerance)

All arithmetic is in whole printed `$ '000` values:

```text
revenue components:
  59,174 + 22,184 + 3,013 + 30,848 + 53,755 + 8,805 = 177,779
  = printed Total income

expense components:
  34,710 + 36,590 + 2,924 + 3,427 + 4,881 = 82,532
  = printed expenses excluding depreciation

total expenses:
  82,532 + 28,560 = 111,092
  = printed B1-1 Total functions and activities expenses

operating result:
  177,779 - 111,092 = 66,687
  = printed Operating result

net result:
  66,687 = printed Net operating result attributable to Council

before capital grants:
  66,687 - 53,755 = 12,932
  = printed before-capital result (evidence only)

B1-1:
  income = 177,779
  expenses = 111,092
  operating result = 66,687
  grants = 30,848 + 53,755 = 84,603

other comprehensive income:
  revaluation           55,279
  = printed Total other comprehensive income for the year
  = printed Total items not reclassified

comprehensive income:
  66,687 + 55,279 = 121,966
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

## 5. Extracted entity rows (16, non-additive)

| `gpfs_line_item` | Printed/derived label | `$ '000` | `amount_cents` | Section |
| --- | --- | ---: | ---: | --- |
| `rates_and_annual_charges` | Rates and annual charges | 59,174 | 5,917,400,000 | revenue |
| `user_charges_and_fees` | User charges and fees | 22,184 | 2,218,400,000 | revenue |
| `other_revenues` | Other revenues | 3,013 | 301,300,000 | revenue |
| `government_grants_operating` | Grants and contributions — operating | 30,848 | 3,084,800,000 | revenue |
| `government_grants_capital` | Grants and contributions — capital | 53,755 | 5,375,500,000 | revenue |
| `interest_and_investment_income` | Interest and investment income | 8,805 | 880,500,000 | revenue |
| `total_revenue` | Total income from continuing operations | 177,779 | 17,777,900,000 | revenue |
| `employee_expenses` | Employee benefits and on-costs | 34,710 | 3,471,000,000 | expenses |
| `materials_and_services` | Materials and services | 36,590 | 3,659,000,000 | expenses |
| `borrowing_costs` | Borrowing costs | 2,924 | 292,400,000 | expenses |
| `other_expenses` | Other expenses | 3,427 | 342,700,000 | expenses |
| `net_loss_from_disposal_of_assets` | Net loss from the disposal of assets | 4,881 | 488,100,000 | expenses |
| `total_expenses_excluding_depreciation` | Total expenses excluding depreciation | 82,532 | 8,253,200,000 | expenses |
| `depreciation_amortisation_impairment` | Depreciation, amortisation and impairment | 28,560 | 2,856,000,000 | expenses |
| `total_expenses` | Total expenses (documented bridge) | 111,092 | 11,109,200,000 | expenses |
| `net_result` | Net operating result attributable to Council | 66,687 | 6,668,700,000 | result |

Every row is `jurisdiction_level: "local"`, `jurisdiction: "NSW"`,
`delivery_entity: "Kempsey Shire Council"`, `aggregation_role: "agency_detail"`,
`measure_type: "actual"`, `verified: false`, `data_quality_flag: "provisional/local_government"`.
Government grant rows carry `potential_double_count: true`.

## 6. No-total / no-cross-council rule

- Kempsey Shire Council is one entity. No council total, no state/national total and no sum with
  another council, the `dubbo-council` budget/estimate rows, a government program, the PNFC benchmark
  or the OLG summary layer is created.
- The FY2025-26 column is the reporting boundary; the FY2024-25 comparative is not added.
- Revenue, expenses, components and the net result overlap. They are published rows, not an additive
  spending series.
- Every row is `agency_detail` with no `region_id` and no `location`/LGA allocation.

## 7. Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`)

Targeted ingest of **only `kempsey-gpfs`** against the shared dev DB:

- total measures **998,796 → 998,812** (exactly **+16**);
- GPFS rows **1278 → 1294**;
- active GPFS `data_sources` **65 → 66**;
- SOC rows (`jurisdiction_level: "soc"`) stayed at **205**; every other per-source count unchanged;
- **0** non-`agency_detail` rows, **0** rows with `region_id`/`location`, one
  `delivery_entity` (`Kempsey Shire Council`), all rows `fiscal_year: "2025-26"`;
- `data_sources` has the source `active` with `records_ingested: 16`;
- the latest `ingestion_logs` entry is `status: "success"`, `records_fetched: 16`,
  `records_upserted: 16`;
- a second ingest upserted the same 16 SHA-anchored natural keys and left the total at **998,812**
  (idempotent, no duplicates).

## 8. How to verify

```bash
# Official page and the exact Part C PDF (plain UA; bare Chrome UA may 403).
curl -sL -o /dev/null -w '%{http_code}\n' \
  -A 'curl/8.5.0' 'https://www.kempsey.nsw.gov.au/Your-Council/Publications/Annual-reports-publications'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  -A 'curl/8.5.0' \
  'https://www.kempsey.nsw.gov.au/files/sharedassets/public/v/1/docs/departments/corporate-performance/planning-amp-reporting/2026-27/10-2-3-2025-26-annual-report-part-c-audited-financial-statements.pdf'

# Focused connector tests (17).
TEST_MONGO_URL="mongodb://localhost:27018/ausspend_test_kempseygpfs" \
  npx vitest run --project server server/test/kempsey-gpfs.test.ts
```

The focused suite covers the unit gate, exact reconciliation/zero tolerance (including the
single-component OCI), FY2025-26 current-available acceptance and rejection of 2023-24/2026-27
substitutions, natural-key/idempotency, no-cross-council totals and discovery/latest selection
(including Part A/B rejection, the last-range fiscal-year rule, the documented official fallback pin
and the plain-UA header).
