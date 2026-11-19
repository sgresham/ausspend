# NSW council GPFS — Lithgow City Council FY2024-25 evidence

**Status:** implementation evidence only. One council, one audited year. The exact PDF is archived
outside the repo; no PDF or raw table is committed. **Entity:** Lithgow City Council only.
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
| Official Annual Reports page | <https://www.lithgow.nsw.gov.au/Governance/Integrated-Planning-and-Reporting/Performance-Reporting/Annual-Reports> | **200** | `text/html; charset=utf-8`, 89,974 bytes; lists annual reports and financial statements back to 2018-19. |
| FY2024-25 financial statements | <https://www.lithgow.nsw.gov.au/files/assets/public/v/1/governance/ipr/reports/financial-statements-2024-2025.pdf> | **200** | `application/pdf`, 5,369,732 bytes, 104 PDF pages; `last-modified: Mon, 21 Sep 2026 03:05:03 GMT`, `etag: "2585b98b-117d-4fee-8bd6-ce43a780f99d"`. |

The connector parses the official Annual Reports page, selects the financial statements anchor (not
the annual report), and ignores prior years and off-host mirrors. A documented official fallback pin
(the exact PDF URL) is used only if the page yields no usable anchor.

**Akamai UA quirk.** The host is UA-sensitive: a plain client UA (`curl/8.5.0`) returns **200**
`application/pdf`; a bare Chrome UA returns **403**. The connector sends an explicit plain client UA
(plus a broad PDF/HTML `Accept`) for both the listing and the PDF; a focused test asserts that header
is used.

The exact bytes are SHA-256 re-verified before parsing.

## 2. Exact document

- **Title:** Financial Statements 2024-2025 (standalone audited General Purpose Financial Statements,
  year ended 30 June 2025).
- **Financial year:** 2024-25, for the year ended 30 June 2025.
- **URL:** `https://www.lithgow.nsw.gov.au/files/assets/public/v/1/governance/ipr/reports/financial-statements-2024-2025.pdf`
- **Bytes:** 5,369,732.
- **PDF pages:** 104.
- **SHA-256:** `4067a84e20dd7c35e1afe3843805373fa4acc110838c0b4e7f0f62e05d8684de`.
- **Archive:** `lithgow-gpfs/financial-statements-2024-2025.pdf` under the configured source-archive
  root (outside the repo; not committed). It holds the exact PDF plus archive metadata (URL,
  retrieval date, bytes, SHA-256, content type) and the archive record. The connector re-verifies the
  hash before parsing.

## 3. Printed unit and statement

The Income Statement is on PDF page 4 (printed page 4). It prints `$ '000`. The unit gate requires
**`$ '000` / thousands**; a plain `$`, `$M` or unit-less read is rejected. The adapter reads the
FY2024-25 Actual column only (labelled 2025), not the Original unaudited budget column that prints
before each label.

The FY2024-25 column prints (whole `$ '000`):

```text
Income from continuing operations
  Rates and annual charges                               40,370
  User charges and fees                                   8,819
  Other revenues                                          1,423
  Grants and contributions provided for operating purposes 7,039
  Grants and contributions provided for capital purposes 16,901
  Interest and investment income                          3,779
  Other income                                              580
  Total income from continuing operations                78,911
Expenses from continuing operations
  Employee benefits and on-costs                         24,351
  Materials and services                                 28,274
  Borrowing costs                                           490
  Other expenses                                          8,392
  Net loss from the disposal of assets                    6,979
  Total expenses ... excluding depreciation              68,486
  Depreciation, amortisation and impairment              18,512
  Operating result from continuing operations            (8,087)
  Net operating result attributable to Council           (8,087)
  Net operating result before capital grants            (24,988)
```

The statement prints **no Total expenses line**. Total expenses is the printed face bridge:
expenses-excluding-depreciation `68,486` + depreciation/amortisation/impairment `18,512` = `86,998`,
which equals the B1-1 "Total functions and activities" expense total.

## 4. Reconciliation (zero tolerance)

All arithmetic is in whole printed `$ '000` values:

```text
revenue components:
  40,370 + 8,819 + 1,423 + 7,039 + 16,901 + 3,779 + 580 = 78,911
  = printed Total income

expense components:
  24,351 + 28,274 + 490 + 8,392 + 6,979 = 68,486
  = printed expenses excluding depreciation

total expenses:
  68,486 + 18,512 = 86,998
  = printed B1-1 Total functions and activities expenses

operating result:
  78,911 - 86,998 = -8,087
  = printed Operating result (loss)

net result:
  -8,087 = printed Net operating result attributable to Council (stored with a negative sign marker)

before capital grants:
  -8,087 - 16,901 = -24,988
  = printed before-capital result (evidence only)

B1-1:
  income = 78,911
  expenses = 86,998
  operating result = -8,087
  grants = 7,039 + 16,901 = 23,940

other comprehensive income:
  revaluation                             -27,928
  remediation provision fair value adj     -411
  sum                                    -28,339
  = printed Total other comprehensive income for the year

comprehensive income:
  -8,087 + (-28,339) = -36,426
  = printed Total and comprehensive income
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
| `rates_and_annual_charges` | Rates and annual charges | 40,370 | 4,037,000,000 | revenue |
| `user_charges_and_fees` | User charges and fees | 8,819 | 881,900,000 | revenue |
| `other_revenues` | Other revenues | 1,423 | 142,300,000 | revenue |
| `government_grants_operating` | Grants and contributions — operating | 7,039 | 703,900,000 | revenue |
| `government_grants_capital` | Grants and contributions — capital | 16,901 | 1,690,100,000 | revenue |
| `interest_and_investment_income` | Interest and investment income | 3,779 | 377,900,000 | revenue |
| `other_income` | Other income | 580 | 58,000,000 | revenue |
| `total_revenue` | Total income from continuing operations | 78,911 | 7,891,100,000 | revenue |
| `employee_expenses` | Employee benefits and on-costs | 24,351 | 2,435,100,000 | expenses |
| `materials_and_services` | Materials and services | 28,274 | 2,827,400,000 | expenses |
| `borrowing_costs` | Borrowing costs | 490 | 49,000,000 | expenses |
| `other_expenses` | Other expenses | 8,392 | 839,200,000 | expenses |
| `net_loss_from_disposal_of_assets` | Net loss from the disposal of assets | 6,979 | 697,900,000 | expenses |
| `total_expenses_excluding_depreciation` | Total expenses excluding depreciation | 68,486 | 6,848,600,000 | expenses |
| `depreciation_amortisation_impairment` | Depreciation, amortisation and impairment | 18,512 | 1,851,200,000 | expenses |
| `total_expenses` | Total expenses (documented bridge) | 86,998 | 8,699,800,000 | expenses |
| `net_result` | Net operating result attributable to Council | -8,087 | 808,700,000 | result |

The `net_result` row carries `gpfs_printed_sign: "negative"`; every other row is stored as a positive
magnitude. Every row is `jurisdiction_level: "local"`, `jurisdiction: "NSW"`,
`delivery_entity: "Lithgow City Council"`, `aggregation_role: "agency_detail"`,
`measure_type: "actual"`, `verified: false`, `data_quality_flag: "provisional/local_government"`.
Government grant rows carry `potential_double_count: true`.

## 6. No-total / no-cross-council rule

- Lithgow City Council is one entity. No council total, no state/national total and no sum with
  another council, the `dubbo-council` budget/estimate rows, a government program, the PNFC benchmark
  or the OLG summary layer is created.
- The FY2024-25 column is the reporting boundary; the FY2023-24 comparative is not added.
- Revenue, expenses, components and the net result overlap. They are published rows, not an additive
  spending series.
- Every row is `agency_detail` with no `region_id` and no `location`/LGA allocation.

## 7. Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`)

Targeted ingest of **only `lithgow-gpfs`** against the shared dev DB:

- total measures **998,897 → 998,914** (exactly **+17**);
- GPFS rows **1379 → 1396**;
- active GPFS `data_sources` **71 → 72**;
- SOC rows (`jurisdiction_level: "soc"`) stayed at **205**; every other per-source count unchanged;
- **0** non-`agency_detail` rows, **0** rows with `region_id`/`location`, one
  `delivery_entity` (`Lithgow City Council`), all rows `fiscal_year: "2024-25"`;
- `data_sources` has the source `active` with `records_ingested: 17`;
- the latest `ingestion_logs` entry is `status: "success"`, `records_fetched: 17`,
  `records_upserted: 17`;
- a second ingest upserted the same 17 SHA-anchored natural keys and left the total at **998,914**
  (idempotent, no duplicates).

## 8. How to verify

```bash
# Official page and the exact financial statements PDF (plain UA; Chrome UA 403).
curl -sL -o /dev/null -w '%{http_code}\n' \
  -A 'curl/8.5.0' 'https://www.lithgow.nsw.gov.au/Governance/Integrated-Planning-and-Reporting/Performance-Reporting/Annual-Reports'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  -A 'curl/8.5.0' \
  'https://www.lithgow.nsw.gov.au/files/assets/public/v/1/governance/ipr/reports/financial-statements-2024-2025.pdf'

# Focused connector tests (18).
TEST_MONGO_URL="mongodb://localhost:27018/ausspend_test_lithgowgpfs" \
  npx vitest run --project server server/test/lithgow-gpfs.test.ts
```

The focused suite covers the unit gate, exact reconciliation/zero tolerance (including both OCI
components and the negative net result sign marker), FY2024-25 current-available acceptance and
rejection of 2023-24/2025-26 substitutions, natural-key/idempotency, no-cross-council totals and
discovery/latest selection (including annual-report rejection, the documented official fallback pin
and the plain-UA header).
