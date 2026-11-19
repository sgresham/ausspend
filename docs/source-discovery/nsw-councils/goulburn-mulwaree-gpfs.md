# NSW council GPFS — Goulburn Mulwaree Council FY2024-25 evidence

**Status:** implementation evidence only. One council, one audited year. The exact PDF is archived
outside the repo; no PDF or raw table is committed. **Entity:** Goulburn Mulwaree Council only.
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
| Official Integrated Planning Reporting page | <https://www.goulburn.nsw.gov.au/Council/Integrated-Planning-Reporting> | **200** | `text/html; charset=utf-8`, 110,459 bytes; lists paired annual report + audited financial statements PDFs. |
| FY2024-25 audited financial statements | <https://www.goulburn.nsw.gov.au/files/sharedassets/public/v/1/finance-ipampr-docs/gmc-financial-statements-2024-2025.pdf> | **200** | `application/pdf`, 4,127,664 bytes, 109 PDF pages. |

The connector parses the official Integrated Planning Reporting page, accepts the audited financial
statements anchor, and ignores the paired annual report, prior years and off-host mirrors. A
documented official fallback pin (the exact PDF URL) is used only if the page yields no usable anchor.

**Akamai UA quirk.** The host is UA-sensitive: a plain client UA (`curl/8.5.0`) returns **200**
`application/pdf`; a bare Chrome UA returns **403**. The connector sends an explicit plain client UA
(plus a broad PDF/HTML `Accept`) for both the listing and the PDF; a focused test asserts that header
is used.

The exact bytes are SHA-256 re-verified before parsing.

## 2. Exact document

- **Title:** GMC Financial Statements 2024-2025 (standalone audited General Purpose Financial
  Statements, year ended 30 June 2025).
- **Financial year:** 2024-25, for the year ended 30 June 2025.
- **URL:** `https://www.goulburn.nsw.gov.au/files/sharedassets/public/v/1/finance-ipampr-docs/gmc-financial-statements-2024-2025.pdf`
- **Bytes:** 4,127,664.
- **PDF pages:** 109.
- **SHA-256:** `8c8e17c0ad6a0dd4066e734839edb47911ec006fd5d394e999390a1bdf1aac6f`.
- **Archive:** `goulburn-mulwaree-gpfs/gmc-financial-statements-2024-2025.pdf` under the configured
  source-archive root (outside the repo; not committed). It holds the exact PDF plus archive metadata
  (URL, retrieval date, bytes, SHA-256, content type) and the archive record. The connector
  re-verifies the hash before parsing.

## 3. Printed unit and statement

The Income Statement is on PDF page 5 (printed page 4). It prints `$ '000`. The unit gate requires
**`$ '000` / thousands**; a plain `$`, `$M` or unit-less read is rejected. The adapter reads the
FY2024-25 Actual column only (labelled 2025), not the Original unaudited budget column that prints
before each label.

The FY2024-25 column prints (whole `$ '000`):

```text
Income from continuing operations
  Rates and annual charges                               49,576
  User charges and fees                                  23,936
  Other revenues                                          2,255
  Grants and contributions provided for operating purposes 11,759
  Grants and contributions provided for capital purposes 52,686
  Interest and investment income                          6,950
  Other income                                               15
  Net gain from the disposal of assets                      – (nil, not emitted)
  Total income from continuing operations                147,177
Expenses from continuing operations
  Employee benefits and on-costs                         32,738
  Materials and services                                 30,237
  Borrowing costs                                         1,826
  Other expenses                                            943
  Net loss from the disposal of assets                    3,332
  Total expenses ... excluding depreciation              69,076
  Depreciation, amortisation and impairment              31,232
  Operating result from continuing operations            46,869
  Net operating result attributable to Council           46,869
  Net operating result before capital grants            (5,817)
```

The statement prints **no Total expenses line**. Total expenses is the printed face bridge:
expenses-excluding-depreciation `69,076` + depreciation/amortisation/impairment `31,232` = `100,308`,
which equals the B1-1 "Total functions and activities" expense total. The printed net gain on disposal
is nil and is not emitted.

## 4. Reconciliation (zero tolerance)

All arithmetic is in whole printed `$ '000` values:

```text
revenue components:
  49,576 + 23,936 + 2,255 + 11,759 + 52,686 + 6,950 + 15 = 147,177
  = printed Total income

expense components:
  32,738 + 30,237 + 1,826 + 943 + 3,332 = 69,076
  = printed expenses excluding depreciation

total expenses:
  69,076 + 31,232 = 100,308
  = printed B1-1 Total functions and activities expenses

operating result:
  147,177 - 100,308 = 46,869
  = printed Operating result

net result:
  46,869 = printed Net operating result attributable to Council

before capital grants:
  46,869 - 52,686 = -5,817
  = printed before-capital result (evidence only)

B1-1:
  income = 147,177
  expenses = 100,308
  operating result = 46,869
  grants = 11,759 + 52,686 = 64,445

other comprehensive income:
  revaluation           -42,544
  = printed Total other comprehensive income for the year
  = printed Total items not reclassified

comprehensive income:
  46,869 + (-42,544) = 4,325
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
| `rates_and_annual_charges` | Rates and annual charges | 49,576 | 4,957,600,000 | revenue |
| `user_charges_and_fees` | User charges and fees | 23,936 | 2,393,600,000 | revenue |
| `other_revenues` | Other revenues | 2,255 | 225,500,000 | revenue |
| `government_grants_operating` | Grants and contributions — operating | 11,759 | 1,175,900,000 | revenue |
| `government_grants_capital` | Grants and contributions — capital | 52,686 | 5,268,600,000 | revenue |
| `interest_and_investment_income` | Interest and investment income | 6,950 | 695,000,000 | revenue |
| `other_income` | Other income | 15 | 1,500,000 | revenue |
| `total_revenue` | Total income from continuing operations | 147,177 | 14,717,700,000 | revenue |
| `employee_expenses` | Employee benefits and on-costs | 32,738 | 3,273,800,000 | expenses |
| `materials_and_services` | Materials and services | 30,237 | 3,023,700,000 | expenses |
| `borrowing_costs` | Borrowing costs | 1,826 | 182,600,000 | expenses |
| `other_expenses` | Other expenses | 943 | 94,300,000 | expenses |
| `net_loss_from_disposal_of_assets` | Net loss from the disposal of assets | 3,332 | 333,200,000 | expenses |
| `total_expenses_excluding_depreciation` | Total expenses excluding depreciation | 69,076 | 6,907,600,000 | expenses |
| `depreciation_amortisation_impairment` | Depreciation, amortisation and impairment | 31,232 | 3,123,200,000 | expenses |
| `total_expenses` | Total expenses (documented bridge) | 100,308 | 10,030,800,000 | expenses |
| `net_result` | Net operating result attributable to Council | 46,869 | 4,686,900,000 | result |

Every row is `jurisdiction_level: "local"`, `jurisdiction: "NSW"`,
`delivery_entity: "Goulburn Mulwaree Council"`, `aggregation_role: "agency_detail"`,
`measure_type: "actual"`, `verified: false`, `data_quality_flag: "provisional/local_government"`.
Government grant rows carry `potential_double_count: true`.

## 6. No-total / no-cross-council rule

- Goulburn Mulwaree Council is one entity. No council total, no state/national total and no sum with
  another council, the `dubbo-council` budget/estimate rows, a government program, the PNFC benchmark
  or the OLG summary layer is created.
- The FY2024-25 column is the reporting boundary; the FY2023-24 comparative is not added.
- Revenue, expenses, components and the net result overlap. They are published rows, not an additive
  spending series.
- Every row is `agency_detail` with no `region_id` and no `location`/LGA allocation.

## 7. Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`)

Targeted ingest of **only `goulburn-mulwaree-gpfs`** against the shared dev DB:

- total measures **998,846 → 998,863** (exactly **+17**);
- GPFS rows **1328 → 1345**;
- active GPFS `data_sources` **68 → 69**;
- SOC rows (`jurisdiction_level: "soc"`) stayed at **205**; every other per-source count unchanged;
- **0** non-`agency_detail` rows, **0** rows with `region_id`/`location`, one
  `delivery_entity` (`Goulburn Mulwaree Council`), all rows `fiscal_year: "2024-25"`;
- `data_sources` has the source `active` with `records_ingested: 17`;
- the latest `ingestion_logs` entry is `status: "success"`, `records_fetched: 17`,
  `records_upserted: 17`;
- a second ingest upserted the same 17 SHA-anchored natural keys and left the total at **998,863**
  (idempotent, no duplicates).

## 8. How to verify

```bash
# Official page and the exact audited statements PDF (plain UA; Chrome UA 403).
curl -sL -o /dev/null -w '%{http_code}\n' \
  -A 'curl/8.5.0' 'https://www.goulburn.nsw.gov.au/Council/Integrated-Planning-Reporting'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  -A 'curl/8.5.0' \
  'https://www.goulburn.nsw.gov.au/files/sharedassets/public/v/1/finance-ipampr-docs/gmc-financial-statements-2024-2025.pdf'

# Focused connector tests (17).
TEST_MONGO_URL="mongodb://localhost:27018/ausspend_test_goulburnmulwareegpfs" \
  npx vitest run --project server server/test/goulburn-mulwaree-gpfs.test.ts
```

The focused suite covers the unit gate, exact reconciliation/zero tolerance (including the negative
single-component OCI), FY2024-25 current-available acceptance and rejection of 2023-24/2025-26
substitutions, natural-key/idempotency, no-cross-council totals and discovery/latest selection
(including annual-report rejection, the documented official fallback pin and the plain-UA header).
