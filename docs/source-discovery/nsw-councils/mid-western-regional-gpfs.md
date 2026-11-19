# NSW council GPFS — Mid-Western Regional Council FY2025-26 evidence

**Status:** implementation evidence only. One council, one audited year. The exact PDF is archived
outside the repo; no PDF or raw table is committed. **Entity:** Mid-Western Regional Council only.
**No council total, no state or national total, no OLG summary layer, no SOC/other council rows.**
The FY2025-26 column is used; the FY2024-25 comparative inside the statement is never added.

**Checked:** 2026-11-19 (Australia/Sydney).

## 0. Fiscal-year decision (current-available, not calendar)

FY2025-26 is the **latest audited standalone financial statements** published by the council at
2026-11-19: the statements are for the year ended 30 June 2026. The connector targets `2025-26`, and
its stale-year guard rejects other years rather than silently substituting a 2026-27 or 2024-25
document.

## 1. Discovery and access log

| Step | URL | HTTP | Result |
| --- | --- | --- | --- |
| Official Financial statements and reports page | <https://www.midwestern.nsw.gov.au/Council/Policies-plans-and-reporting/Financial-statements-and-reports> | **200** | `text/html; charset=utf-8`, 120,059 bytes; lists annual reports and a separate financial-statements series. |
| FY2025-26 financial statements | <https://www.midwestern.nsw.gov.au/files/assets/public/v/2/council/plans-and-strategies/financial-statements/mwrc-financial-statements-2025-26.pdf> | **200** | `application/pdf`, 2,508,368 bytes, 90 PDF pages; `last-modified: Mon, 02 Nov 2026 00:15:02 GMT`, `etag: "846893e8-0025-4fc3-8f6e-a2e95e2107e5"`. |

The connector parses the official Financial statements and reports page, selects the financial
statements anchor (not the annual report), and ignores prior years and off-host mirrors. A documented
official fallback pin (the exact PDF URL) is used only if the page yields no usable anchor.

**Akamai UA quirk.** The host is UA-sensitive: a plain client UA (`curl/8.5.0`) returns **200**
`application/pdf`; a bare Chrome UA returns **403**. The connector sends an explicit plain client UA
(plus a broad PDF/HTML `Accept`) for both the listing and the PDF; a focused test asserts that header
is used.

The exact bytes are SHA-256 re-verified before parsing.

## 2. Exact document

- **Title:** Financial Statements 2025/26 (standalone audited General Purpose Financial Statements,
  year ended 30 June 2026).
- **Financial year:** 2025-26, for the year ended 30 June 2026.
- **URL:** `https://www.midwestern.nsw.gov.au/files/assets/public/v/2/council/plans-and-strategies/financial-statements/mwrc-financial-statements-2025-26.pdf`
- **Bytes:** 2,508,368.
- **PDF pages:** 90.
- **SHA-256:** `47999cc3fa37d7c59fdc592e58bce035bb570da3c6ebfa4f2bf64477d204bbc1`.
- **Archive:** `mid-western-regional-gpfs/mwrc-financial-statements-2025-26.pdf` under the configured
  source-archive root (outside the repo; not committed). It holds the exact PDF plus archive metadata
  (URL, retrieval date, bytes, SHA-256, content type) and the archive record. The connector
  re-verifies the hash before parsing.

## 3. Printed unit and statement

The Income Statement is on PDF page 5 (printed page 4). It prints `$ '000`. The unit gate requires
**`$ '000` / thousands**; a plain `$`, `$M` or unit-less read is rejected. The adapter reads the
FY2025-26 Actual column only (labelled 2026), not the Original unaudited budget column that prints
before each label.

The FY2025-26 column prints (whole `$ '000`):

```text
Income from continuing operations
  Rates and annual charges                               52,334
  User charges and fees                                  27,130
  Other revenues                                          1,549
  Grants and contributions provided for operating purposes 22,698
  Grants and contributions provided for capital purposes 14,863
  Interest and investment income                          6,317
  Other income                                            2,318
  Total income from continuing operations                127,209
Expenses from continuing operations
  Employee benefits and on-costs                         39,805
  Materials and services                                 33,627
  Borrowing costs                                           953
  Other expenses                                          1,703
  Net loss from the disposal of assets                    2,889
  Total expenses ... excluding depreciation              78,977
  Depreciation, amortisation and impairment              29,342
  Operating result from continuing operations            18,890
  Net operating result attributable to Council           18,890
  Net operating result before capital grants              4,027
```

The statement prints **no Total expenses line**. Total expenses is the printed face bridge:
expenses-excluding-depreciation `78,977` + depreciation/amortisation/impairment `29,342` = `108,319`,
which equals the B1-1 "Total functions and activities" expense total.

## 4. Reconciliation (zero tolerance)

All arithmetic is in whole printed `$ '000` values:

```text
revenue components:
  52,334 + 27,130 + 1,549 + 22,698 + 14,863 + 6,317 + 2,318 = 127,209
  = printed Total income

expense components:
  39,805 + 33,627 + 953 + 1,703 + 2,889 = 78,977
  = printed expenses excluding depreciation

total expenses:
  78,977 + 29,342 = 108,319
  = printed B1-1 Total functions and activities expenses

operating result:
  127,209 - 108,319 = 18,890
  = printed Operating result

net result:
  18,890 = printed Net operating result attributable to Council

before capital grants:
  18,890 - 14,863 = 4,027
  = printed before-capital result (evidence only)

B1-1:
  income = 127,209
  expenses = 108,319
  operating result = 18,890
  grants = 22,698 + 14,863 = 37,561

other comprehensive income:
  revaluation                         54,434
  impairment reversal                   -321
  remediation provision movements        108
  sum                                 54,221
  = printed Total other comprehensive income for the year

comprehensive income:
  18,890 + 54,221 = 73,111
  = printed Total comprehensive income
```

B1-1 income is the face total revenue. The adapter checks `B1-1 operating result = printed net
result`, `B1-1 grants = operating grants + capital grants`, `B1-1 income = face total revenue`,
`B1-1 expenses = face total expenses bridge` and `B1-1 income − B1-1 expenses = printed net result`.
The three printed OCI components are summed and checked against the printed OCI. The before-capital
result is retained in reconciliation evidence only, not emitted as a row.

The adapter defers the document with **0 rows** if any printed line is missing, if the unit is not
thousands, or if any of these bridges differs by one thousand. On the audited FY2025-26 report there
is no deferral.

## 5. Extracted entity rows (17, non-additive)

| `gpfs_line_item` | Printed/derived label | `$ '000` | `amount_cents` | Section |
| --- | --- | ---: | ---: | --- |
| `rates_and_annual_charges` | Rates and annual charges | 52,334 | 5,233,400,000 | revenue |
| `user_charges_and_fees` | User charges and fees | 27,130 | 2,713,000,000 | revenue |
| `other_revenues` | Other revenues | 1,549 | 154,900,000 | revenue |
| `government_grants_operating` | Grants and contributions — operating | 22,698 | 2,269,800,000 | revenue |
| `government_grants_capital` | Grants and contributions — capital | 14,863 | 1,486,300,000 | revenue |
| `interest_and_investment_income` | Interest and investment income | 6,317 | 631,700,000 | revenue |
| `other_income` | Other income | 2,318 | 231,800,000 | revenue |
| `total_revenue` | Total income from continuing operations | 127,209 | 12,720,900,000 | revenue |
| `employee_expenses` | Employee benefits and on-costs | 39,805 | 3,980,500,000 | expenses |
| `materials_and_services` | Materials and services | 33,627 | 3,362,700,000 | expenses |
| `borrowing_costs` | Borrowing costs | 953 | 95,300,000 | expenses |
| `other_expenses` | Other expenses | 1,703 | 170,300,000 | expenses |
| `net_loss_from_disposal_of_assets` | Net loss from the disposal of assets | 2,889 | 288,900,000 | expenses |
| `total_expenses_excluding_depreciation` | Total expenses excluding depreciation | 78,977 | 7,897,700,000 | expenses |
| `depreciation_amortisation_impairment` | Depreciation, amortisation and impairment | 29,342 | 2,934,200,000 | expenses |
| `total_expenses` | Total expenses (documented bridge) | 108,319 | 10,831,900,000 | expenses |
| `net_result` | Net operating result attributable to Council | 18,890 | 1,889,000,000 | result |

Every row is `jurisdiction_level: "local"`, `jurisdiction: "NSW"`,
`delivery_entity: "Mid-Western Regional Council"`, `aggregation_role: "agency_detail"`,
`measure_type: "actual"`, `verified: false`, `data_quality_flag: "provisional/local_government"`.
Government grant rows carry `potential_double_count: true`.

## 6. No-total / no-cross-council rule

- Mid-Western Regional Council is one entity. No council total, no state/national total and no sum
  with another council, the `dubbo-council` budget/estimate rows, a government program, the PNFC
  benchmark or the OLG summary layer is created.
- The FY2025-26 column is the reporting boundary; the FY2024-25 comparative is not added.
- Revenue, expenses, components and the net result overlap. They are published rows, not an additive
  spending series.
- Every row is `agency_detail` with no `region_id` and no `location`/LGA allocation.

## 7. Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`)

Targeted ingest of **only `mid-western-regional-gpfs`** against the shared dev DB:

- total measures **998,914 → 998,931** (exactly **+17**);
- GPFS rows **1396 → 1413**;
- active GPFS `data_sources` **72 → 73**;
- SOC rows (`jurisdiction_level: "soc"`) stayed at **205**; every other per-source count unchanged;
- **0** non-`agency_detail` rows, **0** rows with `region_id`/`location`, one
  `delivery_entity` (`Mid-Western Regional Council`), all rows `fiscal_year: "2025-26"`;
- `data_sources` has the source `active` with `records_ingested: 17`;
- the latest `ingestion_logs` entry is `status: "success"`, `records_fetched: 17`,
  `records_upserted: 17`;
- a second ingest upserted the same 17 SHA-anchored natural keys and left the total at **998,931**
  (idempotent, no duplicates).

## 8. How to verify

```bash
# Official page and the exact financial statements PDF (plain UA; Chrome UA 403).
curl -sL -o /dev/null -w '%{http_code}\n' \
  -A 'curl/8.5.0' 'https://www.midwestern.nsw.gov.au/Council/Policies-plans-and-reporting/Financial-statements-and-reports'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  -A 'curl/8.5.0' \
  'https://www.midwestern.nsw.gov.au/files/assets/public/v/2/council/plans-and-strategies/financial-statements/mwrc-financial-statements-2025-26.pdf'

# Focused connector tests (18).
TEST_MONGO_URL="mongodb://localhost:27018/ausspend_test_midwesternregionalgpfs" \
  npx vitest run --project server server/test/mid-western-regional-gpfs.test.ts
```

The focused suite covers the unit gate, exact reconciliation/zero tolerance (including all three OCI
components), FY2025-26 current-available acceptance and rejection of 2024-25/2026-27 substitutions,
natural-key/idempotency, no-cross-council totals and discovery/latest selection (including
annual-report rejection, the documented official fallback pin and the plain-UA header).
