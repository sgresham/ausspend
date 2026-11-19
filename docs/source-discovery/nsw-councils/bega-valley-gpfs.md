# NSW council GPFS — Bega Valley Shire Council FY2024-25 evidence

**Status:** implementation evidence only. One council, one audited year. The exact PDF is archived
outside the repo; no PDF or raw table is committed. **Entity:** Bega Valley Shire Council only.
**No council total, no state or national total, no OLG summary layer, no SOC/other council rows.**
The FY2024-25 column is used; the FY2023-24 comparative inside the statement is never added.

**Checked:** 2026-11-19 (Australia/Sydney).

## 0. Fiscal-year decision (scoped to FY2024-25)

FY2024-25 is the **accepted current-available year for this source**: the statements are for the year
ended 30 June 2025. At 2026-11-19 the official page also lists a **2026 AFS** (FY2025-26); this item is
explicitly scoped to FY2024-25, so the connector targets `2024-25` only and its stale-year guard
rejects every other year — including the 2025-26 document — rather than substituting it.
No 2023-24 document is used either.

## 1. Discovery and access log

| Step | URL | HTTP | Result |
| --- | --- | --- | --- |
| Official Financial Statements page | <https://www.begavalley.nsw.gov.au/About-Council/Plans-and-Reporting/Financial-Statements> | **200** | `text/html; charset=utf-8`, 173,955 bytes; lists AFS PDFs for 2012–2026. |
| FY2024-25 annual financial statements | <https://www.begavalley.nsw.gov.au/files/assets/public/v/1/adopted-plans-and-strategies/01-integrated-planning-and-reporting/financial-statements/bega-valley-shire-council-annual_financial_statements-2025.pdf> | **200** | `application/pdf`, 3,293,163 bytes, 100 PDF pages; `last-modified: Sun, 02 Nov 2025 22:20:01 GMT`, `etag: "2a935f20-5804-49d6-9781-ca875ea49f98"`. |

The connector parses the official Financial Statements page, selects the **year ended 30 June 2025**
anchor, and ignores the 2026/older documents and off-host mirrors. A documented official fallback pin
(the exact PDF URL) is used only if the page yields no usable anchor.

**Akamai UA quirk.** The host is UA-sensitive: a plain client UA (`curl/8.5.0`) returns **200**
`application/pdf`; a bare Chrome UA returns **403**. The connector sends an explicit plain client UA
(plus a broad PDF/HTML `Accept`) for both the listing and the PDF; a focused test asserts that header
is used.

The exact bytes are SHA-256 re-verified before parsing.

## 2. Exact document

- **Title:** Bega Valley Shire Council Annual Financial Statements for the year ended 30 June 2025
  (standalone audited General Purpose Financial Statements).
- **Financial year:** 2024-25, for the year ended 30 June 2025.
- **URL:** `https://www.begavalley.nsw.gov.au/files/assets/public/v/1/adopted-plans-and-strategies/01-integrated-planning-and-reporting/financial-statements/bega-valley-shire-council-annual_financial_statements-2025.pdf`
- **Bytes:** 3,293,163.
- **PDF pages:** 100.
- **SHA-256:** `d64606d2e274e11f61d253095ca89624c7773a5544aefbbcdcc7394b168a180b`.
- **Archive:** `bega-valley-gpfs/bega-valley-shire-council-annual_financial_statements-2025.pdf` under
  the configured source-archive root (outside the repo; not committed). It holds the exact PDF plus
  archive metadata (URL, retrieval date, bytes, SHA-256, content type) and the archive record. The
  connector re-verifies the hash before parsing.

## 3. Printed unit and statement

The Income Statement is on PDF page 5 (printed page 4). It prints `$ '000`. The unit gate requires
**`$ '000` / thousands**; a plain `$`, `$M` or unit-less read is rejected. The adapter reads the
FY2024-25 Actual column only (labelled 2025), not the Original unaudited budget column that prints
before each label.

The FY2024-25 column prints (whole `$ '000`):

```text
Income from continuing operations
  Rates and annual charges                               77,620
  User charges and fees                                  24,074
  Other revenues                                          1,400
  Grants and contributions provided for operating purposes 24,964
  Grants and contributions provided for capital purposes 36,431
  Interest and investment income                          7,363
  Total income from continuing operations                171,852
Expenses from continuing operations
  Employee benefits and on-costs                         44,067
  Materials and services                                 49,235
  Borrowing costs                                         1,229
  Other expenses                                          1,522
  Net loss from the disposal of assets                    9,018
  Total expenses ... excluding depreciation              105,071
  Depreciation, amortisation and impairment              40,316
  Operating result from continuing operations             26,465
  Net operating result attributable to Council            26,465
  Net operating result before capital grants             (9,966)
```

Bega Valley prints **six revenue lines** (there is no separate "Other income" line) and five expense
lines. The statement prints **no Total expenses line**; total expenses is the printed face bridge:
expenses-excluding-depreciation `105,071` + depreciation/amortisation/impairment `40,316` = `145,387`,
which equals the B1-1 "Total functions and activities" expense total.

## 4. Reconciliation (zero tolerance)

All arithmetic is in whole printed `$ '000` values:

```text
revenue components:
  77,620 + 24,074 + 1,400 + 24,964 + 36,431 + 7,363 = 171,852
  = printed Total income

expense components:
  44,067 + 49,235 + 1,229 + 1,522 + 9,018 = 105,071
  = printed expenses excluding depreciation

total expenses:
  105,071 + 40,316 = 145,387
  = printed B1-1 Total functions and activities expenses

operating result:
  171,852 - 145,387 = 26,465
  = printed Operating result

net result:
  26,465 = printed Net operating result attributable to Council

before capital grants:
  26,465 - 36,431 = -9,966
  = printed before-capital result (evidence only)

B1-1:
  income = 171,852
  expenses = 145,387
  operating result = 26,465
  grants = 24,964 + 36,431 = 61,395

other comprehensive income:
  revaluation          39,360
  other movements        -466
  sum                  38,894
  = printed Total other comprehensive income for the year

comprehensive income:
  26,465 + 38,894 = 65,359
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

## 5. Extracted entity rows (16, non-additive)

| `gpfs_line_item` | Printed/derived label | `$ '000` | `amount_cents` | Section |
| --- | --- | ---: | ---: | --- |
| `rates_and_annual_charges` | Rates and annual charges | 77,620 | 7,762,000,000 | revenue |
| `user_charges_and_fees` | User charges and fees | 24,074 | 2,407,400,000 | revenue |
| `other_revenues` | Other revenues | 1,400 | 140,000,000 | revenue |
| `government_grants_operating` | Grants and contributions — operating | 24,964 | 2,496,400,000 | revenue |
| `government_grants_capital` | Grants and contributions — capital | 36,431 | 3,643,100,000 | revenue |
| `interest_and_investment_income` | Interest and investment income | 7,363 | 736,300,000 | revenue |
| `total_revenue` | Total income from continuing operations | 171,852 | 17,185,200,000 | revenue |
| `employee_expenses` | Employee benefits and on-costs | 44,067 | 4,406,700,000 | expenses |
| `materials_and_services` | Materials and services | 49,235 | 4,923,500,000 | expenses |
| `borrowing_costs` | Borrowing costs | 1,229 | 122,900,000 | expenses |
| `other_expenses` | Other expenses | 1,522 | 152,200,000 | expenses |
| `net_loss_from_disposal_of_assets` | Net loss from the disposal of assets | 9,018 | 901,800,000 | expenses |
| `total_expenses_excluding_depreciation` | Total expenses excluding depreciation | 105,071 | 10,507,100,000 | expenses |
| `depreciation_amortisation_impairment` | Depreciation, amortisation and impairment | 40,316 | 4,031,600,000 | expenses |
| `total_expenses` | Total expenses (documented bridge) | 145,387 | 14,538,700,000 | expenses |
| `net_result` | Net operating result attributable to Council | 26,465 | 2,646,500,000 | result |

Every row is `jurisdiction_level: "local"`, `jurisdiction: "NSW"`,
`delivery_entity: "Bega Valley Shire Council"`, `aggregation_role: "agency_detail"`,
`measure_type: "actual"`, `verified: false`, `data_quality_flag: "provisional/local_government"`.
Government grant rows carry `potential_double_count: true`.

## 6. No-total / no-cross-council rule

- Bega Valley Shire Council is one entity. No council total, no state/national total and no sum with
  another council, the `dubbo-council` budget/estimate rows, a government program, the PNFC benchmark
  or the OLG summary layer is created.
- The FY2024-25 column is the reporting boundary; the FY2023-24 comparative is not added.
- Revenue, expenses, components and the net result overlap. They are published rows, not an additive
  spending series.
- Every row is `agency_detail` with no `region_id` and no `location`/LGA allocation.

## 7. Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`)

Targeted ingest of **only `bega-valley-gpfs`** against the shared dev DB:

- total measures **998,931 → 998,947** (exactly **+16**);
- GPFS rows **1413 → 1429**;
- active GPFS `data_sources` **73 → 74**;
- SOC rows (`jurisdiction_level: "soc"`) stayed at **205**; every other per-source count unchanged;
- **0** non-`agency_detail` rows, **0** rows with `region_id`/`location`, one
  `delivery_entity` (`Bega Valley Shire Council`), all rows `fiscal_year: "2024-25"`;
- `data_sources` has the source `active` with `records_ingested: 16`;
- the latest `ingestion_logs` entry is `status: "success"`, `records_fetched: 16`,
  `records_upserted: 16`;
- a second ingest upserted the same 16 SHA-anchored natural keys and left the total at **998,947**
  (idempotent, no duplicates).

## 8. How to verify

```bash
# Official page and the exact financial statements PDF (plain UA; Chrome UA 403).
curl -sL -o /dev/null -w '%{http_code}\n' \
  -A 'curl/8.5.0' 'https://www.begavalley.nsw.gov.au/About-Council/Plans-and-Reporting/Financial-Statements'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  -A 'curl/8.5.0' \
  'https://www.begavalley.nsw.gov.au/files/assets/public/v/1/adopted-plans-and-strategies/01-integrated-planning-and-reporting/financial-statements/bega-valley-shire-council-annual_financial_statements-2025.pdf'

# Focused connector tests (18).
TEST_MONGO_URL="mongodb://localhost:27018/ausspend_test_begavalleygpfs" \
  npx vitest run --project server server/test/bega-valley-gpfs.test.ts
```

The focused suite covers the unit gate, exact reconciliation/zero tolerance (including both OCI
components), FY2024-25 acceptance and rejection of the 2023-24 and 2025-26 documents, natural-key/
idempotency, no-cross-council totals and discovery/latest selection (including annual-report
rejection, the documented official fallback pin and the plain-UA header).
