# NSW council GPFS — Griffith City Council FY2024-25 evidence

**Status:** implementation evidence only. One council, one audited year. The exact PDF is archived
outside the repo; no PDF or raw table is committed. **Entity:** Griffith City Council only.
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
| Official Corporate planning and reporting page | <https://www.griffith.nsw.gov.au/Council/Corporate-planning-and-reporting> | **200** | `text/html; charset=utf-8`, 107,771 bytes; lists the annual report plus the financial statements PDF. |
| FY2024-25 financial statements | <https://www.griffith.nsw.gov.au/files/sharedassets/public/v/1/cm-documents/griffith-city-council-financial-statements-2024-25.pdf> | **200** | `application/pdf`, 4,054,577 bytes, 108 PDF pages; `last-modified: Wed, 12 Nov 2025 06:05:02 GMT`, `etag: "20057c43-ffc5-43fb-bb46-ed8f4a90d642"`. |

The connector parses the official Corporate planning and reporting page, selects the financial
statements anchor (not the annual report), and ignores prior years and off-host mirrors. A documented
official fallback pin (the exact PDF URL) is used only if the page yields no usable anchor.

**Akamai UA quirk.** The host is UA-sensitive: a plain client UA (`curl/8.5.0`) returns **200**
`application/pdf`; a bare Chrome UA returns **403**. The connector sends an explicit plain client UA
(plus a broad PDF/HTML `Accept`) for both the listing and the PDF; a focused test asserts that header
is used.

The exact bytes are SHA-256 re-verified before parsing.

## 2. Exact document

- **Title:** Griffith City Council Financial Statements 2024-25 (standalone audited General Purpose
  Financial Statements, year ended 30 June 2025).
- **Financial year:** 2024-25, for the year ended 30 June 2025.
- **URL:** `https://www.griffith.nsw.gov.au/files/sharedassets/public/v/1/cm-documents/griffith-city-council-financial-statements-2024-25.pdf`
- **Bytes:** 4,054,577.
- **PDF pages:** 108.
- **SHA-256:** `5ff3ce8ff4f52ab44ed34582e18146bdc52ba7ea188ef1ae36e7132fd77a88a4`.
- **Archive:** `griffith-gpfs/griffith-city-council-financial-statements-2024-25.pdf` under the
  configured source-archive root (outside the repo; not committed). It holds the exact PDF plus
  archive metadata (URL, retrieval date, bytes, SHA-256, content type) and the archive record. The
  connector re-verifies the hash before parsing.

## 3. Printed unit and statement

The Income Statement is on PDF page 6 (printed page 4). It prints `$ '000`. The unit gate requires
**`$ '000` / thousands**; a plain `$`, `$M` or unit-less read is rejected. The adapter reads the
FY2024-25 Actual column only (labelled 2025), not the Original unaudited budget column that prints
before each label.

The FY2024-25 column prints (whole `$ '000`):

```text
Income from continuing operations
  Rates and annual charges                               40,658
  User charges and fees                                  21,904
  Other revenues                                          1,704
  Grants and contributions provided for operating purposes 7,179
  Grants and contributions provided for capital purposes 13,839
  Interest and investment income                          4,454
  Other income                                              565
  Net gain from the disposal of assets                      131
  Total income from continuing operations                90,434
Expenses from continuing operations
  Employee benefits and on-costs                         29,395
  Materials and services                                 21,948
  Borrowing costs                                           972
  Other expenses                                          1,301
  Total expenses ... excluding depreciation              53,616
  Depreciation, amortisation and impairment              19,188
  Operating result from continuing operations            17,630
  Net operating result attributable to Council           17,630
  Net operating result before capital grants              3,791
```

Griffith prints **eight revenue lines** (including a real net gain on disposal of `$131` thousand)
and **four expense lines** (no net disposal expense line). The statement prints **no Total expenses
line**; total expenses is the printed face bridge: expenses-excluding-depreciation `53,616` +
depreciation/amortisation/impairment `19,188` = `72,804`, which equals the B1-1 "Total functions and
activities" expense total.

## 4. Reconciliation (zero tolerance)

All arithmetic is in whole printed `$ '000` values:

```text
revenue components:
  40,658 + 21,904 + 1,704 + 7,179 + 13,839 + 4,454 + 565 + 131 = 90,434
  = printed Total income

expense components:
  29,395 + 21,948 + 972 + 1,301 = 53,616
  = printed expenses excluding depreciation

total expenses:
  53,616 + 19,188 = 72,804
  = printed B1-1 Total functions and activities expenses

operating result:
  90,434 - 72,804 = 17,630
  = printed Operating result

net result:
  17,630 = printed Net operating result attributable to Council

before capital grants:
  17,630 - 13,839 = 3,791
  = printed before-capital result (evidence only)

B1-1:
  income = 90,434
  expenses = 72,804
  operating result = 17,630
  grants = 7,179 + 13,839 = 21,018

other comprehensive income:
  revaluation                    -22
  revaluation of intangible assets 928
  sum                            906
  = printed Total other comprehensive income for the year

comprehensive income:
  17,630 + 906 = 18,536
  = printed Total comprehensive income
```

B1-1 income is the face total revenue. The adapter checks `B1-1 operating result = printed net
result`, `B1-1 grants = operating grants + capital grants`, `B1-1 income = face total revenue`,
`B1-1 expenses = face total expenses bridge` and `B1-1 income − B1-1 expenses = printed net result`.
The two printed OCI components are summed and checked against the printed OCI. The before-capital
result is retained in reconciliation evidence only, not emitted as a row.

The adapter defers the document with **0 rows** if any printed line is missing, if the unit is not
thousands, or if any of these bridges differs by one thousand. On the audited FY2024-25 report there
is no deferral.

## 5. Extracted entity rows (17, non-additive)

| `gpfs_line_item` | Printed/derived label | `$ '000` | `amount_cents` | Section |
| --- | --- | ---: | ---: | --- |
| `rates_and_annual_charges` | Rates and annual charges | 40,658 | 4,065,800,000 | revenue |
| `user_charges_and_fees` | User charges and fees | 21,904 | 2,190,400,000 | revenue |
| `other_revenues` | Other revenues | 1,704 | 170,400,000 | revenue |
| `government_grants_operating` | Grants and contributions — operating | 7,179 | 717,900,000 | revenue |
| `government_grants_capital` | Grants and contributions — capital | 13,839 | 1,383,900,000 | revenue |
| `interest_and_investment_income` | Interest and investment income | 4,454 | 445,400,000 | revenue |
| `other_income` | Other income | 565 | 56,500,000 | revenue |
| `net_gain_from_disposal_of_assets` | Net gain from the disposal of assets | 131 | 13,100,000 | revenue |
| `total_revenue` | Total income from continuing operations | 90,434 | 9,043,400,000 | revenue |
| `employee_expenses` | Employee benefits and on-costs | 29,395 | 2,939,500,000 | expenses |
| `materials_and_services` | Materials and services | 21,948 | 2,194,800,000 | expenses |
| `borrowing_costs` | Borrowing costs | 972 | 97,200,000 | expenses |
| `other_expenses` | Other expenses | 1,301 | 130,100,000 | expenses |
| `total_expenses_excluding_depreciation` | Total expenses excluding depreciation | 53,616 | 5,361,600,000 | expenses |
| `depreciation_amortisation_impairment` | Depreciation, amortisation and impairment | 19,188 | 1,918,800,000 | expenses |
| `total_expenses` | Total expenses (documented bridge) | 72,804 | 7,280,400,000 | expenses |
| `net_result` | Net operating result attributable to Council | 17,630 | 1,763,000,000 | result |

Every row is `jurisdiction_level: "local"`, `jurisdiction: "NSW"`,
`delivery_entity: "Griffith City Council"`, `aggregation_role: "agency_detail"`,
`measure_type: "actual"`, `verified: false`, `data_quality_flag: "provisional/local_government"`.
Government grant rows carry `potential_double_count: true`.

## 6. No-total / no-cross-council rule

- Griffith City Council is one entity. No council total, no state/national total and no sum with
  another council, the `dubbo-council` budget/estimate rows, a government program, the PNFC benchmark
  or the OLG summary layer is created.
- The FY2024-25 column is the reporting boundary; the FY2023-24 comparative is not added.
- Revenue, expenses, components and the net result overlap. They are published rows, not an additive
  spending series.
- Every row is `agency_detail` with no `region_id` and no `location`/LGA allocation.

## 7. Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`)

Targeted ingest of **only `griffith-gpfs`** against the shared dev DB:

- total measures **998,880 → 998,897** (exactly **+17**);
- GPFS rows **1362 → 1379**;
- active GPFS `data_sources` **70 → 71**;
- SOC rows (`jurisdiction_level: "soc"`) stayed at **205**; every other per-source count unchanged;
- **0** non-`agency_detail` rows, **0** rows with `region_id`/`location`, one
  `delivery_entity` (`Griffith City Council`), all rows `fiscal_year: "2024-25"`;
- `data_sources` has the source `active` with `records_ingested: 17`;
- the latest `ingestion_logs` entry is `status: "success"`, `records_fetched: 17`,
  `records_upserted: 17`;
- a second ingest upserted the same 17 SHA-anchored natural keys and left the total at **998,897**
  (idempotent, no duplicates).

## 8. How to verify

```bash
# Official page and the exact financial statements PDF (plain UA; Chrome UA 403).
curl -sL -o /dev/null -w '%{http_code}\n' \
  -A 'curl/8.5.0' 'https://www.griffith.nsw.gov.au/Council/Corporate-planning-and-reporting'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  -A 'curl/8.5.0' \
  'https://www.griffith.nsw.gov.au/files/sharedassets/public/v/1/cm-documents/griffith-city-council-financial-statements-2024-25.pdf'

# Focused connector tests (18).
TEST_MONGO_URL="mongodb://localhost:27018/ausspend_test_griffithgpfs" \
  npx vitest run --project server server/test/griffith-gpfs.test.ts
```

The focused suite covers the unit gate, exact reconciliation/zero tolerance (including both OCI
components), FY2024-25 current-available acceptance and rejection of 2023-24/2025-26 substitutions,
natural-key/idempotency, no-cross-council totals and discovery/latest selection (including
annual-report rejection, the documented official fallback pin and the plain-UA header).
