# NSW council GPFS — Orange City Council FY2025-26 evidence

**Status:** implementation evidence only. One council, one audited year. The exact PDF is archived
outside the repo; no PDF or raw table is committed. **Entity:** Orange City Council only.
**No council total, no state or national total, no OLG summary layer, no SOC/other council rows.**
The FY2025-26 column is used; the FY2024-25 comparative inside the statement is never added.

**Checked:** 2026-11-19 (Australia/Sydney).

## 0. Fiscal-year decision (current-year-first)

No separate standalone FY2025-26 AFS is published on the council's Annual Report page yet; the only
separate AFS link is the audited **FY2024-25** statements. However, the endorsed **2025-2026 Annual
Report** (CCL 17 November 2026) contains the signed audited General Purpose Financial Statements
section — Income Statement, Statement of Comprehensive Income, B1-1, notes and the Auditor-General's
report — and that section is fully parseable. The connector therefore ingests **FY2025-26** from the
annual report. The standalone FY2024-25 AFS is **superseded** and is not ingested. The connector
targets `2025-26` and rejects 2024-25/2023-24.

## 1. Discovery and access log

| Step | URL | HTTP | Result |
| --- | --- | --- | --- |
| Official Annual Report page | <https://www.orange.nsw.gov.au/plans-and-policies/annual-report/> | **200** | `text/html`, 116,163 bytes; lists "Annual Report 2025-2026", "Annual Financial Statements" (FY2024-25) and older reports. |
| FY2025-26 endorsed annual report | <https://www.orange.nsw.gov.au/wp-content/uploads/2026/11/Orange-City-Council-2025-2026-Annual-Report-Endorsed-CCL-17-November-2026.pdf> | **200** | `application/pdf`, 4,329,237 bytes, 124 PDF pages; contains the audited GPFS section at PDF pp. 89–90 and 98 and the Auditor-General's report at pp. 111–113. |

The connector parses the official Annual Report page, accepts the **2025-2026 annual report** anchor
(not the standalone 2024-25 AFS, notices, budget/planning documents or mirrors), and selects FY2025-26.
A documented official fallback pin (the same report URL) is used only if the page yields no usable
anchor.

**Plain fetch.** The WordPress media PDFs serve normally to plain fetch; the connector sends an
explicit plain `curl/8.5.0` User-Agent (plus a broad PDF/HTML `Accept`) for deterministic discovery
and download. Tests assert that header is used.

The exact bytes are SHA-256 re-verified before parsing.

## 2. Exact document

- **Title:** Orange City Council 2025-2026 Annual Report (endorsed CCL 17 November 2026) — contains
  the audited FY2025-26 General Purpose Financial Statements.
- **Financial year:** 2025-26, for the year ended 30 June 2026.
- **URL:** `https://www.orange.nsw.gov.au/wp-content/uploads/2026/11/Orange-City-Council-2025-2026-Annual-Report-Endorsed-CCL-17-November-2026.pdf`
- **Bytes:** 4,329,237.
- **PDF pages:** 124.
- **SHA-256:** `d8f815cc6ce577b13ac2f6c6f991a30fbcd9c541ed7ce8f3a0d469ea84af356d`.
- **Archive:** `orange-gpfs/Orange-City-Council-2025-2026-Annual-Report-Endorsed-CCL-17-November-2026.pdf`
  under the configured source-archive root (outside the repo; not committed). It holds the exact PDF
  plus archive metadata (URL, retrieval date, bytes, SHA-256, content type) and the archive record.
  The connector re-verifies the hash before parsing.

## 3. Printed unit and statement

The audited GPFS section starts at PDF page 89. The Income Statement is on PDF page 89 (printed page
4); it prints `$ '000`. The unit gate requires **`$ '000` / thousands**; a plain `$`, `$M` or unit-less
read is rejected. The adapter reads the FY2025-26 Actual column only (labelled 2026), not the Original
unaudited budget column that prints before each label.

The FY2025-26 column prints (whole `$ '000`):

```text
Income from continuing operations
  Rates and annual charges                               70,700
  User charges and fees                                  36,435
  Other revenues                                          8,673
  Grants and contributions provided for operating purposes 13,967
  Grants and contributions provided for capital purposes 28,026
  Interest and investment income                         12,027
  Other income                                            1,999
  Net gain from the disposal of assets                      – (nil, not emitted)
  Total income from continuing operations                171,827
Expenses from continuing operations
  Employee benefits and on-costs                         56,769
  Materials and services                                 45,542
  Borrowing costs                                           554
  Other expenses                                          1,280
  Net loss from the disposal of assets                    6,424
  Total expenses ... excluding depreciation              110,569
  Depreciation, amortisation and impairment              29,169
  Operating result from continuing operations            32,089
  Net operating result attributable to Council           32,089
  Net operating result before capital grants              4,063
```

The statement prints **no Total expenses line**. Total expenses is the printed face bridge:
expenses-excluding-depreciation `110,569` + depreciation/amortisation/impairment `29,169` = `139,738`,
which equals the B1-1 "Total functions and activities" expense total.

## 4. Reconciliation (zero tolerance)

All arithmetic in whole printed `$ '000` values:

```text
revenue components:
  70,700 + 36,435 + 8,673 + 13,967 + 28,026 + 12,027 + 1,999 = 171,827
  = printed Total income

expense components:
  56,769 + 45,542 + 554 + 1,280 + 6,424 = 110,569
  = printed expenses excluding depreciation

total expenses:
  110,569 + 29,169 = 139,738
  = printed B1-1 Total functions and activities expenses

operating result:
  171,827 - 139,738 = 32,089
  = printed Operating result

net result:
  32,089 = printed Net operating result attributable to Council

before capital grants:
  32,089 - 28,026 = 4,063
  = printed before-capital result (evidence only)

B1-1:
  income = 171,827
  expenses = 139,738
  operating result = 32,089
  grants = 13,967 + 28,026 = 41,993

other comprehensive income:
  revaluation           201,141
  = printed Total other comprehensive income for the year

comprehensive income:
  32,089 + 201,141 = 233,230
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
| `rates_and_annual_charges` | Rates and annual charges | 70,700 | 7,070,000,000 | revenue |
| `user_charges_and_fees` | User charges and fees | 36,435 | 3,643,500,000 | revenue |
| `other_revenues` | Other revenues | 8,673 | 867,300,000 | revenue |
| `government_grants_operating` | Grants and contributions — operating | 13,967 | 1,396,700,000 | revenue |
| `government_grants_capital` | Grants and contributions — capital | 28,026 | 2,802,600,000 | revenue |
| `interest_and_investment_income` | Interest and investment income | 12,027 | 1,202,700,000 | revenue |
| `other_income` | Other income | 1,999 | 199,900,000 | revenue |
| `total_revenue` | Total income from continuing operations | 171,827 | 17,182,700,000 | revenue |
| `employee_expenses` | Employee benefits and on-costs | 56,769 | 5,676,900,000 | expenses |
| `materials_and_services` | Materials and services | 45,542 | 4,554,200,000 | expenses |
| `borrowing_costs` | Borrowing costs | 554 | 55,400,000 | expenses |
| `other_expenses` | Other expenses | 1,280 | 128,000,000 | expenses |
| `net_loss_from_disposal_of_assets` | Net loss from the disposal of assets | 6,424 | 642,400,000 | expenses |
| `total_expenses_excluding_depreciation` | Total expenses excluding depreciation | 110,569 | 11,056,900,000 | expenses |
| `depreciation_amortisation_impairment` | Depreciation, amortisation and impairment | 29,169 | 2,916,900,000 | expenses |
| `total_expenses` | Total expenses (documented bridge) | 139,738 | 13,973,800,000 | expenses |
| `net_result` | Net operating result attributable to Council | 32,089 | 3,208,900,000 | result |

Every row is `jurisdiction_level: "local"`, `jurisdiction: "NSW"`,
`delivery_entity: "Orange City Council"`, `aggregation_role: "agency_detail"`,
`measure_type: "actual"`, `verified: false`, `data_quality_flag: "provisional/local_government"`.
Government grant rows carry `potential_double_count: true`.

## 6. No-total / no-cross-council rule

- Orange City Council is one entity. No council total, no state/national total and no sum with another
  council, the `dubbo-council` budget/estimate rows, a government program, the PNFC benchmark or the
  OLG summary layer is created.
- The FY2025-26 column is the reporting boundary; the FY2024-25 comparative is not added.
- Revenue, expenses, components and the net result overlap. They are published rows, not an additive
  spending series.
- Every row is `agency_detail` with no `region_id` and no `location`/LGA allocation.

## 7. Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`)

Targeted ingest of **only `orange-gpfs`** against the shared dev DB:

- total measures **998,981 → 998,998** (exactly **+17**);
- GPFS rows **1463 → 1480**;
- active GPFS `data_sources` **76 → 77**;
- SOC rows (`jurisdiction_level: "soc"`) stayed at **205**; every other per-source count unchanged;
- **0** non-`agency_detail` rows, **0** rows with `region_id`/`location`, one
  `delivery_entity` (`Orange City Council`), all rows `fiscal_year: "2025-26"`;
- `data_sources` has the source `active` with `records_ingested: 17`;
- the latest `ingestion_logs` entry is `status: "success"`, `records_fetched: 17`,
  `records_upserted: 17`.

## 8. How to verify

```bash
# Official Annual Report page and the exact endorsed report.
curl -sL -o /dev/null -w '%{http_code}\n' \
  -A 'curl/8.5.0' 'https://www.orange.nsw.gov.au/plans-and-policies/annual-report/'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  -A 'curl/8.5.0' \
  'https://www.orange.nsw.gov.au/wp-content/uploads/2026/11/Orange-City-Council-2025-2026-Annual-Report-Endorsed-CCL-17-November-2026.pdf'

# Focused connector tests (17).
TEST_MONGO_URL="mongodb://localhost:27018/ausspend_test_orangegpfs" \
  npx vitest run --project server server/test/orange-gpfs.test.ts
```

The focused suite covers the unit gate, exact reconciliation/zero tolerance, FY2025-26 acceptance and
rejection of the 2024-25/2026-27 documents, natural-key/idempotency, no-cross-council totals and
discovery/latest selection (including the standalone 2024-25 AFS rejection, the documented official
fallback pin and the plain-UA header).
