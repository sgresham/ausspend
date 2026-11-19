# NSW council GPFS — Snowy Monaro Regional Council FY2025-26 evidence

**Status:** implementation evidence only. One council, one audited year. The exact PDF is archived
outside the repo; no PDF or raw table is committed. **Entity:** Snowy Monaro Regional Council only.
**No council total, no state or national total, no OLG summary layer, no SOC/other council rows.**
The FY2025-26 column is used; the FY2024-25 comparative inside the statement is never added.

**Checked:** 2026-11-19 (Australia/Sydney).

## 0. Fiscal-year decision (bounded stale-year search)

The council's Integrated Planning page links the official Have Your Say notice
"Feedback invited on Council's audited 2025/26 Financial Statements". That notice redirects to the
official engagement platform (`yoursaysnowymonaro.com.au`) and carries a document library with:

- `Annual_Financial_Statements-GPFS-2026 29 October signed.pdf` — the **FY2025-26 audited GPFS**;
- `Annual_Financial_Statements-SPFS-2026 ...pdf` — special-purpose statements (rejected);
- `Snowy Monaro Regional Council Special Schedules Statements-2025-2026.pdf` — special schedules
  (rejected).

The FY2025-26 GPFS is therefore **directly downloadable from the official site** (via its official
engagement platform), and it is the year ingested. The older FY2024-25 GPFS
(`smrc-annual_financial_statements-gpfs-2025-final-audited.pdf`, still linked from the Integrated
Planning page) is **superseded** and is not ingested. The connector targets `2025-26` and rejects
2024-25/2023-24.

## 1. Discovery and access log

| Step | URL | HTTP | Result |
| --- | --- | --- | --- |
| Official Integrated Planning page | <https://www.snowymonaro.nsw.gov.au/Council/Integrated-Planning-and-Reporting> | **200** | `text/html`, 174,693 bytes; links the 2025/26 audited-statements exhibition notice and the older FY2024-25 GPFS. |
| Official Have Your Say exhibition notice | <https://www.snowymonaro.nsw.gov.au/Have-Your-Say/Feedback-invited-on-Councils-audited-202526-Financial-Statements> | **302 → 200** | Redirects to `https://yoursaysnowymonaro.com.au/feedback-invited-on-council-s-audited-2025-26-financial-statements`; document library lists three attachments. |
| FY2025-26 GPFS document library attachment | <https://yoursaysnowymonaro.com.au/109847/widgets/498829/documents/335580/download> | **302 → 200** | `application/pdf`, 2,942,138 bytes, 95 PDF pages (76 printed pages); redirects to the signed S3 copy. |

The connector parses the exhibition document library, accepts only the **GPFS** attachment (rejecting
SPFS, special schedules, annual reports and mirrors), and appends `/download` to the stable document
URL. A documented official fallback pin (the same document URL) is used only if parsing yields no
usable anchor.

**Akamai UA quirk.** The council host is UA-sensitive: a plain client UA (`curl/8.5.0`) returns
**200**; a bare Chrome UA returns **403**. The connector sends an explicit plain client UA (plus a
broad PDF/HTML `Accept`) for both the listing and the PDF; a focused test asserts that header is used.

The exact bytes are SHA-256 re-verified before parsing.

## 2. Exact document

- **Title:** Annual Financial Statements — GPFS 2026 (signed 29 October), for the year ended
  30 June 2026.
- **Financial year:** 2025-26.
- **URL:** `https://yoursaysnowymonaro.com.au/109847/widgets/498829/documents/335580/download`
- **Bytes:** 2,942,138.
- **PDF pages:** 95 (76 printed pages).
- **SHA-256:** `40ee605dfd8d4b988d8871470cda32ad6de7d0b2453617a440d7716e2c590ba2`.
- **Archive:** `snowy-monaro-gpfs/annual_financial_statements-gpfs-2026.pdf` under the configured
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
  Rates and annual charges                               47,420
  User charges and fees                                  19,615
  Other revenues                                          3,368
  Grants and contributions provided for operating purposes 26,799
  Grants and contributions provided for capital purposes 31,634
  Interest and investment revenue                         5,128
  Other income                                            1,410
  Net gain from the disposal of assets                      – (nil, not emitted)
  Total income from continuing operations                135,374
Expenses from continuing operations
  Employee benefits and on-costs                         36,796
  Materials and services                                 32,142
  Borrowing costs                                         3,033
  Other expenses                                          2,421
  Net loss from the disposal of assets                    9,004
  Total expenses ... excluding depreciation              83,396
  Depreciation, amortisation and impairment              30,290
  Operating result from continuing operations            21,688
  Net operating result attributable to Council           21,688
  Net operating result before capital grants             (9,946)
```

The statement prints **no Total expenses line**. Total expenses is the printed face bridge:
expenses-excluding-depreciation `83,396` + depreciation/amortisation/impairment `30,290` = `113,686`,
which equals the B1-1 "Total functions and activities" expense total.

## 4. Reconciliation (zero tolerance)

All arithmetic is in whole printed `$ '000` values:

```text
revenue components:
  47,420 + 19,615 + 3,368 + 26,799 + 31,634 + 5,128 + 1,410 = 135,374
  = printed Total income

expense components:
  36,796 + 32,142 + 3,033 + 2,421 + 9,004 = 83,396
  = printed expenses excluding depreciation

total expenses:
  83,396 + 30,290 = 113,686
  = printed B1-1 Total functions and activities expenses

operating result:
  135,374 - 113,686 = 21,688
  = printed Operating result

net result:
  21,688 = printed Net operating result attributable to Council

before capital grants:
  21,688 - 31,634 = -9,946
  = printed before-capital result (evidence only)

B1-1:
  income = 135,374
  expenses = 113,686
  operating result = 21,688
  grants = 26,799 + 31,634 = 58,433

other comprehensive income:
  revaluation           78,499
  impairment reversal        – (nil)
  = printed Total other comprehensive income for the year

comprehensive income:
  21,688 + 78,499 = 100,187
  = printed Total comprehensive income
```

B1-1 income is the face total revenue. The adapter checks `B1-1 operating result = printed net
result`, `B1-1 grants = operating grants + capital grants`, `B1-1 income = face total revenue`,
`B1-1 expenses = face total expenses bridge` and `B1-1 income − B1-1 expenses = printed net result`.
The single non-nil OCI component is checked against the printed OCI (the 2026 impairment-reversal line
is nil, so the 2025 comparative is not read). The before-capital result is retained in reconciliation
evidence only, not emitted as a row.

The adapter defers the document with **0 rows** if any printed line is missing, if the unit is not
thousands, or if any of these bridges differs by one thousand. On the audited FY2025-26 report there
is no deferral.

## 5. Extracted entity rows (17, non-additive)

| `gpfs_line_item` | Printed/derived label | `$ '000` | `amount_cents` | Section |
| --- | --- | ---: | ---: | --- |
| `rates_and_annual_charges` | Rates and annual charges | 47,420 | 4,742,000,000 | revenue |
| `user_charges_and_fees` | User charges and fees | 19,615 | 1,961,500,000 | revenue |
| `other_revenues` | Other revenues | 3,368 | 336,800,000 | revenue |
| `government_grants_operating` | Grants and contributions — operating | 26,799 | 2,679,900,000 | revenue |
| `government_grants_capital` | Grants and contributions — capital | 31,634 | 3,163,400,000 | revenue |
| `interest_and_investment_income` | Interest and investment revenue | 5,128 | 512,800,000 | revenue |
| `other_income` | Other income | 1,410 | 141,000,000 | revenue |
| `total_revenue` | Total income from continuing operations | 135,374 | 13,537,400,000 | revenue |
| `employee_expenses` | Employee benefits and on-costs | 36,796 | 3,679,600,000 | expenses |
| `materials_and_services` | Materials and services | 32,142 | 3,214,200,000 | expenses |
| `borrowing_costs` | Borrowing costs | 3,033 | 303,300,000 | expenses |
| `other_expenses` | Other expenses | 2,421 | 242,100,000 | expenses |
| `net_loss_from_disposal_of_assets` | Net loss from the disposal of assets | 9,004 | 900,400,000 | expenses |
| `total_expenses_excluding_depreciation` | Total expenses excluding depreciation | 83,396 | 8,339,600,000 | expenses |
| `depreciation_amortisation_impairment` | Depreciation, amortisation and impairment | 30,290 | 3,029,000,000 | expenses |
| `total_expenses` | Total expenses (documented bridge) | 113,686 | 11,368,600,000 | expenses |
| `net_result` | Net operating result attributable to Council | 21,688 | 2,168,800,000 | result |

Every row is `jurisdiction_level: "local"`, `jurisdiction: "NSW"`,
`delivery_entity: "Snowy Monaro Regional Council"`, `aggregation_role: "agency_detail"`,
`measure_type: "actual"`, `verified: false`, `data_quality_flag: "provisional/local_government"`.
Government grant rows carry `potential_double_count: true`.

## 6. No-total / no-cross-council rule

- Snowy Monaro Regional Council is one entity. No council total, no state/national total and no sum
  with another council, the `dubbo-council` budget/estimate rows, a government program, the PNFC
  benchmark or the OLG summary layer is created.
- The FY2025-26 column is the reporting boundary; the FY2024-25 comparative is not added.
- Revenue, expenses, components and the net result overlap. They are published rows, not an additive
  spending series.
- Every row is `agency_detail` with no `region_id` and no `location`/LGA allocation.

## 7. Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`)

Targeted ingest of **only `snowy-monaro-gpfs`** against the shared dev DB:

- total measures **998,947 → 998,964** (exactly **+17**);
- GPFS rows **1429 → 1446**;
- active GPFS `data_sources` **74 → 75**;
- SOC rows (`jurisdiction_level: "soc"`) stayed at **205**; every other per-source count unchanged;
- **0** non-`agency_detail` rows, **0** rows with `region_id`/`location`, one
  `delivery_entity` (`Snowy Monaro Regional Council`), all rows `fiscal_year: "2025-26"`;
- `data_sources` has the source `active` with `records_ingested: 17`;
- the latest `ingestion_logs` entry is `status: "success"`, `records_fetched: 17`,
  `records_upserted: 17`;
- a second ingest is idempotent (same 17 SHA-anchored natural keys).

## 8. How to verify

```bash
# Official planning page and the exhibition document-library attachment.
curl -sL -o /dev/null -w '%{http_code}\n' \
  -A 'curl/8.5.0' 'https://www.snowymonaro.nsw.gov.au/Council/Integrated-Planning-and-Reporting'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  -A 'curl/8.5.0' \
  'https://yoursaysnowymonaro.com.au/109847/widgets/498829/documents/335580/download'

# Focused connector tests (17).
TEST_MONGO_URL="mongodb://localhost:27018/ausspend_test_snowymonarogpfs" \
  npx vitest run --project server server/test/snowy-monaro-gpfs.test.ts
```

The focused suite covers the unit gate, exact reconciliation/zero tolerance, FY2025-26 acceptance and
rejection of the 2024-25/2026-27 documents, natural-key/idempotency, no-cross-council totals and
discovery/latest selection (including SPFS/special-schedule rejection, the documented official
fallback pin and the plain-UA header).
