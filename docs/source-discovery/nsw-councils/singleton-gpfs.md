# NSW council GPFS — Singleton Council FY2025-26 evidence

**Status:** implementation evidence only. One council, one audited year. The exact PDF is archived
outside the repo; no PDF or raw table is committed. **Entity:** Singleton Council only.
**No council total, no state or national total, no OLG summary layer, no SOC/other council rows.**
The FY2025-26 column is used; the FY2024-25 comparative inside the statement is never added.

**Checked:** 2026-11-19 (Australia/Sydney).

## 0. Fiscal-year decision (current year)

FY2025-26 is the **current audited standalone year** published by the council at 2026-11-19: the
statements are for the year ended 30 June 2026. The official Financial Statements page lists
2025/2026 as the newest year; no 2026/27 audited statements are posted. The connector targets
`2025-26` and rejects prior years (2024-25/2023-24).

## 1. Discovery and access log

| Step | URL | HTTP | Result |
| --- | --- | --- | --- |
| Official Financial Statements page | <https://www.singleton.nsw.gov.au/Council/Integrated-Planning-and-Reporting/Long-Term-Planning/Financial-Statements> | **200** | `text/html`, 94,433 bytes; lists 2025/2026 and older years as DocID links, plus a flippingbook view (ignored). |
| FY2025-26 audited financial statements | <https://docs.singleton.nsw.gov.au/default.aspx?DocID=cVK9GDcvrvY%3d> | **200** | `application/pdf`, 5,647,126 bytes, 94 PDF pages; `content-disposition: attachment ;filename="Annual Financial Statements 2026-2026.PDF"`. |

**DocID endpoint preserved.** The statement URL is the official DocID redirect endpoint with no
`.pdf` extension; the URL-encoded `DocID=cVK9GDcvrvY%3d` query is preserved exactly in the connector,
the archive metadata and the fallback pin. Discovery accepts only `docs.singleton.nsw.gov.au` /
`portal.singleton.nsw.gov.au` DocID links and ignores the flippingbook view, annual reports and
budget/planning documents.

**Akamai UA quirk.** The host is UA-sensitive: a plain client UA (`curl/8.5.0`) returns **200**
`application/pdf`; a bare Chrome UA returns **403**. The connector sends an explicit plain client UA
(plus a broad PDF/HTML `Accept`) for both the listing and the PDF; a focused test asserts that header
is used.

The exact bytes are SHA-256 re-verified before parsing.

## 2. Exact document

- **Title:** Annual Financial Statements 2025-26 (standalone audited General Purpose Financial
  Statements, year ended 30 June 2026).
- **Financial year:** 2025-26.
- **URL:** `https://docs.singleton.nsw.gov.au/default.aspx?DocID=cVK9GDcvrvY%3d`
- **Bytes:** 5,647,126.
- **PDF pages:** 94.
- **SHA-256:** `717bfeec069e1564f2a712bbff73987f626624180b421905eaa71e8aa6dc0dbc`.
- **Archive:** `singleton-gpfs/singleton-financial-statements-2025-26.pdf` under the configured
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
  Rates and annual charges                               41,739
  User charges and fees                                  30,000
  Other revenues                                          3,696
  Grants and contributions provided for operating purposes 13,603
  Grants and contributions provided for capital purposes 15,937
  Interest and investment income                          5,308
  Other income                                            4,229
  Net gain from the disposal of assets                      – (nil, not emitted)
  Total income from continuing operations                114,512
Expenses from continuing operations
  Employee benefits and on-costs                         33,954
  Materials and services                                 37,544
  Borrowing costs                                         1,339
  Other expenses                                          2,836
  Net loss from the disposal of assets                    1,721
  Total expenses ... excluding depreciation              77,394
  Depreciation, amortisation and impairment              20,508
  Operating result from continuing operations            16,610
  Net operating result attributable to Council           16,610
  Net operating result before capital grants                673
```

The statement prints **no Total expenses line**. Total expenses is the printed face bridge:
expenses-excluding-depreciation `77,394` + depreciation/amortisation/impairment `20,508` = `97,902`,
which equals the B1-1 "Total functions and activities" expense total.

## 4. Reconciliation (zero tolerance)

All arithmetic in whole printed `$ '000` values:

```text
revenue components:
  41,739 + 30,000 + 3,696 + 13,603 + 15,937 + 5,308 + 4,229 = 114,512
  = printed Total income

expense components:
  33,954 + 37,544 + 1,339 + 2,836 + 1,721 = 77,394
  = printed expenses excluding depreciation

total expenses:
  77,394 + 20,508 = 97,902
  = printed B1-1 Total functions and activities expenses

operating result:
  114,512 - 97,902 = 16,610
  = printed Operating result

net result:
  16,610 = printed Net operating result attributable to Council

before capital grants:
  16,610 - 15,937 = 673
  = printed before-capital result (evidence only)

B1-1:
  income = 114,512
  expenses = 97,902
  operating result = 16,610
  grants = 13,603 + 15,937 = 29,540

other comprehensive income:
  revaluation                          34,798
  remediation-provision re-measurement  5,509
  sum                                  40,307
  = printed Other comprehensive income for the year

comprehensive income:
  16,610 + 40,307 = 56,917
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
| `rates_and_annual_charges` | Rates and annual charges | 41,739 | 4,173,900,000 | revenue |
| `user_charges_and_fees` | User charges and fees | 30,000 | 3,000,000,000 | revenue |
| `other_revenues` | Other revenues | 3,696 | 369,600,000 | revenue |
| `government_grants_operating` | Grants and contributions — operating | 13,603 | 1,360,300,000 | revenue |
| `government_grants_capital` | Grants and contributions — capital | 15,937 | 1,593,700,000 | revenue |
| `interest_and_investment_income` | Interest and investment income | 5,308 | 530,800,000 | revenue |
| `other_income` | Other income | 4,229 | 422,900,000 | revenue |
| `total_revenue` | Total income from continuing operations | 114,512 | 11,451,200,000 | revenue |
| `employee_expenses` | Employee benefits and on-costs | 33,954 | 3,395,400,000 | expenses |
| `materials_and_services` | Materials and services | 37,544 | 3,754,400,000 | expenses |
| `borrowing_costs` | Borrowing costs | 1,339 | 133,900,000 | expenses |
| `other_expenses` | Other expenses | 2,836 | 283,600,000 | expenses |
| `net_loss_from_disposal_of_assets` | Net loss from the disposal of assets | 1,721 | 172,100,000 | expenses |
| `total_expenses_excluding_depreciation` | Total expenses excluding depreciation | 77,394 | 7,739,400,000 | expenses |
| `depreciation_amortisation_impairment` | Depreciation, amortisation and impairment | 20,508 | 2,050,800,000 | expenses |
| `total_expenses` | Total expenses (documented bridge) | 97,902 | 9,790,200,000 | expenses |
| `net_result` | Net operating result attributable to Council | 16,610 | 1,661,000,000 | result |

Every row is `jurisdiction_level: "local"`, `jurisdiction: "NSW"`,
`delivery_entity: "Singleton Council"`, `aggregation_role: "agency_detail"`,
`measure_type: "actual"`, `verified: false`, `data_quality_flag: "provisional/local_government"`.
Government grant rows carry `potential_double_count: true`.

## 6. No-total / no-cross-council rule

- Singleton Council is one entity. No council total, no state/national total and no sum with another
  council, the `dubbo-council` budget/estimate rows, a government program, the PNFC benchmark or the
  OLG summary layer is created.
- The FY2025-26 column is the reporting boundary; the FY2024-25 comparative is not added.
- Revenue, expenses, components and the net result overlap. They are published rows, not an additive
  spending series.
- Every row is `agency_detail` with no `region_id` and no `location`/LGA allocation.

## 7. Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`)

Targeted ingest of **only `singleton-gpfs`** against the shared dev DB:

- total measures **998,964 → 998,981** (exactly **+17**);
- GPFS rows **1446 → 1463**;
- active GPFS `data_sources` **75 → 76**;
- SOC rows (`jurisdiction_level: "soc"`) stayed at **205**; every other per-source count unchanged;
- **0** non-`agency_detail` rows, **0** rows with `region_id`/`location`, one
  `delivery_entity` (`Singleton Council`), all rows `fiscal_year: "2025-26"`;
- `data_sources` has the source `active` with `records_ingested: 17`;
- the latest `ingestion_logs` entry is `status: "success"`, `records_fetched: 17`,
  `records_upserted: 17`.

## 8. How to verify

```bash
# Official page and the exact DocID PDF (plain UA; Chrome UA 403).
curl -sL -o /dev/null -w '%{http_code}\n' \
  -A 'curl/8.5.0' 'https://www.singleton.nsw.gov.au/Council/Integrated-Planning-and-Reporting/Long-Term-Planning/Financial-Statements'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  -A 'curl/8.5.0' \
  'https://docs.singleton.nsw.gov.au/default.aspx?DocID=cVK9GDcvrvY%3d'

# Focused connector tests (18).
TEST_MONGO_URL="mongodb://localhost:27018/ausspend_test_singletongpfs" \
  npx vitest run --project server server/test/singleton-gpfs.test.ts
```

The focused suite covers the unit gate, exact reconciliation/zero tolerance (including both OCI
components), FY2025-26 acceptance and rejection of 2024-25/2026-27 documents, natural-key/
idempotency, no-cross-council totals and discovery/latest selection (including annual-report,
flippingbook and mirror rejection, the preserved DocID pin and the plain-UA header).
