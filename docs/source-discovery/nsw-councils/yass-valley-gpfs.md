# Yass Valley Council — General Purpose Financial Statements (FY2024-25)

Source id `yass-valley-gpfs` (NSW local government). One council only; entity-level rows, no council
total and no cross-council or state/federal addition.

## 0. Stale-year check (FY2025-26 not available)

The work-item title said FY2024-25. The official Integrated Planning and Reporting Documents page was
checked on 2026-11-19: the newest audited financial statements are **FY2024-25**; **no FY2025-26
audited standalone statements are published**. The 2025-26/2026-27 documents listed are budgets,
operational plans, revenue statements, fees and quarterly reviews, not audited statements. This
connector therefore targets **FY2024-25**, the latest obtainable audited year, and never substitutes
a 2025-26 or 2023-24 document, the narrative annual report, the SPFS or the special schedules.

## 1. Source and year

- Publisher: **Yass Valley Council**.
- Document: standalone audited **General Purpose Financial Statements for the year ended 30 June
  2025** — FY2024-25. The 93-page PDF carries the signed GPFS, notes and the independent auditor's
  reports.
- FY2024-25 is the **latest obtainable audited year**. The connector targets `2024-25` only and never
  substitutes the later 2025-26 or the earlier 2023-24 document, the narrative annual report, the
  SPFS or the special schedules. A link whose label or file name maps to any other fiscal year is
  rejected; the FY2025-26 and FY2022-23 cases are covered by focused tests.
- Official page:
  <https://www.yassvalley.nsw.gov.au/Our-Council/Policies-Plans-and-Reports/Integrated-Planning-and-Reporting-Documents>.
- Current exact PDF:
  <https://www.yassvalley.nsw.gov.au/files/assets/public/v/2/ipr-council-docs/2024-25/yass-valley-council-audited-2025-financial-statements.pdf>.
  The same URL is the documented official fallback pin, used when the listing yields no usable
  anchor; the downloaded bytes are SHA-256 verified either way.

## 2. Access, discovery and fetch

The inventory recorded an Edge/Akamai WAF returning `403 text/html` to plain curl, with the PDF
reachable in headless Chromium. In this retrieval run (2026-11-19) **both the listing page and the PDF
returned `200`** to `curl/8.5.0`, so no browser fetch was needed. The connector still sends an
explicit plain `curl/8.5.0` UA (plus a broad PDF/HTML `Accept`) and falls back to the documented
official pin if the page is challenged or yields no usable anchor; a focused test simulates a `403`
listing and asserts the pin fallback. No unofficial mirror was used.

The official page lists the integrated planning and reporting documents, including the FY2024-25
audited financial statements. The parser accepts direct `.pdf` uploads whose label or file name
contains "Financial Statements" and rejects the narrative annual report, SPFS/special schedules,
public notices, policies and mirrors. The fiscal year is derived from the anchor label and file name
(`yass-valley-council-audited-2025-financial-statements.pdf` → FY2024-25), not from an upload-path
date.

## 3. Archive (outside the repo)

The exact downloaded bytes are archived outside the repository under the configured source-archive
root, with the relative archive path
`yass-valley-gpfs/yass-valley-council-audited-2025-financial-statements.pdf`:

- URL: `https://www.yassvalley.nsw.gov.au/files/assets/public/v/2/ipr-council-docs/2024-25/yass-valley-council-audited-2025-financial-statements.pdf`
- retrieval date: 2026-11-19
- bytes: **2,310,734**
- SHA-256: `235284e482325fabb6b96a57e18fa9ab3619e950f28bac92d25812b8ae7dfed9`
- content type: `application/pdf`

No PDF is committed. The fixture and this note contain only the relative archive path.

## 4. Exact reconciliation (zero tolerance)

The printed unit is explicit `$ '000` on the income statement, comprehensive-income statement and
B1-1. A missing or conflicting unit rejects the whole extraction. Nothing is emitted unless all of
these agree exactly (one thousand dollars is a failure):

| Check | Printed / derived (`$ '000`) | Result |
| --- | --- | --- |
| Total income from continuing operations (Income Statement) | 61,813 | = 6,181,300,000 cents |
| Revenue components sum (rates 23,156 + user charges 6,180 + other revenues 680 + operating grants 8,648 + capital grants 20,421 + interest 2,310 + other income 418; 2025 net gain on disposal nil) | 61,813 | = printed total |
| Expense components sum (employee 13,295 + materials 13,023 + borrowing 717 + other 1,137 + net loss on disposal 1,223) | 29,395 | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment 10,059 | 39,454 | = total expenses |
| B1-1 "Total" row — income | 61,813 | = face total revenue |
| B1-1 "Total" row — expenses | 39,454 | = face expense bridge |
| B1-1 "Total" row — operating result | 22,359 | = face net result |
| B1-1 grants and contributions | 29,069 | = operating 8,648 + capital 20,421 |
| Total income − total expenses | 61,813 − 39,454 = 22,359 | = printed net result |
| Net result − capital grants | 22,359 − 20,421 = 1,938 | = printed before-capital result (evidence only) |
| Comprehensive-income net result | 22,359 | = Income Statement net result |
| Other comprehensive income (revaluation 61,817) | 61,817 | = printed "Total items which will not be reclassified" |
| Net result + other comprehensive income | 22,359 + 61,817 = 84,176 | = printed total comprehensive income |

The Income Statement does not print a "Total expenses" line. Total expenses is therefore the
documented bridge of the printed expenses-excluding-depreciation line (29,395) plus the printed
depreciation/amortisation/impairment line (10,059) = 39,454, which equals the printed B1-1 "Total"
expense row. Yass labels its B1-1 total row simply **"Total"**; the adapter parses that row. It prints
a real net **loss** on disposal of assets (1,223), emitted as an expense row; the 2025 net gain on
disposal is nil and is not emitted. The net result and before-capital result are both positive; the
before-capital figure is retained in reconciliation evidence only. Other comprehensive income has a
single printed component (revaluation). This council does not print a separate "Total other
comprehensive income" line, so the printed "Total items which will not be reclassified subsequent to
operating result" is used as the OCI total and is checked against the component.

The adapter defers the document with **0 rows** and the exact gap if any printed line is missing, the
unit is not thousands, or any bridge differs. On the audited FY2024-25 report there is no deferral.

## 5. Extracted entity rows (17, non-additive)

| `gpfs_line_item` | Printed/derived label | `$ '000` | `amount_cents` | Section |
| --- | --- | ---: | ---: | --- |
| `rates_and_annual_charges` | Rates and annual charges | 23,156 | 2,315,600,000 | revenue |
| `user_charges_and_fees` | User charges and fees | 6,180 | 618,000,000 | revenue |
| `other_revenue` | Other revenues | 680 | 68,000,000 | revenue |
| `government_grants_operating` | Grants and contributions — operating | 8,648 | 864,800,000 | revenue |
| `government_grants_capital` | Grants and contributions — capital | 20,421 | 2,042,100,000 | revenue |
| `interest_and_investment_income` | Interest and investment income | 2,310 | 231,000,000 | revenue |
| `other_income` | Other income | 418 | 41,800,000 | revenue |
| `total_revenue` | Total income from continuing operations | 61,813 | 6,181,300,000 | revenue |
| `employee_expenses` | Employee benefits and on-costs | 13,295 | 1,329,500,000 | expenses |
| `materials_and_services` | Materials and services | 13,023 | 1,302,300,000 | expenses |
| `borrowing_costs` | Borrowing costs | 717 | 71,700,000 | expenses |
| `other_expenses` | Other expenses | 1,137 | 113,700,000 | expenses |
| `net_loss_from_disposal_of_assets` | Net loss from the disposal of assets | 1,223 | 122,300,000 | expenses |
| `total_expenses_excluding_depreciation` | Total expenses excluding depreciation | 29,395 | 2,939,500,000 | expenses |
| `depreciation_amortisation_impairment` | Depreciation, amortisation and impairment | 10,059 | 1,005,900,000 | expenses |
| `total_expenses` | Total expenses (documented bridge) | 39,454 | 3,945,400,000 | expenses |
| `net_result` | Net operating result attributable to Council | 22,359 | 2,235,900,000 | result |

Every row is `jurisdiction_level: "local"`, `jurisdiction: "NSW"`,
`delivery_entity: "Yass Valley Council"`, `aggregation_role: "agency_detail"`,
`measure_type: "actual"`, `verified: false`, `data_quality_flag: "provisional/local_government"`.
Government grant rows carry `potential_double_count: true`.

## 6. No-total / no-cross-council rule

- Yass Valley Council is one entity. No council total, no state/national total and no sum with
  another council, the `dubbo-council` budget/estimate rows, a government program, the PNFC benchmark
  or the OLG summary layer is created.
- The FY2024-25 column is the reporting boundary; the FY2023-24 comparative is not added.
- Revenue, expenses, components and the net result overlap. They are published rows, not an additive
  spending series.
- Every row is `agency_detail` with no `region_id` and no `location`/LGA allocation.

## 7. Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`)

Targeted ingest of **only `yass-valley-gpfs`** against the shared dev DB `ausspend_dev`:

- total measures **999,270 → 999,287** (exactly **+17**);
- GPFS rows (`source_id` matching `/gpfs$/`) **1752 → 1769**;
- active GPFS `data_sources` **93 → 94**;
- SOC rows (`jurisdiction_level: "soc"`) stayed at **205**; every other per-source count unchanged;
- **0** non-`agency_detail` rows, **0** rows with `region_id`/`location`, one `delivery_entity`
  (`Yass Valley Council`), all rows `fiscal_year: "2024-25"`, and no council-total/aggregate row;
- `data_sources` has the source `active` with `records_ingested: 17`;
- the latest `ingestion_logs` entry for the source is `status: "success"`,
  `records_fetched: 17`, `records_upserted: 17`.

The exact PDF is archived outside the repo at the relative path
`yass-valley-gpfs/yass-valley-council-audited-2025-financial-statements.pdf` with the SHA-256 above;
no PDF is committed.

## 8. How to verify

```bash
# Official page and the exact FY2024-25 PDF (200 in this retrieval run).
curl -sL -o /dev/null -w '%{http_code}\n' \
  -A 'curl/8.5.0' 'https://www.yassvalley.nsw.gov.au/Our-Council/Policies-Plans-and-Reports/Integrated-Planning-and-Reporting-Documents'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  -A 'curl/8.5.0' \
  'https://www.yassvalley.nsw.gov.au/files/assets/public/v/2/ipr-council-docs/2024-25/yass-valley-council-audited-2025-financial-statements.pdf'

# Focused connector tests (19).
TEST_MONGO_URL="mongodb://localhost:27018/ausspend_test_yassvalleygpfs" \
  npx vitest run --project server server/test/yass-valley-gpfs.test.ts
```

The focused suite covers the unit gate, exact reconciliation/zero tolerance (including the "Total"
B1-1 row, the net loss on disposal and the "Total items" OCI label), FY2024-25 acceptance and
rejection of 2025-26/2022-23 documents, natural-key/idempotency, no-cross-council totals,
discovery/latest selection (annual report, prior-year and mirror rejection), the
`403`→documented-pin WAF fallback and the plain-UA header.
