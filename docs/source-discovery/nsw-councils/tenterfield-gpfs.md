# NSW council GPFS — Tenterfield Shire Council FY2025-26 evidence

**Status:** implementation evidence only. One council, one audited year. The exact PDF is archived
outside the repo; no PDF or raw table is committed. **Entity:** Tenterfield Shire Council only.
**No council total, no state or national total, no OLG summary layer, no SOC/other council rows.**
The FY2025-26 column is used; the FY2024-25 comparative inside the statement is never added.

**Checked:** 2026-11-19 (Australia/Sydney).

## 0. Fiscal-year decision (current year)

FY2025-26 is the **current audited standalone year** published by the council at 2026-11-19: the
statements are for the year ended 30 June 2026. The Financial Reports page lists 2025-26 as the newest
financial statements; no 2026/27 audited statements are posted. The connector targets `2025-26` and
rejects prior years (2024-25/2023-24). The listing writes the year pair space-separated
("2025 26"), which the link parser normalizes to 2025-26.

## 1. Discovery and access log

| Step | URL | HTTP | Result |
| --- | --- | --- | --- |
| Official Financial Reports page | <https://www.tenterfield.nsw.gov.au/your-council/council-documents/financial-reports> | **200** | `text/html`, 305,280 bytes; lists "Tenterfield Shire Council Financial Statements 2025 26" and older years, plus public notices and QBRs. |
| FY2025-26 audited financial statements | <https://www.tenterfield.nsw.gov.au/content/uploads/2026/11/Tenterfield-Shire-Council-Financial-Statements-2025-26.pdf> | **200** | `application/pdf`, 1,632,568 bytes, 104 PDF pages. |

The connector parses the official Financial Reports page, selects the **2025 26** financial
statements anchor, and ignores annual reports, public notices, quarterly budget reviews,
budget/planning documents, prior years and off-host mirrors. A documented official fallback pin (the
exact PDF URL) is used only if the page yields no usable anchor.

**Plain fetch.** The PDF serves normally to plain fetch; the connector sends an explicit plain
`curl/8.5.0` User-Agent (plus a broad PDF/HTML `Accept`) for deterministic discovery and download.
Tests assert that header is used.

The exact bytes are SHA-256 re-verified before parsing.

## 2. Exact document

- **Title:** Tenterfield Shire Council Financial Statements 2025 26 (standalone audited General
  Purpose Financial Statements, year ended 30 June 2026).
- **Financial year:** 2025-26.
- **URL:** `https://www.tenterfield.nsw.gov.au/content/uploads/2026/11/Tenterfield-Shire-Council-Financial-Statements-2025-26.pdf`
- **Bytes:** 1,632,568.
- **PDF pages:** 104.
- **SHA-256:** `c8f36ee616a3ef2b0cecec81bde2175c7a1a332522b4dd0a6ebe59d670736df8`.
- **Archive:** `tenterfield-gpfs/Tenterfield-Shire-Council-Financial-Statements-2025-26.pdf` under
  the configured source-archive root (outside the repo; not committed). It holds the exact PDF plus
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
  Rates and annual charges                               15,184
  User charges and fees                                   3,390
  Other revenues                                            507
  Grants and contributions provided for operating purposes 17,827
  Grants and contributions provided for capital purposes  8,484
  Interest and investment income                          2,837
  Other income                                              234
  Net gain from the disposal of assets                      – (nil, not emitted)
  Total income from continuing operations                48,463
Expenses from continuing operations
  Employee benefits and on-costs                          8,522
  Materials and services                                 17,967
  Borrowing costs                                           902
  Other expenses                                            677
  Net loss from the disposal of assets                    3,183
  Total expenses ... excluding depreciation              31,251
  Depreciation, amortisation and impairment               9,470
  Operating result from continuing operations             7,742
  Net operating result attributable to Council            7,742
  Net operating result before capital grants               (742)
```

The statement prints **no Total expenses line**. Total expenses is the printed face bridge:
expenses-excluding-depreciation `31,251` + depreciation/amortisation/impairment `9,470` = `40,721`,
which equals the B1-1 "Total functions and activities" expense total.

## 4. Reconciliation (zero tolerance)

All arithmetic in whole printed `$ '000` values:

```text
revenue components:
  15,184 + 3,390 + 507 + 17,827 + 8,484 + 2,837 + 234 = 48,463
  = printed Total income

expense components:
  8,522 + 17,967 + 902 + 677 + 3,183 = 31,251
  = printed expenses excluding depreciation

total expenses:
  31,251 + 9,470 = 40,721
  = printed B1-1 Total functions and activities expenses

operating result:
  48,463 - 40,721 = 7,742
  = printed Operating result

net result:
  7,742 = printed Net operating result attributable to Council

before capital grants:
  7,742 - 8,484 = -742
  = printed before-capital result (evidence only)

B1-1:
  income = 48,463
  expenses = 40,721
  operating result = 7,742
  grants = 17,827 + 8,484 = 26,311

other comprehensive income:
  revaluation           26,535
  = printed Total other comprehensive income for the year

comprehensive income:
  7,742 + 26,535 = 34,277
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
| `rates_and_annual_charges` | Rates and annual charges | 15,184 | 1,518,400,000 | revenue |
| `user_charges_and_fees` | User charges and fees | 3,390 | 339,000,000 | revenue |
| `other_revenues` | Other revenues | 507 | 50,700,000 | revenue |
| `government_grants_operating` | Grants and contributions — operating | 17,827 | 1,782,700,000 | revenue |
| `government_grants_capital` | Grants and contributions — capital | 8,484 | 848,400,000 | revenue |
| `interest_and_investment_income` | Interest and investment income | 2,837 | 283,700,000 | revenue |
| `other_income` | Other income | 234 | 23,400,000 | revenue |
| `total_revenue` | Total income from continuing operations | 48,463 | 4,846,300,000 | revenue |
| `employee_expenses` | Employee benefits and on-costs | 8,522 | 852,200,000 | expenses |
| `materials_and_services` | Materials and services | 17,967 | 1,796,700,000 | expenses |
| `borrowing_costs` | Borrowing costs | 902 | 90,200,000 | expenses |
| `other_expenses` | Other expenses | 677 | 67,700,000 | expenses |
| `net_loss_from_disposal_of_assets` | Net loss from the disposal of assets | 3,183 | 318,300,000 | expenses |
| `total_expenses_excluding_depreciation` | Total expenses excluding depreciation | 31,251 | 3,125,100,000 | expenses |
| `depreciation_amortisation_impairment` | Depreciation, amortisation and impairment | 9,470 | 947,000,000 | expenses |
| `total_expenses` | Total expenses (documented bridge) | 40,721 | 4,072,100,000 | expenses |
| `net_result` | Net operating result attributable to Council | 7,742 | 774,200,000 | result |

Every row is `jurisdiction_level: "local"`, `jurisdiction: "NSW"`,
`delivery_entity: "Tenterfield Shire Council"`, `aggregation_role: "agency_detail"`,
`measure_type: "actual"`, `verified: false`, `data_quality_flag: "provisional/local_government"`.
Government grant rows carry `potential_double_count: true`.

## 6. No-total / no-cross-council rule

- Tenterfield Shire Council is one entity. No council total, no state/national total and no sum with
  another council, the `dubbo-council` budget/estimate rows, a government program, the PNFC benchmark
  or the OLG summary layer is created.
- The FY2025-26 column is the reporting boundary; the FY2024-25 comparative is not added.
- Revenue, expenses, components and the net result overlap. They are published rows, not an additive
  spending series.
- Every row is `agency_detail` with no `region_id` and no `location`/LGA allocation.

## 7. Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`)

Targeted ingest of **only `tenterfield-gpfs`** against the shared dev DB:

- total measures **999,032 → 999,049** (exactly **+17**);
- GPFS rows **1514 → 1531**;
- active GPFS `data_sources` **79 → 80**;
- SOC rows (`jurisdiction_level: "soc"`) stayed at **205**; every other per-source count unchanged;
- **0** non-`agency_detail` rows, **0** rows with `region_id`/`location`, one
  `delivery_entity` (`Tenterfield Shire Council`), all rows `fiscal_year: "2025-26"`;
- `data_sources` has the source `active` with `records_ingested: 17`;
- the latest `ingestion_logs` entry is `status: "success"`, `records_fetched: 17`,
  `records_upserted: 17`.

## 8. How to verify

```bash
# Official Financial Reports page and the exact PDF.
curl -sL -o /dev/null -w '%{http_code}\n' \
  -A 'curl/8.5.0' 'https://www.tenterfield.nsw.gov.au/your-council/council-documents/financial-reports'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  -A 'curl/8.5.0' \
  'https://www.tenterfield.nsw.gov.au/content/uploads/2026/11/Tenterfield-Shire-Council-Financial-Statements-2025-26.pdf'

# Focused connector tests (17).
TEST_MONGO_URL="mongodb://localhost:27018/ausspend_test_tenterfieldgpfs" \
  npx vitest run --project server server/test/tenterfield-gpfs.test.ts
```

The focused suite covers the unit gate, exact reconciliation/zero tolerance, FY2025-26 acceptance
and rejection of 2024-25/2026-27 documents, space-separated year-pair parsing, natural-key/
idempotency, no-cross-council totals and discovery/latest selection (including annual-report, public
notice, QBR and mirror rejection, the documented official fallback pin and the plain-UA header).
