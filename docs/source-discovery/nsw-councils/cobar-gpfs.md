# Cobar Shire Council — General Purpose Financial Statements (FY2025-26)

Source id `cobar-gpfs` (NSW local government). One council only; entity-level rows, no council total
and no cross-council or state/federal addition.

## 1. Source and year

- Publisher: **Cobar Shire Council**.
- Document: standalone audited **General Purpose Financial Statements for the year ended 30 June
  2026** — FY2025-26. The 92-page PDF carries the signed statements, notes and the independent
  auditor's reports.
- FY2025-26 is the **current audited year**. The connector targets `2025-26` only and never
  substitutes a prior-year (2024-25 or 2023-24), a budget/planning document, the narrative annual
  report, the SPFS or the special schedules. A link whose file name or label maps to any other fiscal
  year is rejected; the FY2024-25 and 2026-27 cases are covered by focused tests.
- Official GPFS page: <https://www.cobar.nsw.gov.au/48634-2/>.
- Current exact PDF:
  <https://www.cobar.nsw.gov.au/wp-content/uploads/2026/10/Annual_Financial_Statements-2026.pdf>.
  The same URL is the documented official fallback pin, used only when the listing yields no usable
  FY2025-26 anchor; the downloaded bytes are SHA-256 verified either way.

## 2. Discovery and fetch

The official page is a WordPress uploads page whose statement link is the direct `.pdf` upload
(anchor text "HERE"). The connector parses `.pdf` anchors on the same host, ignores the annual
report, SPFS/special-purpose statements, special schedules, public notices, presentations, policies
and mirrors, and maps the file name `Annual_Financial_Statements-2026.pdf` to FY2025-26. The parser
uses only the label and the file name for the fiscal year, so upload-path dates (e.g. `/2026/10/`) do
not create a false year pair. A focused test asserts the current-year link is selected ahead of the
prior year and that a prior-only or future-only listing cannot satisfy the target.

The host serves the PDF with `200 application/pdf` to a plain client User-Agent. The connector sends
an explicit plain `curl/8.5.0` UA (plus a broad PDF/HTML `Accept`) for deterministic discovery and
download; a focused test asserts that header.

## 3. Archive (outside the repo)

The exact downloaded bytes are archived outside the repository under the configured source-archive
root, with a relative archive path `cobar-gpfs/Annual_Financial_Statements-2026.pdf`:

- URL: `https://www.cobar.nsw.gov.au/wp-content/uploads/2026/10/Annual_Financial_Statements-2026.pdf`
- retrieval date: 2026-11-19
- bytes: **3,507,784**
- SHA-256: `7a87b8655b7eb5d15d380c6ce0c6d12bea557e9958b0ad555046aa9229c66eb3`
- content type: `application/pdf`

No PDF is committed. The fixture and this note contain only the relative archive path.

## 4. Exact reconciliation (zero tolerance)

The printed unit is explicit `$ '000` on the income statement, comprehensive-income statement and
B1-1. A missing or conflicting unit rejects the whole extraction. Nothing is emitted unless all of
these agree exactly (one thousand dollars is a failure):

| Check | Printed / derived (`$ '000`) | Result |
| --- | --- | --- |
| Total income from continuing operations (Income Statement) | 75,336 | = 7,533,600,000 cents |
| Revenue components sum (rates 9,364 + user charges 26,590 + other revenues 1,972 + operating grants 16,952 + capital grants 18,890 + interest 1,346 + net gain on disposal 222) | 75,336 | = printed total |
| Expense components sum (employee 18,452 + materials 23,896 + borrowing 141 + other 804) | 43,293 | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment 11,398 | 54,691 | = total expenses |
| B1-1 Total functions and activities — income | 75,336 | = face total revenue |
| B1-1 Total functions and activities — expenses | 54,691 | = face expense bridge |
| B1-1 Total functions and activities — operating result | 20,645 | = face net result |
| B1-1 grants and contributions | 35,842 | = operating 16,952 + capital 18,890 |
| Total revenue − total expenses | 75,336 − 54,691 = 20,645 | = printed net result |
| Net result − capital grants | 20,645 − 18,890 = 1,755 | = printed before-capital result (evidence only) |
| Comprehensive-income net result | 20,645 | = Income Statement net result |
| Other comprehensive income (revaluation 21,384 + joint ventures/associates −247) | 21,137 | = printed other comprehensive income |
| Net result + other comprehensive income | 20,645 + 21,137 = 41,782 | = printed total comprehensive income |

The Income Statement does not print a "Total expenses" line. Total expenses is therefore the
documented bridge of the printed expenses-excluding-depreciation line (43,293) plus the printed
depreciation/amortisation/impairment line (11,398) = 54,691, which equals the printed B1-1 expense
total. Cobar prints a real net **gain** on disposal of assets (222), emitted as a revenue row; there
is no net loss on disposal. The net result and the before-capital result are both positive; the
before-capital figure is retained in reconciliation evidence only. Other comprehensive income has
two printed components, and their sum is checked against the printed OCI.

The adapter defers the document with **0 rows** and the exact gap if any printed line is missing, the
unit is not thousands, or any bridge differs. On the audited FY2025-26 report there is no deferral.

## 5. Extracted entity rows (16, non-additive)

| `gpfs_line_item` | Printed/derived label | `$ '000` | `amount_cents` | Section |
| --- | --- | ---: | ---: | --- |
| `rates_and_annual_charges` | Rates and annual charges | 9,364 | 936,400,000 | revenue |
| `user_charges_and_fees` | User charges and fees | 26,590 | 2,659,000,000 | revenue |
| `other_revenues` | Other revenues | 1,972 | 197,200,000 | revenue |
| `government_grants_operating` | Grants and contributions — operating | 16,952 | 1,695,200,000 | revenue |
| `government_grants_capital` | Grants and contributions — capital | 18,890 | 1,889,000,000 | revenue |
| `interest_and_investment_income` | Interest and investment income | 1,346 | 134,600,000 | revenue |
| `net_gain_from_disposal_of_assets` | Net gain from the disposal of assets | 222 | 22,200,000 | revenue |
| `total_revenue` | Total income from continuing operations | 75,336 | 7,533,600,000 | revenue |
| `employee_expenses` | Employee benefits and on-costs | 18,452 | 1,845,200,000 | expenses |
| `materials_and_services` | Materials and services | 23,896 | 2,389,600,000 | expenses |
| `borrowing_costs` | Borrowing costs | 141 | 14,100,000 | expenses |
| `other_expenses` | Other expenses | 804 | 80,400,000 | expenses |
| `total_expenses_excluding_depreciation` | Total expenses excluding depreciation | 43,293 | 4,329,300,000 | expenses |
| `depreciation_amortisation_impairment` | Depreciation, amortisation and impairment | 11,398 | 1,139,800,000 | expenses |
| `total_expenses` | Total expenses (documented bridge) | 54,691 | 5,469,100,000 | expenses |
| `net_result` | Net operating result attributable to Council | 20,645 | 2,064,500,000 | result |

Every row is `jurisdiction_level: "local"`, `jurisdiction: "NSW"`,
`delivery_entity: "Cobar Shire Council"`, `aggregation_role: "agency_detail"`,
`measure_type: "actual"`, `verified: false`, `data_quality_flag: "provisional/local_government"`.
Government grant rows carry `potential_double_count: true`.

## 6. No-total / no-cross-council rule

- Cobar Shire Council is one entity. No council total, no state/national total and no sum with
  another council, the `dubbo-council` budget/estimate rows, a government program, the PNFC benchmark
  or the OLG summary layer is created.
- The FY2025-26 column is the reporting boundary; the FY2024-25 comparative is not added.
- Revenue, expenses, components and the net result overlap. They are published rows, not an additive
  spending series.
- Every row is `agency_detail` with no `region_id` and no `location`/LGA allocation.

## 7. Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`)

Targeted ingest of **only `cobar-gpfs`** against the shared dev DB `ausspend_dev`:

- total measures **999,049 → 999,065** (exactly **+16**);
- GPFS rows (`source_id` matching `/gpfs$/`) **1531 → 1547**;
- active GPFS `data_sources` **80 → 81**;
- SOC rows (`jurisdiction_level: "soc"`) stayed at **205**; every other per-source count unchanged;
- **0** non-`agency_detail` rows, **0** rows with `region_id`/`location`, one
  `delivery_entity` (`Cobar Shire Council`), all rows `fiscal_year: "2025-26"`, and no
  council-total/aggregate row;
- `data_sources` has the source `active` with `records_ingested: 16`;
- the latest `ingestion_logs` entry for the source is `status: "success"`,
  `records_fetched: 16`, `records_upserted: 16`.

The exact PDF is archived outside the repo at the relative path
`cobar-gpfs/Annual_Financial_Statements-2026.pdf` with the SHA-256 above; no PDF is committed.

## 8. How to verify

```bash
# Official GPFS page and the exact PDF.
curl -sL -o /dev/null -w '%{http_code}\n' \
  -A 'curl/8.5.0' 'https://www.cobar.nsw.gov.au/48634-2/'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  -A 'curl/8.5.0' \
  'https://www.cobar.nsw.gov.au/wp-content/uploads/2026/10/Annual_Financial_Statements-2026.pdf'

# Focused connector tests (17).
TEST_MONGO_URL="mongodb://localhost:27018/ausspend_test_cobargpfs" \
  npx vitest run --project server server/test/cobar-gpfs.test.ts
```

The focused suite covers the unit gate, exact reconciliation/zero tolerance, FY2025-26 acceptance
and rejection of 2024-25/2026-27 documents, natural-key/idempotency, no-cross-council totals and
discovery/latest selection (annual-report, SPFS, special-schedule, policy and mirror rejection, the
documented official fallback pin and the plain-UA header).
