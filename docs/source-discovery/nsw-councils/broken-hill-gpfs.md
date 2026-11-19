# NSW council GPFS — Broken Hill City Council FY2024-25 evidence

**Status:** implementation evidence only. One council, one audited year. The exact PDF is archived
outside the repo; no PDF or raw table is committed. **Entity:** Broken Hill City Council only.
**No council total, no state or national total, no OLG summary layer, no SOC/other council rows.**
The FY2024-25 column is used; the FY2023-24 comparative inside the statement is never added.

**Checked:** 2026-11-19 (Australia/Sydney).

## 0. Fiscal-year decision (current-available, not calendar)

FY2024-25 is the **latest published audited standalone General Purpose Financial Statements** at
2026-11-19: the statements are for the year ended 30 June 2025. No FY2025-26 GPFS is posted. The
accepted current-available year is therefore `2024-25`; the connector targets `2024-25` and its
stale-year guard rejects other years rather than substituting a 2025-26 or 2023-24 document.

## 1. Discovery and access log

| Step | URL | HTTP | Result |
| --- | --- | --- | --- |
| Official Council Reports page | <https://www.brokenhill.nsw.gov.au/Council/Reports> | **200** | `text/html; charset=utf-8`, 119,251 bytes; lists the annual report plus the annual financial statements. |
| FY2024-25 annual financial statements | <https://www.brokenhill.nsw.gov.au/files/assets/public/v/5/documents/financial-statements/broken-hill-city-council-annual-financial-statements-2025.pdf> | **200** | `application/pdf`, 3,400,140 bytes, 95 PDF pages. |

The connector parses the official Council Reports page, selects the financial statements anchor (not
the annual report), and ignores prior years and off-host mirrors. A documented official fallback pin
(the exact PDF URL) is used only if the page yields no usable anchor.

**Akamai UA quirk.** The host is UA-sensitive: a plain client UA (`curl/8.5.0`) returns **200**
`application/pdf`; a bare Chrome UA returns **403**. The connector sends an explicit plain client UA
(plus a broad PDF/HTML `Accept`) for both the listing and the PDF; a focused test asserts that header
is used.

The exact bytes are SHA-256 re-verified before parsing.

## 2. Exact document

- **Title:** Broken Hill City Council Annual Financial Statements 2025 (standalone audited General
  Purpose Financial Statements, year ended 30 June 2025).
- **Financial year:** 2024-25, for the year ended 30 June 2025.
- **URL:** `https://www.brokenhill.nsw.gov.au/files/assets/public/v/5/documents/financial-statements/broken-hill-city-council-annual-financial-statements-2025.pdf`
- **Bytes:** 3,400,140.
- **PDF pages:** 95.
- **SHA-256:** `b4ef2b7951f7de837d2ddb38e8aed886ee84d630ac1eb95f5e667acf915f079e`.
- **Archive:** `broken-hill-gpfs/broken-hill-city-council-annual-financial-statements-2025.pdf`
  under the configured source-archive root (outside the repo; not committed). It holds the exact PDF
  plus archive metadata (URL, retrieval date, bytes, SHA-256, content type) and the archive record.
  The connector re-verifies the hash before parsing.

## 3. Printed unit and statement

The Income Statement is on PDF page 6 (printed page 5). It prints `$ '000`. The unit gate requires
**`$ '000` / thousands**; a plain `$`, `$M` or unit-less read is rejected. The adapter reads the
FY2024-25 Actual column only (labelled 2025), not the Original unaudited budget column that prints
before each label.

The FY2024-25 column prints (whole `$ '000`):

```text
Income from continuing operations
  Rates and annual charges                               21,823
  User charges and fees                                   4,381
  Other revenues                                          1,033
  Grants and contributions provided for operating purposes 6,162
  Grants and contributions provided for capital purposes 13,243
  Interest and investment income                          1,407
  Other income                                              677
  Total income from continuing operations                48,726
Expenses from continuing operations
  Employee benefits and on-costs                         16,475
  Materials and services                                 12,578
  Borrowing costs                                           758
  Other expenses                                          1,444
  Net loss from the disposal of assets                      438
  Total expenses ... excluding depreciation              31,693
  Depreciation, amortisation and impairment               7,382
  Operating result from continuing operations             9,651
  Net operating result attributable to Council            9,651
  Net operating result before capital grants             (3,592)
```

The statement prints **no Total expenses line**. Total expenses is the printed face bridge:
expenses-excluding-depreciation `31,693` + depreciation/amortisation/impairment `7,382` = `39,075`,
which equals the B1-1 "Total functions and activities" expense total.

## 4. Reconciliation (zero tolerance)

All arithmetic is in whole printed `$ '000` values:

```text
revenue components:
  21,823 + 4,381 + 1,033 + 6,162 + 13,243 + 1,407 + 677 = 48,726
  = printed Total income

expense components:
  16,475 + 12,578 + 758 + 1,444 + 438 = 31,693
  = printed expenses excluding depreciation

total expenses:
  31,693 + 7,382 = 39,075
  = printed B1-1 Total functions and activities expenses

operating result:
  48,726 - 39,075 = 9,651
  = printed Operating result

net result:
  9,651 = printed Net operating result attributable to Council

before capital grants:
  9,651 - 13,243 = -3,592
  = printed before-capital result (evidence only)

B1-1:
  income = 48,726
  expenses = 39,075
  operating result = 9,651
  grants = 6,162 + 13,243 = 19,405

other comprehensive income:
  revaluation           14,469
  = printed Total other comprehensive income for the year
  = printed Total items not reclassified

comprehensive income:
  9,651 + 14,469 = 24,120
  = printed Total comprehensive income
```

B1-1 income is the face total revenue. The adapter checks `B1-1 operating result = printed net
result`, `B1-1 grants = operating grants + capital grants`, `B1-1 income = face total revenue`,
`B1-1 expenses = face total expenses bridge` and `B1-1 income − B1-1 expenses = printed net result`.
The single printed OCI component is checked against the printed OCI. The before-capital result is
retained in reconciliation evidence only, not emitted as a row.

The adapter defers the document with **0 rows** if any printed line is missing, if the unit is not
thousands, or if any of these bridges differs by one thousand. On the audited FY2024-25 report there
is no deferral.

## 5. Extracted entity rows (17, non-additive)

| `gpfs_line_item` | Printed/derived label | `$ '000` | `amount_cents` | Section |
| --- | --- | ---: | ---: | --- |
| `rates_and_annual_charges` | Rates and annual charges | 21,823 | 2,182,300,000 | revenue |
| `user_charges_and_fees` | User charges and fees | 4,381 | 438,100,000 | revenue |
| `other_revenues` | Other revenues | 1,033 | 103,300,000 | revenue |
| `government_grants_operating` | Grants and contributions — operating | 6,162 | 616,200,000 | revenue |
| `government_grants_capital` | Grants and contributions — capital | 13,243 | 1,324,300,000 | revenue |
| `interest_and_investment_income` | Interest and investment income | 1,407 | 140,700,000 | revenue |
| `other_income` | Other income | 677 | 67,700,000 | revenue |
| `total_revenue` | Total income from continuing operations | 48,726 | 4,872,600,000 | revenue |
| `employee_expenses` | Employee benefits and on-costs | 16,475 | 1,647,500,000 | expenses |
| `materials_and_services` | Materials and services | 12,578 | 1,257,800,000 | expenses |
| `borrowing_costs` | Borrowing costs | 758 | 75,800,000 | expenses |
| `other_expenses` | Other expenses | 1,444 | 144,400,000 | expenses |
| `net_loss_from_disposal_of_assets` | Net loss from the disposal of assets | 438 | 43,800,000 | expenses |
| `total_expenses_excluding_depreciation` | Total expenses excluding depreciation | 31,693 | 3,169,300,000 | expenses |
| `depreciation_amortisation_impairment` | Depreciation, amortisation and impairment | 7,382 | 738,200,000 | expenses |
| `total_expenses` | Total expenses (documented bridge) | 39,075 | 3,907,500,000 | expenses |
| `net_result` | Net operating result attributable to Council | 9,651 | 965,100,000 | result |

Every row is `jurisdiction_level: "local"`, `jurisdiction: "NSW"`,
`delivery_entity: "Broken Hill City Council"`, `aggregation_role: "agency_detail"`,
`measure_type: "actual"`, `verified: false`, `data_quality_flag: "provisional/local_government"`.
Government grant rows carry `potential_double_count: true`.

## 6. No-total / no-cross-council rule

- Broken Hill City Council is one entity. No council total, no state/national total and no sum with
  another council, the `dubbo-council` budget/estimate rows, a government program, the PNFC benchmark
  or the OLG summary layer is created.
- The FY2024-25 column is the reporting boundary; the FY2023-24 comparative is not added.
- Revenue, expenses, components and the net result overlap. They are published rows, not an additive
  spending series.
- Every row is `agency_detail` with no `region_id` and no `location`/LGA allocation.

## 7. Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`)

Targeted ingest of **only `broken-hill-gpfs`** against the shared dev DB:

- total measures **998,863 → 998,880** (exactly **+17**);
- GPFS rows **1345 → 1362**;
- active GPFS `data_sources` **69 → 70**;
- SOC rows (`jurisdiction_level: "soc"`) stayed at **205**; every other per-source count unchanged;
- **0** non-`agency_detail` rows, **0** rows with `region_id`/`location`, one
  `delivery_entity` (`Broken Hill City Council`), all rows `fiscal_year: "2024-25"`;
- `data_sources` has the source `active` with `records_ingested: 17`;
- the latest `ingestion_logs` entry is `status: "success"`, `records_fetched: 17`,
  `records_upserted: 17`;
- a second ingest upserted the same 17 SHA-anchored natural keys and left the total at **998,880**
  (idempotent, no duplicates).

## 8. How to verify

```bash
# Official page and the exact financial statements PDF (plain UA; Chrome UA 403).
curl -sL -o /dev/null -w '%{http_code}\n' \
  -A 'curl/8.5.0' 'https://www.brokenhill.nsw.gov.au/Council/Reports'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  -A 'curl/8.5.0' \
  'https://www.brokenhill.nsw.gov.au/files/assets/public/v/5/documents/financial-statements/broken-hill-city-council-annual-financial-statements-2025.pdf'

# Focused connector tests (17).
TEST_MONGO_URL="mongodb://localhost:27018/ausspend_test_brokenhillgpfs" \
  npx vitest run --project server server/test/broken-hill-gpfs.test.ts
```

The focused suite covers the unit gate, exact reconciliation/zero tolerance (including the
single-component OCI), FY2024-25 current-available acceptance and rejection of 2023-24/2025-26
substitutions, natural-key/idempotency, no-cross-council totals and discovery/latest selection
(including annual-report rejection, the documented official fallback pin and the plain-UA header).
