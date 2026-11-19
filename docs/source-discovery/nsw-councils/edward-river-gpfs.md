# Edward River Council — General Purpose Financial Statements (FY2024-25)

Source id `edward-river-gpfs` (NSW local government). One council only; entity-level rows, no council
total and no cross-council or state/federal addition.

## 0. Stale-year check (FY2025-26 not available)

The work-item title said FY2024-25. The official Council Publications/Reports page was checked on
2026-11-19: the newest audited statements are **FY2024-25**; **no FY2025-26 audited statements are
published**. Edward River does not publish a separate standalone FS PDF: the audited General Purpose
Financial Statements are the financial-statements section of the official combined annual report +
financial statements PDF. This connector therefore targets **FY2024-25** and never substitutes a
2025-26/2023-24 document or the narrative-only annual report.

## 1. Source and year

- Publisher: **Edward River Council**.
- Document: audited **General Purpose Financial Statements for the year ended 30 June 2025** —
  FY2024-25 — inside the official combined annual report + financial statements PDF. The 104-page PDF
  carries the signed GPFS, notes and the independent auditor's reports.
- FY2024-25 is the **latest audited year available**. The connector targets `2024-25` only and never
  substitutes the later 2025-26 or the earlier 2023-24 document, the narrative-only annual report,
  the SPFS or the special schedules. A link whose label or file name maps to any other fiscal year
  is rejected; the FY2025-26 and FY2023-24 cases are covered by focused tests.
- Official page:
  <https://www.edwardriver.nsw.gov.au/Council/Council-Publications/Reports>.
- Current exact PDF:
  <https://www.edwardriver.nsw.gov.au/files/assets/public/v/1/1.-documents/publications/reports/annual-report/ar-2024-25/edward-river-council-annual-report-financial-statements-2024-25-rgb-web.pdf>.
  The same URL is the documented official fallback pin, used when the listing yields no usable
  anchor; the downloaded bytes are SHA-256 verified either way.

## 2. Access, discovery and fetch

The inventory recorded an Edge/Akamai WAF returning `403 text/html` to bare curl, with full browser
headers required. In this retrieval run (2026-11-19) **both the listing page and the PDF returned
`200`** to `curl/8.5.0`, so no browser fetch was needed. The connector still sends an explicit plain
`curl/8.5.0` UA (plus a broad PDF/HTML `Accept`) and falls back to the documented official pin if the
page is challenged or yields no usable anchor; a focused test simulates a `403` listing and asserts
the pin fallback. No unofficial mirror was used.

The official page lists the combined annual report + financial statements PDF and a narrative-only
annual report. The parser accepts direct `.pdf` uploads whose label or file name contains "Financial
Statements" and rejects the narrative-only annual report, SPFS/special schedules, public notices,
policies and mirrors. The fiscal year is derived from the anchor label and file name
(`edward-river-council-annual-report-financial-statements-2024-25-rgb-web.pdf` → FY2024-25), not from
an upload-path date.

## 3. Archive (outside the repo)

The exact downloaded bytes are archived outside the repository under the configured source-archive
root, with the relative archive path
`edward-river-gpfs/edward-river-council-annual-report-financial-statements-2024-25-rgb-web.pdf`:

- URL: `https://www.edwardriver.nsw.gov.au/files/assets/public/v/1/1.-documents/publications/reports/annual-report/ar-2024-25/edward-river-council-annual-report-financial-statements-2024-25-rgb-web.pdf`
- retrieval date: 2026-11-19
- bytes: **2,142,775**
- SHA-256: `7d042fcf707b05ee9989df748e9257afe6eba6c7df2b39e3c2e3232ab3554bcf`
- content type: `application/pdf`

No PDF is committed. The fixture and this note contain only the relative archive path.

## 4. Exact reconciliation (zero tolerance)

The printed unit is explicit `$ '000` on the income statement, comprehensive-income statement and
B1-1. A missing or conflicting unit rejects the whole extraction. Nothing is emitted unless all of
these agree exactly (one thousand dollars is a failure):

| Check | Printed / derived (`$ '000`) | Result |
| --- | --- | --- |
| Total income from continuing operations (Income Statement) | 38,502 | = 3,850,200,000 cents |
| Revenue components sum (rates 15,970 + user charges 5,218 + other revenues 726 + operating grants 11,225 + capital grants 3,196 + interest 1,996 + net gain on disposal 171) | 38,502 | = printed total |
| Expense components sum (employee 12,853 + materials 13,115 + other 688; no borrowing-cost line) | 26,656 | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment 10,953 | 37,609 | = total expenses |
| B1-1 Total functions and activities — income | 38,502 | = face total revenue |
| B1-1 Total functions and activities — expenses | 37,609 | = face expense bridge |
| B1-1 Total functions and activities — operating result | 893 | = face net result |
| B1-1 grants and contributions | 14,421 | = operating 11,225 + capital 3,196 |
| Total revenue − total expenses | 38,502 − 37,609 = 893 | = printed net result |
| Net result − capital grants | 893 − 3,196 = −2,303 | = printed negative before-capital result (evidence only) |
| Comprehensive-income net result | 893 | = Income Statement net result |
| Other comprehensive income (revaluation 14,777; 2025 impairment nil) | 14,777 | = sum of printed OCI components |
| Net result + other comprehensive income | 893 + 14,777 = 15,670 | = printed total comprehensive income |

The Income Statement does not print a "Total expenses" line. Total expenses is therefore the
documented bridge of the printed expenses-excluding-depreciation line (26,656) plus the printed
depreciation/amortisation/impairment line (10,953) = 37,609, which equals the printed B1-1 expense
total. The council prints a real net **gain** on disposal of assets (171), emitted as a revenue row;
the 2025 net loss on disposal is nil, and there is no borrowing-cost line. The net result is positive
while the before-capital result is negative (−2,303); the before-capital figure is retained in
reconciliation evidence only. Other comprehensive income has a single non-nil printed component
(revaluation). The council does not print an OCI subtotal, so the OCI total is the sum of the printed
components and is reconciled to the printed total comprehensive income.

The adapter defers the document with **0 rows** and the exact gap if any printed line is missing, the
unit is not thousands, or any bridge differs. On the audited FY2024-25 report there is no deferral.

## 5. Extracted entity rows (15, non-additive)

| `gpfs_line_item` | Printed/derived label | `$ '000` | `amount_cents` | Section |
| --- | --- | ---: | ---: | --- |
| `rates_and_annual_charges` | Rates and annual charges | 15,970 | 1,597,000,000 | revenue |
| `user_charges_and_fees` | User charges and fees | 5,218 | 521,800,000 | revenue |
| `other_revenue` | Other revenues | 726 | 72,600,000 | revenue |
| `government_grants_operating` | Grants and contributions — operating | 11,225 | 1,122,500,000 | revenue |
| `government_grants_capital` | Grants and contributions — capital | 3,196 | 319,600,000 | revenue |
| `interest_and_investment_income` | Interest and investment income | 1,996 | 199,600,000 | revenue |
| `net_gain_from_disposal_of_assets` | Net gain from the disposal of assets | 171 | 17,100,000 | revenue |
| `total_revenue` | Total income from continuing operations | 38,502 | 3,850,200,000 | revenue |
| `employee_expenses` | Employee benefits and on-costs | 12,853 | 1,285,300,000 | expenses |
| `materials_and_services` | Materials and services | 13,115 | 1,311,500,000 | expenses |
| `other_expenses` | Other expenses | 688 | 68,800,000 | expenses |
| `total_expenses_excluding_depreciation` | Total expenses excluding depreciation | 26,656 | 2,665,600,000 | expenses |
| `depreciation_amortisation_impairment` | Depreciation, amortisation and impairment | 10,953 | 1,095,300,000 | expenses |
| `total_expenses` | Total expenses (documented bridge) | 37,609 | 3,760,900,000 | expenses |
| `net_result` | Net operating result attributable to Council | 893 | 89,300,000 | result |

Every row is `jurisdiction_level: "local"`, `jurisdiction: "NSW"`,
`delivery_entity: "Edward River Council"`, `aggregation_role: "agency_detail"`,
`measure_type: "actual"`, `verified: false`, `data_quality_flag: "provisional/local_government"`.
Government grant rows carry `potential_double_count: true`.

## 6. No-total / no-cross-council rule

- Edward River Council is one entity. No council total, no state/national total and no sum with
  another council, the `dubbo-council` budget/estimate rows, a government program, the PNFC benchmark
  or the OLG summary layer is created.
- The FY2024-25 column is the reporting boundary; the FY2023-24 comparative is not added.
- Revenue, expenses, components and the net result overlap. They are published rows, not an additive
  spending series.
- Every row is `agency_detail` with no `region_id` and no `location`/LGA allocation.

## 7. Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`)

Targeted ingest of **only `edward-river-gpfs`** against the shared dev DB `ausspend_dev`:

- total measures **999,304 → 999,319** (exactly **+15**);
- GPFS rows (`source_id` matching `/gpfs$/`) **1786 → 1801**;
- active GPFS `data_sources` **95 → 96**;
- SOC rows (`jurisdiction_level: "soc"`) stayed at **205**; every other per-source count unchanged;
- **0** non-`agency_detail` rows, **0** rows with `region_id`/`location`, one `delivery_entity`
  (`Edward River Council`), all rows `fiscal_year: "2024-25"`, and no council-total/aggregate row;
- `data_sources` has the source `active` with `records_ingested: 15`;
- the latest `ingestion_logs` entry for the source is `status: "success"`,
  `records_fetched: 15`, `records_upserted: 15`.

The exact PDF is archived outside the repo at the relative path
`edward-river-gpfs/edward-river-council-annual-report-financial-statements-2024-25-rgb-web.pdf` with
the SHA-256 above; no PDF is committed.

## 8. How to verify

```bash
# Official page and the exact FY2024-25 combined AR+FS PDF (200 in this run).
curl -sL -o /dev/null -w '%{http_code}\n' \
  -A 'curl/8.5.0' 'https://www.edwardriver.nsw.gov.au/Council/Council-Publications/Reports'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  -A 'curl/8.5.0' \
  'https://www.edwardriver.nsw.gov.au/files/assets/public/v/1/1.-documents/publications/reports/annual-report/ar-2024-25/edward-river-council-annual-report-financial-statements-2024-25-rgb-web.pdf'

# Focused connector tests (19).
TEST_MONGO_URL="mongodb://localhost:27018/ausspend_test_edwardrivergpfs" \
  npx vitest run --project server server/test/edward-river-gpfs.test.ts
```

The focused suite covers the unit gate, exact reconciliation/zero tolerance (including the negative
before-capital result, the net gain on disposal, the absent borrowing/net-loss lines and the derived
OCI total), FY2024-25 acceptance and rejection of 2025-26/2023-24 documents, natural-key/idempotency,
no-cross-council totals, discovery/latest selection (narrative-only annual report, prior-year and
mirror rejection), the `403`→documented-pin WAF fallback and the plain-UA header.
