# NSW council GPFS — Bega Valley Shire Council FY2025-26 evidence

**Status:** implementation evidence only. One council, one audited year. The exact PDF is archived
outside the repo; no PDF or raw table is committed. **Entity:** Bega Valley Shire Council only.
**No council total, no state or national total, no OLG summary layer, no SOC/other council rows.**
The FY2025-26 column is used; the FY2024-25 comparative inside the statement is never added.

**Checked:** 2026-11-19 (Australia/Sydney).

## 0. Fiscal-year decision (current year)

FY2025-26 is the **current audited standalone financial statements** published by the council at
2026-11-19: the statements are for the year ended 30 June 2026. The connector targets `2025-26`; its
stale-year guard rejects prior years (2024-25 and 2023-24) rather than substituting them. The FY2024-25
upload is superseded and is no longer ingested.

## 1. Discovery and access log

| Step | URL | HTTP | Result |
| --- | --- | --- | --- |
| Official Financial Statements page | <https://www.begavalley.nsw.gov.au/About-Council/Plans-and-Reporting/Financial-Statements> | **200** | `text/html; charset=utf-8`, 173,955 bytes; lists AFS PDFs for 2012–2026. |
| FY2025-26 annual financial statements | <https://www.begavalley.nsw.gov.au/files/assets/public/v/2/adopted-plans-and-strategies/01-integrated-planning-and-reporting/financial-statements/annual_financial_statements-2026.pdf> | **200** | `application/pdf`, 3,371,024 bytes, 101 PDF pages; `last-modified: Tue, 03 Nov 2026 00:05:01 GMT`, `etag: "bdf61cc9-dc61-4010-b3cc-728cf1771d31"`. |

The connector parses the official Financial Statements page, selects the **year ended 30 June 2026**
anchor, and ignores prior-year documents and off-host mirrors. A documented official fallback pin
(the exact PDF URL) is used only if the page yields no usable anchor.

**Akamai UA quirk.** The host is UA-sensitive: a plain client UA (`curl/8.5.0`) returns **200**
`application/pdf`; a bare Chrome UA returns **403**. The connector sends an explicit plain client UA
(plus a broad PDF/HTML `Accept`) for both the listing and the PDF; a focused test asserts that header
is used.

The exact bytes are SHA-256 re-verified before parsing.

## 2. Exact document

- **Title:** Bega Valley Shire Council Annual Financial Statements for the year ended 30 June 2026
  (standalone audited General Purpose Financial Statements).
- **Financial year:** 2025-26, for the year ended 30 June 2026.
- **URL:** `https://www.begavalley.nsw.gov.au/files/assets/public/v/2/adopted-plans-and-strategies/01-integrated-planning-and-reporting/financial-statements/annual_financial_statements-2026.pdf`
- **Bytes:** 3,371,024.
- **PDF pages:** 101.
- **SHA-256:** `647575d7038f30c303cfe59e67d7011ca117db24c9f35d10dec68416230e26b2`.
- **Archive:** `bega-valley-gpfs/annual_financial_statements-2026.pdf` under the configured
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
  Rates and annual charges                               81,466
  User charges and fees                                  25,191
  Other revenues                                          1,295
  Grants and contributions provided for operating purposes 33,458
  Grants and contributions provided for capital purposes 20,497
  Interest and investment income                          7,130
  Total income from continuing operations                169,037
Expenses from continuing operations
  Employee benefits and on-costs                         47,460
  Materials and services                                 44,373
  Borrowing costs                                           621
  Other expenses                                          1,826
  Net loss from the disposal of assets                    8,213
  Total expenses ... excluding depreciation              102,493
  Depreciation, amortisation and impairment              43,409
  Operating result from continuing operations             23,135
  Net operating result attributable to Council            23,135
  Net operating result before capital grants              2,638
```

Bega Valley prints **six revenue lines** (there is no separate "Other income" line) and five expense
lines. The statement prints **no Total expenses line**; total expenses is the printed face bridge:
expenses-excluding-depreciation `102,493` + depreciation/amortisation/impairment `43,409` = `145,902`,
which equals the B1-1 "Total functions and activities" expense total.

## 4. Reconciliation (zero tolerance)

All arithmetic is in whole printed `$ '000` values:

```text
revenue components:
  81,466 + 25,191 + 1,295 + 33,458 + 20,497 + 7,130 = 169,037
  = printed Total income

expense components:
  47,460 + 44,373 + 621 + 1,826 + 8,213 = 102,493
  = printed expenses excluding depreciation

total expenses:
  102,493 + 43,409 = 145,902
  = printed B1-1 Total functions and activities expenses

operating result:
  169,037 - 145,902 = 23,135
  = printed Operating result

net result:
  23,135 = printed Net operating result attributable to Council

before capital grants:
  23,135 - 20,497 = 2,638
  = printed before-capital result (evidence only)

B1-1:
  income = 169,037
  expenses = 145,902
  operating result = 23,135
  grants = 33,458 + 20,497 = 53,955

other comprehensive income:
  revaluation                                69,153
  other reserve movements (remediation)         123
  sum                                         69,276
  = printed Total other comprehensive income for the year

comprehensive income:
  23,135 + 69,276 = 92,411
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

## 5. Extracted entity rows (16, non-additive)

| `gpfs_line_item` | Printed/derived label | `$ '000` | `amount_cents` | Section |
| --- | --- | ---: | ---: | --- |
| `rates_and_annual_charges` | Rates and annual charges | 81,466 | 8,146,600,000 | revenue |
| `user_charges_and_fees` | User charges and fees | 25,191 | 2,519,100,000 | revenue |
| `other_revenues` | Other revenues | 1,295 | 129,500,000 | revenue |
| `government_grants_operating` | Grants and contributions — operating | 33,458 | 3,345,800,000 | revenue |
| `government_grants_capital` | Grants and contributions — capital | 20,497 | 2,049,700,000 | revenue |
| `interest_and_investment_income` | Interest and investment income | 7,130 | 713,000,000 | revenue |
| `total_revenue` | Total income from continuing operations | 169,037 | 16,903,700,000 | revenue |
| `employee_expenses` | Employee benefits and on-costs | 47,460 | 4,746,000,000 | expenses |
| `materials_and_services` | Materials and services | 44,373 | 4,437,300,000 | expenses |
| `borrowing_costs` | Borrowing costs | 621 | 62,100,000 | expenses |
| `other_expenses` | Other expenses | 1,826 | 182,600,000 | expenses |
| `net_loss_from_disposal_of_assets` | Net loss from the disposal of assets | 8,213 | 821,300,000 | expenses |
| `total_expenses_excluding_depreciation` | Total expenses excluding depreciation | 102,493 | 10,249,300,000 | expenses |
| `depreciation_amortisation_impairment` | Depreciation, amortisation and impairment | 43,409 | 4,340,900,000 | expenses |
| `total_expenses` | Total expenses (documented bridge) | 145,902 | 14,590,200,000 | expenses |
| `net_result` | Net operating result attributable to Council | 23,135 | 2,313,500,000 | result |

Every row is `jurisdiction_level: "local"`, `jurisdiction: "NSW"`,
`delivery_entity: "Bega Valley Shire Council"`, `aggregation_role: "agency_detail"`,
`measure_type: "actual"`, `verified: false`, `data_quality_flag: "provisional/local_government"`.
Government grant rows carry `potential_double_count: true`.

## 6. No-total / no-cross-council rule

- Bega Valley Shire Council is one entity. No council total, no state/national total and no sum with
  another council, the `dubbo-council` budget/estimate rows, a government program, the PNFC benchmark
  or the OLG summary layer is created.
- The FY2025-26 column is the reporting boundary; the FY2024-25 comparative is not added.
- Revenue, expenses, components and the net result overlap. They are published rows, not an additive
  spending series.
- Every row is `agency_detail` with no `region_id` and no `location`/LGA allocation.

## 7. Database retarget proof (2026-11-19, shared dev DB `ausspend_dev`)

The prior FY2024-25 rows for `bega-valley-gpfs` were deleted, then the connector was re-ingested:

- stale delete: **16** rows removed; total **998,947 → 998,931**, GPFS rows **1429 → 1413**;
- targeted ingest: **998,931 → 998,947** (exactly **+16**);
- GPFS rows **1413 → 1429**; active GPFS `data_sources` remains **74** (same source id);
- SOC rows (`jurisdiction_level: "soc"`) stayed at **205**; every other per-source count unchanged;
- **0** stale rows remain: `source_id=bega-valley-gpfs` has 16 rows, all `fiscal_year: "2025-26"`;
- **0** non-`agency_detail` rows, **0** rows with `region_id`/`location`, one
  `delivery_entity` (`Bega Valley Shire Council`);
- `data_sources` has the source `active` with `records_ingested: 16`;
- the latest `ingestion_logs` entry is `status: "success"`, `records_fetched: 16`,
  `records_upserted: 16`.

## 8. How to verify

```bash
# Official page and the exact financial statements PDF (plain UA; Chrome UA 403).
curl -sL -o /dev/null -w '%{http_code}\n' \
  -A 'curl/8.5.0' 'https://www.begavalley.nsw.gov.au/About-Council/Plans-and-Reporting/Financial-Statements'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  -A 'curl/8.5.0' \
  'https://www.begavalley.nsw.gov.au/files/assets/public/v/2/adopted-plans-and-strategies/01-integrated-planning-and-reporting/financial-statements/annual_financial_statements-2026.pdf'

# Focused connector tests (18).
TEST_MONGO_URL="mongodb://localhost:27018/ausspend_test_begavalleygpfs" \
  npx vitest run --project server server/test/bega-valley-gpfs.test.ts
```

The focused suite covers the unit gate, exact reconciliation/zero tolerance (including both OCI
components), FY2025-26 acceptance and rejection of the 2024-25 and 2023-24 documents, natural-key/
idempotency, no-cross-council totals and discovery/latest selection (including the documented
official fallback pin and the plain-UA header).
