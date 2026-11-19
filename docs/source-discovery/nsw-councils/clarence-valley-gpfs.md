# NSW council GPFS — Clarence Valley Council FY2025-26 evidence

**Status:** implementation evidence only. One council, one audited year. The exact PDF is archived
outside the repo; no PDF or raw table is committed. **Entity:** Clarence Valley Council only.
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
| Official Annual Reports and statements page | <https://www.clarence.nsw.gov.au/Council/Our-performance/Annual-Reports-and-statements> | **200** | `text/html; charset=utf-8`, 120,536 bytes; lists annual reports and AFS/auditor reports (current AFS anchor not yet added at check time). |
| FY2025-26 financial statements (on exhibition) | <https://www.clarence.nsw.gov.au/files/assets/public/v/1/home-page/on-exhibition/clarence-valley-council-financial-statements-2025-26.pdf> | **200** | `application/pdf`, 3,602,292 bytes, 105 PDF pages. |

**Correct host.** The official host is `clarence.nsw.gov.au`; `clarencevalley.nsw.gov.au` does not
resolve.

**Discovery / fallback pin.** At 2026-11-19 the Annual Reports and statements page lists the
2025-26 annual report but **does not yet link the 2025-26 AFS**; the statements sit on the council's
`/home-page/on-exhibition/` path. The connector parses the official page for a FY2025-26
financial-statements anchor and, when the page yields no usable anchor, uses the **documented
official fallback pin** (the exact on-exhibition PDF URL). The focused suite exercises both paths —
anchor discovery/selection from HTML and pin fallback when the page has no current anchor.

**Akamai UA quirk.** The same PDF URL returns **200** `application/pdf` to a plain client UA
(`curl/8.5.0`); a bare Chrome UA can return **403**. The connector sends an explicit plain client UA
(plus a broad PDF/HTML `Accept`) for both the listing and the PDF; a focused test asserts that header
is used and contains no `Chrome` token.

The exact bytes are SHA-256 re-verified before parsing.

## 2. Exact document

- **Title:** Financial Statements 2025-26 (standalone audited General Purpose Financial Statements,
  year ended 30 June 2026).
- **Financial year:** 2025-26, for the year ended 30 June 2026.
- **URL:** `https://www.clarence.nsw.gov.au/files/assets/public/v/1/home-page/on-exhibition/clarence-valley-council-financial-statements-2025-26.pdf`
- **Bytes:** 3,602,292.
- **PDF pages:** 105.
- **SHA-256:** `080fe8a0808ce675aca13c8750bf3a18c07328fc674e4f7e11fff4b59708e72b`.
- **Archive:** `clarence-valley-gpfs/clarence-valley-council-financial-statements-2025-26.pdf` under
  the configured source-archive root (outside the repo; not committed). It holds the exact PDF plus
  archive metadata (URL, retrieval date, bytes, SHA-256, content type) and the archive record. The
  connector re-verifies the hash before parsing.

## 3. Printed unit and statement

The Income Statement is on PDF page 5 (printed page 4). It prints `$ '000`. The unit gate requires
**`$ '000` / thousands**; a plain `$`, `$M` or unit-less read is rejected. The adapter reads the
FY2025-26 Actual column only, not the Original unaudited budget column that prints before each label.

The FY2025-26 column prints (whole `$ '000`):

```text
Income from continuing operations
  Rates and annual charges                               85,316
  User charges and fees                                  55,355
  Other revenues                                          3,206
  Grants and contributions provided for operating purposes 40,542
  Grants and contributions provided for capital purposes 71,249
  Interest and investment income                          8,122
  Other income                                              863
  Total income from continuing operations                264,653
Expenses from continuing operations
  Employee benefits and on-costs                         51,113
  Materials and services                                 62,239
  Borrowing costs                                         5,672
  Other expenses                                          7,530
  Net loss from the disposal of assets                    2,825
  Total expenses ... excluding depreciation              129,379
  Depreciation, amortisation and impairment              63,904
  Operating result from continuing operations            71,370
  Net operating result attributable to Council           71,370
  Net operating result before capital grants                121
```

The statement prints **no Total expenses line**. Total expenses is the printed face bridge:
expenses-excluding-depreciation `129,379` + depreciation/amortisation/impairment `63,904` = `193,283`,
which equals the B1-1 "Total functions and activities" expense total.

## 4. Reconciliation (zero tolerance)

All arithmetic is in whole printed `$ '000` values:

```text
revenue components:
  85,316 + 55,355 + 3,206 + 40,542 + 71,249 + 8,122 + 863 = 264,653
  = printed Total income

expense components:
  51,113 + 62,239 + 5,672 + 7,530 + 2,825 = 129,379
  = printed expenses excluding depreciation

total expenses:
  129,379 + 63,904 = 193,283
  = printed B1-1 Total functions and activities expenses

operating result:
  264,653 - 193,283 = 71,370
  = printed Operating result

net result:
  71,370 = printed Net operating result attributable to Council

before capital grants:
  71,370 - 71,249 = 121
  = printed before-capital result (evidence only)

B1-1:
  income = 264,653
  expenses = 193,283
  operating result = 71,370
  grants = 40,542 + 71,249 = 111,791

other comprehensive income:
  revaluation            6,786
  impairment reversal    3,866
  sum                   10,652
  = printed Other comprehensive income for the year

comprehensive income:
  71,370 + 10,652 = 82,022
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
| `rates_and_annual_charges` | Rates and annual charges | 85,316 | 8,531,600,000 | revenue |
| `user_charges_and_fees` | User charges and fees | 55,355 | 5,535,500,000 | revenue |
| `other_revenues` | Other revenues | 3,206 | 320,600,000 | revenue |
| `government_grants_operating` | Grants and contributions — operating | 40,542 | 4,054,200,000 | revenue |
| `government_grants_capital` | Grants and contributions — capital | 71,249 | 7,124,900,000 | revenue |
| `interest_and_investment_income` | Interest and investment income | 8,122 | 812,200,000 | revenue |
| `other_income` | Other income | 863 | 86,300,000 | revenue |
| `total_revenue` | Total income from continuing operations | 264,653 | 26,465,300,000 | revenue |
| `employee_expenses` | Employee benefits and on-costs | 51,113 | 5,111,300,000 | expenses |
| `materials_and_services` | Materials and services | 62,239 | 6,223,900,000 | expenses |
| `borrowing_costs` | Borrowing costs | 5,672 | 567,200,000 | expenses |
| `other_expenses` | Other expenses | 7,530 | 753,000,000 | expenses |
| `net_loss_from_disposal_of_assets` | Net loss from the disposal of assets | 2,825 | 282,500,000 | expenses |
| `total_expenses_excluding_depreciation` | Total expenses excluding depreciation | 129,379 | 12,937,900,000 | expenses |
| `depreciation_amortisation_impairment` | Depreciation, amortisation and impairment | 63,904 | 6,390,400,000 | expenses |
| `total_expenses` | Total expenses (documented bridge) | 193,283 | 19,328,300,000 | expenses |
| `net_result` | Net operating result attributable to Council | 71,370 | 7,137,000,000 | result |

Every row is `jurisdiction_level: "local"`, `jurisdiction: "NSW"`,
`delivery_entity: "Clarence Valley Council"`, `aggregation_role: "agency_detail"`,
`measure_type: "actual"`, `verified: false`, `data_quality_flag: "provisional/local_government"`.
Government grant rows carry `potential_double_count: true`.

## 6. No-total / no-cross-council rule

- Clarence Valley Council is one entity. No council total, no state/national total and no sum with
  another council, the `dubbo-council` budget/estimate rows, a government program, the PNFC benchmark
  or the OLG summary layer is created.
- The FY2025-26 column is the reporting boundary; the FY2024-25 comparative is not added.
- Revenue, expenses, components and the net result overlap. They are published rows, not an additive
  spending series.
- Every row is `agency_detail` with no `region_id` and no `location`/LGA allocation.

## 7. Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`)

Targeted ingest of **only `clarence-valley-gpfs`** against the shared dev DB:

- total measures **998,762 → 998,779** (exactly **+17**);
- GPFS rows **1244 → 1261**;
- active GPFS `data_sources` **63 → 64**;
- SOC rows (`jurisdiction_level: "soc"`) stayed at **205**; every other per-source count unchanged;
- **0** non-`agency_detail` rows, **0** rows with `region_id`/`location`, one
  `delivery_entity` (`Clarence Valley Council`), all rows `fiscal_year: "2025-26"`;
- `data_sources` has the source `active` with `records_ingested: 17`;
- the latest `ingestion_logs` entry is `status: "success"`, `records_fetched: 17`,
  `records_upserted: 17`;
- a second ingest upserted the same 17 SHA-anchored natural keys and left the total at **998,779**
  (idempotent, no duplicates).

## 8. How to verify

```bash
# Official page (200) and the exact financial-statements PDF (plain UA; Chrome UA may 403).
curl -sL -o /dev/null -w '%{http_code}\n' \
  -A 'curl/8.5.0' 'https://www.clarence.nsw.gov.au/Council/Our-performance/Annual-Reports-and-statements'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  -A 'curl/8.5.0' \
  'https://www.clarence.nsw.gov.au/files/assets/public/v/1/home-page/on-exhibition/clarence-valley-council-financial-statements-2025-26.pdf'

# Focused connector tests (17).
TEST_MONGO_URL="mongodb://localhost:27018/ausspend_test_clarencevalleygpfs" \
  npx vitest run --project server server/test/clarence-valley-gpfs.test.ts
```

The focused suite covers the unit gate, exact reconciliation/zero tolerance (including the
two-component OCI sum), FY2025-26 current-available acceptance and rejection of 2023-24/2026-27
substitutions, natural-key/idempotency, no-cross-council totals and discovery/latest selection
(including the documented official fallback pin and the plain-UA Akamai header).
