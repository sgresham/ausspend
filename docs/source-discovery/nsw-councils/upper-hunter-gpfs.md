# Upper Hunter Shire Council — General Purpose Financial Statements (FY2024-25)

Source id `upper-hunter-gpfs` (NSW local government). One council only; entity-level rows, no council
total and no cross-council or state/federal addition.

## 0. Stale-year check (FY2025-26 not available)

The work-item title said FY2024-25. The official Key Planning Documents page was checked on
2026-11-19: the newest audited financial statements are **FY2024-25** (signed, final); **no FY2025-26
audited standalone statements are published**. The 2026 documents listed are the Delivery
Program/Operational Plan, revenue policy and quarterly reviews, not audited statements. This
connector therefore targets **FY2024-25**, the latest obtainable audited year, and never substitutes
a 2025-26 or 2023-24 document, the narrative annual report, the SPFS or the special schedules.

## 1. Source and year

- Publisher: **Upper Hunter Shire Council**.
- Document: standalone audited **General Purpose Financial Statements for the year ended 30 June
  2025** — FY2024-25, signed. The 100-page PDF carries the signed GPFS, notes and the independent
  auditor's reports.
- FY2024-25 is the **latest obtainable audited year**. The connector targets `2024-25` only and never
  substitutes the later 2025-26 or the earlier 2023-24 document, the narrative annual report, the
  SPFS or the special schedules. A link whose label or file name maps to any other fiscal year is
  rejected; the FY2025-26 and FY2023-24 cases are covered by focused tests.
- Official page:
  <https://www.upperhunter.nsw.gov.au/Council/Documents-and-Policies/Key-Planning-Documents>.
- Current exact PDF:
  <https://www.upperhunter.nsw.gov.au/files/assets/public/v/1/council/documents-and-policies/key-planning-documents/2025/annual_financial_statements-2025-final-signed-version.pdf>.
  The same URL is the documented official fallback pin, used when the listing yields no usable
  anchor; the downloaded bytes are SHA-256 verified either way.

## 2. Access, discovery and fetch

The inventory recorded an Edge/Akamai WAF returning `403 text/html` to plain curl, with the PDF
reachable in headless Chromium. In this retrieval run (2026-11-19) **both the listing page and the PDF
returned `200`** to `curl/8.5.0`, so no browser fetch was needed. The connector still sends an
explicit plain `curl/8.5.0` UA (plus a broad PDF/HTML `Accept`) and falls back to the documented
official pin if the page is challenged or yields no usable anchor; a focused test simulates a `403`
listing and asserts the pin fallback. No unofficial mirror was used.

The official page lists the signed audited financial statements and prior annual reports, including
the FY2024-25 PDF. The parser accepts direct `.pdf` uploads whose label or file name contains
"Financial Statements" and rejects the narrative annual report, SPFS/special schedules, public
notices, policies and mirrors. The fiscal year is derived from the anchor label and file name
(`annual_financial_statements-2025-final-signed-version.pdf` → FY2024-25), not from an upload-path
date.

## 3. Archive (outside the repo)

The exact downloaded bytes are archived outside the repository under the configured source-archive
root, with the relative archive path
`upper-hunter-gpfs/annual_financial_statements-2025-final-signed-version.pdf`:

- URL: `https://www.upperhunter.nsw.gov.au/files/assets/public/v/1/council/documents-and-policies/key-planning-documents/2025/annual_financial_statements-2025-final-signed-version.pdf`
- retrieval date: 2026-11-19
- bytes: **2,884,897**
- SHA-256: `d719ecb060c5a028d32c9fbb32f8e6a064a42d295ae47bebd715fe77ee513d42`
- content type: `application/pdf`

No PDF is committed. The fixture and this note contain only the relative archive path.

## 4. Exact reconciliation (zero tolerance)

The printed unit is explicit `$ '000` on the income statement, comprehensive-income statement and
B1-1. A missing or conflicting unit rejects the whole extraction. Nothing is emitted unless all of
these agree exactly (one thousand dollars is a failure):

| Check | Printed / derived (`$ '000`) | Result |
| --- | --- | --- |
| Total income (Income Statement) | 128,984 | = 12,898,400,000 cents |
| Revenue components sum (rates 22,084 + user charges 15,233 + other revenues 598 + operating grants 15,954 + capital grants 72,892 + interest 1,645 + other income 578) | 128,984 | = printed total |
| Expense components sum (employee 18,382 + materials 27,384 + borrowing 1,019 + other 2,653 + net loss on disposal 4,221) | 53,659 | = printed "Total expenses" (excludes depreciation) |
| Printed "Total expenses" + printed depreciation/amortisation/impairment 22,377 | 76,036 | = total expenses |
| B1-1 Total functions and activities — income | 128,984 | = face total revenue |
| B1-1 Total functions and activities — expenses | 76,036 | = face expense bridge |
| B1-1 Total functions and activities — operating result | 52,948 | = face net result |
| B1-1 grants and contributions | 88,846 | = operating 15,954 + capital 72,892 |
| Total income − total expenses | 128,984 − 76,036 = 52,948 | = printed net result |
| Net result − capital grants | 52,948 − 72,892 = −19,944 | = printed negative before-capital result (evidence only) |
| Comprehensive-income net result | 52,948 | = Income Statement net result |
| Other comprehensive income (revaluation 185,104) | 185,104 | = printed other comprehensive income |
| Net result + other comprehensive income | 52,948 + 185,104 = 238,052 | = printed total comprehensive income |

Upper Hunter's Income Statement uses "Total income" and a "Total expenses" line that excludes
depreciation. Total expenses is the documented bridge of that printed line (53,659) plus the printed
depreciation/amortisation/impairment line (22,377) = 76,036, which equals the printed B1-1 "Total
functions and activities" expense total. The council prints a real net **loss** on disposal of assets
(4,221), emitted as an expense row; there is no net gain on disposal line. The net result is positive
while the before-capital result is negative (−19,944); the before-capital figure is retained in
reconciliation evidence only. Other comprehensive income has a single printed component
(revaluation), checked against the printed OCI.

The adapter defers the document with **0 rows** and the exact gap if any printed line is missing, the
unit is not thousands, or any bridge differs. On the audited FY2024-25 report there is no deferral.

## 5. Extracted entity rows (17, non-additive)

| `gpfs_line_item` | Printed/derived label | `$ '000` | `amount_cents` | Section |
| --- | --- | ---: | ---: | --- |
| `rates_and_annual_charges` | Rates and annual charges | 22,084 | 2,208,400,000 | revenue |
| `user_charges_and_fees` | User charges and fees | 15,233 | 1,523,300,000 | revenue |
| `other_revenue` | Other revenues | 598 | 59,800,000 | revenue |
| `government_grants_operating` | Grants and contributions — operating | 15,954 | 1,595,400,000 | revenue |
| `government_grants_capital` | Grants and contributions — capital | 72,892 | 7,289,200,000 | revenue |
| `interest_and_investment_income` | Interest and investment income | 1,645 | 164,500,000 | revenue |
| `other_income` | Other income | 578 | 57,800,000 | revenue |
| `total_revenue` | Total income | 128,984 | 12,898,400,000 | revenue |
| `employee_expenses` | Employee benefits and on-costs | 18,382 | 1,838,200,000 | expenses |
| `materials_and_services` | Materials and services | 27,384 | 2,738,400,000 | expenses |
| `borrowing_costs` | Borrowing costs | 1,019 | 101,900,000 | expenses |
| `other_expenses` | Other expenses | 2,653 | 265,300,000 | expenses |
| `net_loss_from_disposal_of_assets` | Net loss from the disposal of assets | 4,221 | 422,100,000 | expenses |
| `total_expenses_excluding_depreciation` | Total expenses (excludes depreciation) | 53,659 | 5,365,900,000 | expenses |
| `depreciation_amortisation_impairment` | Depreciation, amortisation and impairment | 22,377 | 2,237,700,000 | expenses |
| `total_expenses` | Total expenses (documented bridge) | 76,036 | 7,603,600,000 | expenses |
| `net_result` | Net operating result attributable to Council | 52,948 | 5,294,800,000 | result |

Every row is `jurisdiction_level: "local"`, `jurisdiction: "NSW"`,
`delivery_entity: "Upper Hunter Shire Council"`, `aggregation_role: "agency_detail"`,
`measure_type: "actual"`, `verified: false`, `data_quality_flag: "provisional/local_government"`.
Government grant rows carry `potential_double_count: true`.

## 6. No-total / no-cross-council rule

- Upper Hunter Shire Council is one entity. No council total, no state/national total and no sum with
  another council, the `dubbo-council` budget/estimate rows, a government program, the PNFC benchmark
  or the OLG summary layer is created.
- The FY2024-25 column is the reporting boundary; the FY2023-24 comparative is not added.
- Revenue, expenses, components and the net result overlap. They are published rows, not an additive
  spending series.
- Every row is `agency_detail` with no `region_id` and no `location`/LGA allocation.

## 7. Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`)

Targeted ingest of **only `upper-hunter-gpfs`** against the shared dev DB `ausspend_dev`:

- total measures **999,253 → 999,270** (exactly **+17**);
- GPFS rows (`source_id` matching `/gpfs$/`) **1735 → 1752**;
- active GPFS `data_sources` **92 → 93**;
- SOC rows (`jurisdiction_level: "soc"`) stayed at **205**; every other per-source count unchanged;
- **0** non-`agency_detail` rows, **0** rows with `region_id`/`location`, one `delivery_entity`
  (`Upper Hunter Shire Council`), all rows `fiscal_year: "2024-25"`, and no council-total/aggregate
  row;
- `data_sources` has the source `active` with `records_ingested: 17`;
- the latest `ingestion_logs` entry for the source is `status: "success"`,
  `records_fetched: 17`, `records_upserted: 17`.

The exact PDF is archived outside the repo at the relative path
`upper-hunter-gpfs/annual_financial_statements-2025-final-signed-version.pdf` with the SHA-256 above;
no PDF is committed.

## 8. How to verify

```bash
# Official page and the exact FY2024-25 PDF (200 in this retrieval run).
curl -sL -o /dev/null -w '%{http_code}\n' \
  -A 'curl/8.5.0' 'https://www.upperhunter.nsw.gov.au/Council/Documents-and-Policies/Key-Planning-Documents'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  -A 'curl/8.5.0' \
  'https://www.upperhunter.nsw.gov.au/files/assets/public/v/1/council/documents-and-policies/key-planning-documents/2025/annual_financial_statements-2025-final-signed-version.pdf'

# Focused connector tests (19).
TEST_MONGO_URL="mongodb://localhost:27018/ausspend_test_upperhuntergpfs" \
  npx vitest run --project server server/test/upper-hunter-gpfs.test.ts
```

The focused suite covers the unit gate, exact reconciliation/zero tolerance (including the negative
before-capital result and the net loss on disposal), FY2024-25 acceptance and rejection of
2025-26/2023-24 documents, natural-key/idempotency, no-cross-council totals, discovery/latest
selection (annual report, prior-year and mirror rejection), the `403`→documented-pin WAF fallback and
the plain-UA header.
