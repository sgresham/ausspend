# Glen Innes Severn Council — General Purpose Financial Statements (FY2024-25)

Source id `glen-innes-severn-gpfs` (NSW local government). One council only; entity-level rows, no
council total and no cross-council or state/federal addition.

## 0. Stale-year check (FY2025-26 not available)

The work-item title said FY2024-25. The official Annual Reports page was checked on 2026-11-19: the
newest audited financial statements are **FY2024-25**; **no FY2025-26 audited standalone statements
are published**. The page lists the 2024-25 annual report and older standalone FS documents
(2021-22 to 2023-24) but does not link a 2024-25 standalone FS. The exact standalone FY2024-25 PDF is
the documented official pin and downloads `200 application/pdf`. This connector therefore targets
**FY2024-25** and never substitutes a 2025-26 or 2023-24 document, the narrative annual report, the
SPFS or the special schedules.

## 1. Source and year

- Publisher: **Glen Innes Severn Council**.
- Document: standalone audited **General Purpose Financial Statements for the year ended 30 June
  2025** — FY2024-25. The 102-page PDF carries the signed GPFS, notes and the independent auditor's
  reports.
- FY2024-25 is the **latest audited year available**. The connector targets `2024-25` only and never
  substitutes the later 2025-26 or the earlier 2023-24 document, the narrative annual report, the
  SPFS or the special schedules. A link whose label or file name maps to any other fiscal year is
  rejected; the FY2025-26 and FY2023-24 cases are covered by focused tests.
- Official page:
  <https://www.gisc.nsw.gov.au/Council/Public-Documents-and-Policies/Annual-Reports>.
- Current exact PDF:
  <https://www.gisc.nsw.gov.au/files/assets/public/v/1/council/documents/public-documents-and-polices/audited-financial-statements-2024-25.pdf>.
  The same URL is the documented official fallback pin, used because the page exposes only the
  2024-25 annual report, not the standalone statements; the downloaded bytes are SHA-256 verified
  either way.

## 2. Access, discovery and fetch

The inventory recorded an Edge/Akamai WAF returning `403 text/html` to bare curl, with full browser
headers needed. In this retrieval run (2026-11-19) **both the listing page and the PDF returned
`200`** to `curl/8.5.0`, so no browser fetch was needed. The connector still sends an explicit plain
`curl/8.5.0` UA (plus a broad PDF/HTML `Accept`) and falls back to the documented official pin if the
page is challenged or yields no usable anchor; a focused test simulates a `403` listing and asserts
the pin fallback. No unofficial mirror was used.

The official page lists the annual reports and older standalone financial statements. The parser
accepts direct `.pdf` uploads whose label or file name contains "Financial Statements" and rejects
the narrative annual report, SPFS/special schedules, public notices, policies and mirrors. The fiscal
year is derived from the anchor label and file name
(`audited-financial-statements-2024-25.pdf` → FY2024-25), not from an upload-path date. Because the
page lacks a 2024-25 standalone FS anchor, discovery uses the documented official pin.

## 3. Archive (outside the repo)

The exact downloaded bytes are archived outside the repository under the configured source-archive
root, with the relative archive path
`glen-innes-severn-gpfs/audited-financial-statements-2024-25.pdf`:

- URL: `https://www.gisc.nsw.gov.au/files/assets/public/v/1/council/documents/public-documents-and-polices/audited-financial-statements-2024-25.pdf`
- retrieval date: 2026-11-19
- bytes: **3,903,779**
- SHA-256: `8ace0c0181c1f68d32f985b4fc976f7a3588b0149d69eb1dca50c21fd8dd8e05`
- content type: `application/pdf`

No PDF is committed. The fixture and this note contain only the relative archive path.

## 4. Exact reconciliation (zero tolerance)

The printed unit is explicit `$ '000` on the income statement, comprehensive-income statement and
B1-1. A missing or conflicting unit rejects the whole extraction. Nothing is emitted unless all of
these agree exactly (one thousand dollars is a failure):

| Check | Printed / derived (`$ '000`) | Result |
| --- | --- | --- |
| Total income from continuing operations (Income Statement) | 44,209 | = 4,420,900,000 cents |
| Revenue components sum (rates 13,868 + user charges 3,766 + other revenues 899 + operating grants 9,245 + capital grants 14,895 + interest 1,227 + other income 309) | 44,209 | = printed total |
| Expense components sum (employee 13,149 + materials 9,584 + borrowing 521 + other 1,248 + net loss on disposal 589) | 25,091 | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment 9,104 | 34,195 | = total expenses |
| B1-1 Total functions and activities — income | 44,209 | = face total revenue |
| B1-1 Total functions and activities — expenses | 34,195 | = face expense bridge |
| B1-1 Total functions and activities — operating result | 10,014 | = face net result |
| B1-1 grants and contributions | 24,140 | = operating 9,245 + capital 14,895 |
| Total revenue − total expenses | 44,209 − 34,195 = 10,014 | = printed net result |
| Net result − capital grants | 10,014 − 14,895 = −4,881 | = printed negative before-capital result (evidence only) |
| Comprehensive-income net result | 10,014 | = Income Statement net result |
| Other comprehensive income (revaluation 27,574) | 27,574 | = printed other comprehensive income |
| Net result + other comprehensive income | 10,014 + 27,574 = 37,588 | = printed total comprehensive income |

The Income Statement does not print a "Total expenses" line. Total expenses is therefore the
documented bridge of the printed expenses-excluding-depreciation line (25,091) plus the printed
depreciation/amortisation/impairment line (9,104) = 34,195, which equals the printed B1-1 expense
total. The council prints a real net **loss** on disposal of assets (589), emitted as an expense row;
there is no net gain on disposal line. The net result is positive while the before-capital result is
negative (−4,881); the before-capital figure is retained in reconciliation evidence only. Other
comprehensive income has a single printed component (revaluation), checked against the printed OCI.

The adapter defers the document with **0 rows** and the exact gap if any printed line is missing, the
unit is not thousands, or any bridge differs. On the audited FY2024-25 report there is no deferral.

## 5. Extracted entity rows (17, non-additive)

| `gpfs_line_item` | Printed/derived label | `$ '000` | `amount_cents` | Section |
| --- | --- | ---: | ---: | --- |
| `rates_and_annual_charges` | Rates and annual charges | 13,868 | 1,386,800,000 | revenue |
| `user_charges_and_fees` | User charges and fees | 3,766 | 376,600,000 | revenue |
| `other_revenue` | Other revenues | 899 | 89,900,000 | revenue |
| `government_grants_operating` | Grants and contributions — operating | 9,245 | 924,500,000 | revenue |
| `government_grants_capital` | Grants and contributions — capital | 14,895 | 1,489,500,000 | revenue |
| `interest_and_investment_income` | Interest and investment income | 1,227 | 122,700,000 | revenue |
| `other_income` | Other income | 309 | 30,900,000 | revenue |
| `total_revenue` | Total income from continuing operations | 44,209 | 4,420,900,000 | revenue |
| `employee_expenses` | Employee benefits and on-costs | 13,149 | 1,314,900,000 | expenses |
| `materials_and_services` | Materials and services | 9,584 | 958,400,000 | expenses |
| `borrowing_costs` | Borrowing costs | 521 | 52,100,000 | expenses |
| `other_expenses` | Other expenses | 1,248 | 124,800,000 | expenses |
| `net_loss_from_disposal_of_assets` | Net loss from the disposal of assets | 589 | 58,900,000 | expenses |
| `total_expenses_excluding_depreciation` | Total expenses excluding depreciation | 25,091 | 2,509,100,000 | expenses |
| `depreciation_amortisation_impairment` | Depreciation, amortisation and impairment | 9,104 | 910,400,000 | expenses |
| `total_expenses` | Total expenses (documented bridge) | 34,195 | 3,419,500,000 | expenses |
| `net_result` | Net operating result attributable to Council | 10,014 | 1,001,400,000 | result |

Every row is `jurisdiction_level: "local"`, `jurisdiction: "NSW"`,
`delivery_entity: "Glen Innes Severn Council"`, `aggregation_role: "agency_detail"`,
`measure_type: "actual"`, `verified: false`, `data_quality_flag: "provisional/local_government"`.
Government grant rows carry `potential_double_count: true`.

## 6. No-total / no-cross-council rule

- Glen Innes Severn Council is one entity. No council total, no state/national total and no sum with
  another council, the `dubbo-council` budget/estimate rows, a government program, the PNFC benchmark
  or the OLG summary layer is created.
- The FY2024-25 column is the reporting boundary; the FY2023-24 comparative is not added.
- Revenue, expenses, components and the net result overlap. They are published rows, not an additive
  spending series.
- Every row is `agency_detail` with no `region_id` and no `location`/LGA allocation.

## 7. Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`)

Targeted ingest of **only `glen-innes-severn-gpfs`** against the shared dev DB `ausspend_dev`:

- total measures **999,287 → 999,304** (exactly **+17**);
- GPFS rows (`source_id` matching `/gpfs$/`) **1769 → 1786**;
- active GPFS `data_sources` **94 → 95**;
- SOC rows (`jurisdiction_level: "soc"`) stayed at **205**; every other per-source count unchanged;
- **0** non-`agency_detail` rows, **0** rows with `region_id`/`location`, one `delivery_entity`
  (`Glen Innes Severn Council`), all rows `fiscal_year: "2024-25"`, and no council-total/aggregate
  row;
- `data_sources` has the source `active` with `records_ingested: 17`;
- the latest `ingestion_logs` entry for the source is `status: "success"`,
  `records_fetched: 17`, `records_upserted: 17`;
- a second targeted run left the counts unchanged and updated the `project_name`/notes to the
  FY2024-25 labels.

The exact PDF is archived outside the repo at the relative path
`glen-innes-severn-gpfs/audited-financial-statements-2024-25.pdf` with the SHA-256 above; no PDF is
committed.

## 8. How to verify

```bash
# Official page and the exact FY2024-25 PDF (200 in this retrieval run).
curl -sL -o /dev/null -w '%{http_code}\n' \
  -A 'curl/8.5.0' 'https://www.gisc.nsw.gov.au/Council/Public-Documents-and-Policies/Annual-Reports'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  -A 'curl/8.5.0' \
  'https://www.gisc.nsw.gov.au/files/assets/public/v/1/council/documents/public-documents-and-polices/audited-financial-statements-2024-25.pdf'

# Focused connector tests (20).
TEST_MONGO_URL="mongodb://localhost:27018/ausspend_test_gleninnesseverngpfs" \
  npx vitest run --project server server/test/glen-innes-severn-gpfs.test.ts
```

The focused suite covers the unit gate, exact reconciliation/zero tolerance (including the negative
before-capital result and the net loss on disposal), FY2024-25 acceptance with the documented pin
because the page lacks a 2024-25 standalone anchor, rejection of 2025-26/2023-24 documents,
natural-key/idempotency, no-cross-council totals, discovery/latest selection (annual report and
mirror rejection), the `403`→documented-pin WAF fallback and the plain-UA header.
