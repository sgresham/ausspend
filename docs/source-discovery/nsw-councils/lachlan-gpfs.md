# Lachlan Shire Council — General Purpose Financial Statements (FY2024-25)

Source id `lachlan-gpfs` (NSW local government). One council only; entity-level rows, no council
total and no cross-council or state/federal addition.

## 0. Stale-year check (FY2025-26 not available as audited standalone statements)

The work-item title said FY2024-25. The official **Integrated Planning and Reporting** page was
checked on 2026-11-19. The newest published audited standalone statements are **2024-2025 Annual
Financial Statements** — the year ended 30 June 2025, FY2024-25. The page also lists 2023-2024 and
2022-2023 annual financial statements, plus 2024-2025 and earlier annual reports and delivery
program/budget documents. The annual reports are narrative documents, not audited standalone
statements. There is **no FY2025-26 audited standalone statements PDF** that downloads. This
connector therefore targets **FY2024-25** and never substitutes a 2025-26/2023-24 document, the
narrative annual report, the SPFS or the special schedules. A 404/JS-only 2025-26 link is recorded
as a gap, not a reason to fabricate.

## 1. Source and year

- Publisher: **Lachlan Shire Council**.
- Document: standalone audited **2024-2025 Annual Financial Statements** for the year ended 30 June
  2025 — FY2024-25. The 106-page PDF carries the signed GPFS, notes and the independent auditor's
  reports.
- Official page:
  <https://www.lachlan.nsw.gov.au/Council/Plans-Strategies/Integrated-Planning-and-Reporting>.
- Current exact PDF:
  <https://www.lachlan.nsw.gov.au/files/assets/public/v/1/council/policies/new-folder/new-folder/final-financial-report-2025.pdf>.
  The same URL is the documented official fallback pin, used when the listing yields no usable
  anchor; the downloaded bytes are SHA-256 verified either way.

## 2. Access, discovery and fetch

The inventory recorded an Edge/Akamai WAF returning `403 text/html` to bare curl, with a browser
fetch required. In this retrieval run (2026-11-19) **both the Integrated Planning and Reporting page
and the PDF returned `200`** to `curl/8.5.0` (PDF `application/pdf`, 2,779,801 bytes), so no browser
fetch was needed for the live ingest. The connector still sends an explicit plain `curl/8.5.0` UA
(plus a broad PDF/HTML `Accept`) and falls back to the documented official pin if the page is
challenged or yields no usable anchor; a focused test simulates a `403` listing and asserts the pin
fallback. `scripts/lachlan-gpfs-browser.ts` is the documented headless-Chromium fallback for a
challenged run: it loads the official page, parses the link from the cleared HTML and fetches the
exact bytes same-origin. No unofficial mirror was used.

The parser accepts direct `.pdf` uploads whose label or file name contains "Financial Statements"
and rejects the narrative annual report, SPFS/special schedules, public notices, policies and
mirrors. The fiscal year is derived from the anchor label and file name
(`2024-2025 Annual Financial Statements` → FY2024-25), not from an upload-path date.

## 3. Archive (outside the repo)

The exact downloaded bytes are archived outside the repository under the configured source-archive
root, with the relative archive path `lachlan-gpfs/final-financial-report-2025.pdf`:

- URL: `https://www.lachlan.nsw.gov.au/files/assets/public/v/1/council/policies/new-folder/new-folder/final-financial-report-2025.pdf`
- retrieval date: 2026-11-19
- bytes: **2,779,801**
- SHA-256: `fd37d9c67e1b2e93e9537e29b81245954511d25a4f7d9e21ac2a41122dee9b16`
- content type: `application/pdf`

No PDF is committed. The fixture and this note contain only the relative archive path.

## 4. Exact reconciliation (zero tolerance)

The printed unit is explicit `$ '000` on the income statement, comprehensive-income statement and
B1-1. A missing or conflicting unit rejects the whole extraction. Nothing is emitted unless all of
these agree exactly (one thousand dollars is a failure):

| Check | Printed / derived (`$ '000`) | Result |
| --- | --- | --- |
| Total income from continuing operations (Income Statement) | 50,922 | = 5,092,200,000 cents |
| Revenue components sum (rates 14,083 + user charges 4,559 + other revenues 1,090 + operating grants 19,884 + capital grants 6,842 + interest 3,742 + other income 722; 2025 net gain on disposal nil) | 50,922 | = printed total |
| Expense components sum (employee 12,709 + materials 27,341 + borrowing 311 + other 1,145 + net loss on disposal 105) | 41,611 | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment 12,729 | 54,340 | = total expenses |
| B1-1 Total functions and activities — income | 50,922 | = face total revenue |
| B1-1 Total functions and activities — expenses | 54,340 | = face expense bridge |
| B1-1 Total functions and activities — operating result | (3,418) | = face net result |
| B1-1 grants and contributions | 26,726 | = operating 19,884 + capital 6,842 |
| Total revenue − total expenses | 50,922 − 54,340 = (3,418) | = printed net result (negative) |
| Net result − capital grants | (3,418) − 6,842 = (10,260) | = printed negative before-capital result (evidence only) |
| Comprehensive-income net result | (3,418) | = Income Statement net result |
| Other comprehensive income (single 2025 revaluation component) | 16,508 | = printed other comprehensive income |
| Net result + other comprehensive income | (3,418) + 16,508 = 13,090 | = printed total comprehensive income |

The Income Statement does not print a "Total expenses" line. Total expenses is therefore the
documented bridge of the printed expenses-excluding-depreciation line (41,611) plus the printed
depreciation/amortisation/impairment line (12,729) = 54,340, which equals the printed B1-1 expense
total. The council prints a real net **loss** on disposal of assets (105), emitted as an expense
row; the 2025 net gain on disposal is nil and is not emitted. The net result is negative (−3,418)
and is stored with a printed-sign marker; the before-capital result is more negative (−10,260) and
is retained in reconciliation evidence only. Other comprehensive income has a single printed 2025
component — revaluation (16,508) — which equals the printed other comprehensive income.

The adapter defers the document with **0 rows** and the exact gap if any printed line is missing,
the unit is not thousands, or any bridge differs. On the audited FY2024-25 report there is no
deferral.

## 5. Extracted entity rows (17, non-additive)

| `gpfs_line_item` | Printed/derived label | `$ '000` | `amount_cents` | Section |
| --- | --- | ---: | ---: | --- |
| `rates_and_annual_charges` | Rates and annual charges | 14,083 | 1,408,300,000 | revenue |
| `user_charges_and_fees` | User charges and fees | 4,559 | 455,900,000 | revenue |
| `other_revenue` | Other revenues | 1,090 | 109,000,000 | revenue |
| `government_grants_operating` | Grants and contributions — operating | 19,884 | 1,988,400,000 | revenue |
| `government_grants_capital` | Grants and contributions — capital | 6,842 | 684,200,000 | revenue |
| `interest_and_investment_income` | Interest and investment income | 3,742 | 374,200,000 | revenue |
| `other_income` | Other income | 722 | 72,200,000 | revenue |
| `total_revenue` | Total income from continuing operations | 50,922 | 5,092,200,000 | revenue |
| `employee_expenses` | Employee benefits and on-costs | 12,709 | 1,270,900,000 | expenses |
| `materials_and_services` | Materials and services | 27,341 | 2,734,100,000 | expenses |
| `borrowing_costs` | Borrowing costs | 311 | 31,100,000 | expenses |
| `other_expenses` | Other expenses | 1,145 | 114,500,000 | expenses |
| `net_loss_from_disposal_of_assets` | Net loss from the disposal of assets | 105 | 10,500,000 | expenses |
| `total_expenses_excluding_depreciation` | Total expenses excluding depreciation | 41,611 | 4,161,100,000 | expenses |
| `depreciation_amortisation_impairment` | Depreciation, amortisation and impairment | 12,729 | 1,272,900,000 | expenses |
| `total_expenses` | Total expenses (documented bridge) | 54,340 | 5,434,000,000 | expenses |
| `net_result` | Net operating result attributable to Council | (3,418) | 341,800,000 (printed negative) | result |

Every row is `jurisdiction_level: "local"`, `jurisdiction: "NSW"`,
`delivery_entity: "Lachlan Shire Council"`, `aggregation_role: "agency_detail"`,
`measure_type: "actual"`, `verified: false`, `data_quality_flag: "provisional/local_government"`.
Government grant rows carry `potential_double_count: true`. The net-result row carries
`gpfs_printed_sign: "negative"`.

## 6. No-total / no-cross-council rule

- Lachlan Shire Council is one entity. No council total, no state/national total and no sum with
  another council, the `dubbo-council` budget/estimate rows, a government program, the PNFC
  benchmark or the OLG summary layer is created.
- The FY2024-25 column is the reporting boundary; the FY2023-24 comparative is not added.
- Revenue, expenses, components and the net result overlap. They are published rows, not an
  additive spending series.
- Every row is `agency_detail` with no `region_id` and no `location`/LGA allocation.

## 7. Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`)

Targeted ingest of **only `lachlan-gpfs`** against the shared dev DB `ausspend_dev`:

- total measures **999,370 → 999,387** (exactly **+17**);
- GPFS rows (`source_id` matching `/gpfs$/`) **1852 → 1869**;
- active GPFS `data_sources` **99 → 100**;
- SOC rows (`jurisdiction_level: "soc"`) stayed at **205**; every other per-source count unchanged;
- **0** non-`agency_detail` rows, **0** rows with `region_id`/`location`, one `delivery_entity`
  (`Lachlan Shire Council`), all rows `fiscal_year: "2024-25"`, and no council-total/aggregate row;
- `data_sources` has the source `active` with `records_ingested: 17`;
- the latest `ingestion_logs` entry for the source is `status: "success"`,
  `records_fetched: 17`, `records_upserted: 17`.

The exact PDF is archived outside the repo at the relative path
`lachlan-gpfs/final-financial-report-2025.pdf` with the SHA-256 above; no PDF is committed.

## 8. How to verify

```bash
# Official page and exact FY2024-25 PDF (200 in this retrieval run).
curl -sL -o /dev/null -w '%{http_code}\n' \
  -A 'curl/8.5.0' \
  'https://www.lachlan.nsw.gov.au/Council/Plans-Strategies/Integrated-Planning-and-Reporting'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  -A 'curl/8.5.0' \
  'https://www.lachlan.nsw.gov.au/files/assets/public/v/1/council/policies/new-folder/new-folder/final-financial-report-2025.pdf'

# Focused connector tests (19).
TEST_MONGO_URL="mongodb://localhost:27017/ausspend_test_lachlangpfs" \
  npx vitest run --project server server/test/lachlan-gpfs.test.ts
```

The focused suite covers the unit gate, exact reconciliation/zero tolerance (including the negative
net result, the before-capital result, the net loss on disposal and the single OCI revaluation
component), FY2024-25 acceptance and rejection of 2025-26/2023-24 documents, natural-key/idempotency,
no-cross-council totals, discovery/latest selection (annual report, prior-year and mirror rejection),
the `403`→documented-pin WAF fallback and the plain-UA header.
