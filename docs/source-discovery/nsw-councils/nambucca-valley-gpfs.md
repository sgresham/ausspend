# Nambucca Valley Council — General Purpose Financial Statements (FY2024-25)

Source id `nambucca-valley-gpfs` (NSW local government). One council only; entity-level rows, no
council total and no cross-council or state/federal addition.

## 0. Stale-year check / access gap (FY2025-26 not obtainable)

The work-item title said FY2024-25. The official Financial Reports page advertises a **FY2025-26**
PDF at
`.../documents-on-exhibition/annual-financial-statements/nambucca-valley-council-annual-financial-statements-2025-2026.pdf`,
but that file URL returned **HTTP 404** (text/html) at retrieval time on 2026-11-19, so FY2025-26 is
not obtainable. Retries on the same and neighbouring paths (`v/2`, `2025-26`, financial-reports/2025)
also returned 404. The connector therefore ingests the latest **obtainable** audited year,
**FY2024-25**, and records the FY2025-26 dead link as an access gap rather than forcing a substitute.
No FY2025-26 rows were ingested, and the group-D inventory/README record the 404.

## 1. Source and year

- Publisher: **Nambucca Valley Council**.
- Document: standalone audited **General Purpose Financial Statements for the year ended 30 June
  2025** — FY2024-25. The 102-page PDF carries the signed GPFS, notes and the independent auditor's
  reports.
- FY2024-25 is the **latest obtainable audited year**. The connector targets `2024-25` only and never
  substitutes the advertised-but-dead 2025-26 or the earlier 2023-24 document, the narrative annual
  report, the SPFS or the special schedules. A link whose label or file name maps to any other fiscal
  year is rejected; the 2025-26 and 2023-24 cases are covered by focused tests.
- Official page:
  <https://www.nambucca.nsw.gov.au/Council/Compliance-Forms-Policies-Reporting/Financial-Reports>.
- Current exact PDF:
  <https://www.nambucca.nsw.gov.au/files/assets/public/v/1/council/news-and-community-feedback/documents-on-exhibition/annual-financial-statements/audited-annual-financial-statements-2024-2025.pdf>.
  The same URL is the documented official fallback pin, used when the listing yields no usable
  anchor; the downloaded bytes are SHA-256 verified either way.

## 2. Access, discovery and fetch

The inventory recorded an Edge/Akamai WAF returning `403 text/html` to plain curl, with the PDF
reachable in headless Chromium. In this retrieval run (2026-11-19) **both the listing page and the
FY2024-25 PDF returned `200`** to `curl/8.5.0`, so no browser fetch was needed. The connector still
sends an explicit plain `curl/8.5.0` UA (plus a broad PDF/HTML `Accept`) and falls back to the
documented official pin if the page is challenged or yields no usable anchor; a focused test simulates
a `403` listing and asserts the pin fallback.

The official page lists the audited financial statements from prior years, including the FY2024-25
PDF and the advertised (but 404) FY2025-26 PDF. The parser accepts direct `.pdf` uploads whose label
or file name contains "Financial Statements" and rejects the narrative annual report, SPFS/special
schedules, public notices, policies and mirrors. The fiscal year is derived from the anchor label and
file name (`audited-annual-financial-statements-2024-2025.pdf` → FY2024-25), not from an upload-path
date. Because the target is FY2024-25, the advertised FY2025-26 link is parsed but not selected.

## 3. Archive (outside the repo)

The exact downloaded bytes are archived outside the repository under the configured source-archive
root, with the relative archive path
`nambucca-valley-gpfs/audited-annual-financial-statements-2024-2025.pdf`:

- URL: `https://www.nambucca.nsw.gov.au/files/assets/public/v/1/council/news-and-community-feedback/documents-on-exhibition/annual-financial-statements/audited-annual-financial-statements-2024-2025.pdf`
- retrieval date: 2026-11-19
- bytes: **1,734,745**
- SHA-256: `06fdca66b04bd756d157345a480ee398ffef42b663b54d1c78bc8424114cedee`
- content type: `application/pdf`

No PDF is committed. The fixture and this note contain only the relative archive path.

## 4. Exact reconciliation (zero tolerance)

The printed unit is explicit `$ '000` on the income statement, comprehensive-income statement and
B1-1. A missing or conflicting unit rejects the whole extraction. Nothing is emitted unless all of
these agree exactly (one thousand dollars is a failure):

| Check | Printed / derived (`$ '000`) | Result |
| --- | --- | --- |
| Total income from continuing operations (Income Statement) | 74,963 | = 7,496,300,000 cents |
| Revenue components sum (rates 26,248 + user charges 9,909 + other revenues 1,213 + operating grants 10,446 + capital grants 21,574 + interest 5,180 + other income 393) | 74,963 | = printed total |
| Expense components sum (employee 15,747 + materials 23,194 + borrowing 2,137 + other 2,234 + net loss on disposal 2,829) | 46,141 | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment 13,694 | 59,835 | = total expenses |
| B1-1 Total functions and activities — income | 74,963 | = face total revenue |
| B1-1 Total functions and activities — expenses | 59,835 | = face expense bridge |
| B1-1 Total functions and activities — operating result | 15,128 | = face net result |
| B1-1 grants and contributions | 32,020 | = operating 10,446 + capital 21,574 |
| Total revenue − total expenses | 74,963 − 59,835 = 15,128 | = printed net result |
| Net result − capital grants | 15,128 − 21,574 = −6,446 | = printed negative before-capital result (evidence only) |
| Comprehensive-income net result | 15,128 | = Income Statement net result |
| Other comprehensive income (revaluation 26,449 + impairment/revaluation decrement −214) | 26,235 | = printed other comprehensive income |
| Net result + other comprehensive income | 15,128 + 26,235 = 41,363 | = printed total comprehensive income |

The Income Statement does not print a "Total expenses" line. Total expenses is therefore the
documented bridge of the printed expenses-excluding-depreciation line (46,141) plus the printed
depreciation/amortisation/impairment line (13,694) = 59,835, which equals the printed B1-1 expense
total. Nambucca prints a real net **loss** on disposal of assets (2,829), emitted as an expense row;
there is no net gain on disposal line. The net result is positive while the before-capital result is
negative (−6,446); the before-capital figure is retained in reconciliation evidence only. Other
comprehensive income has two printed components (revaluation and impairment/revaluation decrement),
whose sum is checked against the printed OCI.

The adapter defers the document with **0 rows** and the exact gap if any printed line is missing, the
unit is not thousands, or any bridge differs. On the audited FY2024-25 report there is no deferral.

## 5. Extracted entity rows (17, non-additive)

| `gpfs_line_item` | Printed/derived label | `$ '000` | `amount_cents` | Section |
| --- | --- | ---: | ---: | --- |
| `rates_and_annual_charges` | Rates and annual charges | 26,248 | 2,624,800,000 | revenue |
| `user_charges_and_fees` | User charges and fees | 9,909 | 990,900,000 | revenue |
| `other_revenue` | Other revenues | 1,213 | 121,300,000 | revenue |
| `government_grants_operating` | Grants and contributions — operating | 10,446 | 1,044,600,000 | revenue |
| `government_grants_capital` | Grants and contributions — capital | 21,574 | 2,157,400,000 | revenue |
| `interest_and_investment_income` | Interest and investment income | 5,180 | 518,000,000 | revenue |
| `other_income` | Other income | 393 | 39,300,000 | revenue |
| `total_revenue` | Total income from continuing operations | 74,963 | 7,496,300,000 | revenue |
| `employee_expenses` | Employee benefits and on-costs | 15,747 | 1,574,700,000 | expenses |
| `materials_and_services` | Materials and services | 23,194 | 2,319,400,000 | expenses |
| `borrowing_costs` | Borrowing costs | 2,137 | 213,700,000 | expenses |
| `other_expenses` | Other expenses | 2,234 | 223,400,000 | expenses |
| `net_loss_from_disposal_of_assets` | Net loss from the disposal of assets | 2,829 | 282,900,000 | expenses |
| `total_expenses_excluding_depreciation` | Total expenses excluding depreciation | 46,141 | 4,614,100,000 | expenses |
| `depreciation_amortisation_impairment` | Depreciation, amortisation and impairment | 13,694 | 1,369,400,000 | expenses |
| `total_expenses` | Total expenses (documented bridge) | 59,835 | 5,983,500,000 | expenses |
| `net_result` | Net operating result attributable to Council | 15,128 | 1,512,800,000 | result |

Every row is `jurisdiction_level: "local"`, `jurisdiction: "NSW"`,
`delivery_entity: "Nambucca Valley Council"`, `aggregation_role: "agency_detail"`,
`measure_type: "actual"`, `verified: false`, `data_quality_flag: "provisional/local_government"`.
Government grant rows carry `potential_double_count: true`.

## 6. No-total / no-cross-council rule

- Nambucca Valley Council is one entity. No council total, no state/national total and no sum with
  another council, the `dubbo-council` budget/estimate rows, a government program, the PNFC benchmark
  or the OLG summary layer is created.
- The FY2024-25 column is the reporting boundary; the FY2023-24 comparative is not added.
- Revenue, expenses, components and the net result overlap. They are published rows, not an additive
  spending series.
- Every row is `agency_detail` with no `region_id` and no `location`/LGA allocation.

## 7. Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`)

Targeted ingest of **only `nambucca-valley-gpfs`** against the shared dev DB `ausspend_dev`:

- total measures **999,219 → 999,236** (exactly **+17**);
- GPFS rows (`source_id` matching `/gpfs$/`) **1701 → 1718**;
- active GPFS `data_sources` **90 → 91**;
- SOC rows (`jurisdiction_level: "soc"`) stayed at **205**; every other per-source count unchanged;
- **0** non-`agency_detail` rows, **0** rows with `region_id`/`location`, one `delivery_entity`
  (`Nambucca Valley Council`), all rows `fiscal_year: "2024-25"` (no FY2025-26 rows), and no
  council-total/aggregate row;
- `data_sources` has the source `active` with `records_ingested: 17`;
- the latest `ingestion_logs` entry for the source is `status: "success"`,
  `records_fetched: 17`, `records_upserted: 17`.

The exact PDF is archived outside the repo at the relative path
`nambucca-valley-gpfs/audited-annual-financial-statements-2024-2025.pdf` with the SHA-256 above; no
PDF is committed.

## 8. How to verify

```bash
# Official page and the exact FY2024-25 PDF (200 in this retrieval run).
curl -sL -o /dev/null -w '%{http_code}\n' \
  -A 'curl/8.5.0' 'https://www.nambucca.nsw.gov.au/Council/Compliance-Forms-Policies-Reporting/Financial-Reports'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  -A 'curl/8.5.0' \
  'https://www.nambucca.nsw.gov.au/files/assets/public/v/1/council/news-and-community-feedback/documents-on-exhibition/annual-financial-statements/audited-annual-financial-statements-2024-2025.pdf'
# The advertised FY2025-26 link returns 404 (access gap, recorded).
curl -sL -o /dev/null -w '%{http_code}\n' \
  -A 'curl/8.5.0' \
  'https://www.nambucca.nsw.gov.au/files/assets/public/v/1/council/news-and-community-feedback/documents-on-exhibition/annual-financial-statements/nambucca-valley-council-annual-financial-statements-2025-2026.pdf'

# Focused connector tests (18).
TEST_MONGO_URL="mongodb://localhost:27018/ausspend_test_nambuccavalleygpfs" \
  npx vitest run --project server server/test/nambucca-valley-gpfs.test.ts
```

The focused suite covers the unit gate, exact reconciliation/zero tolerance (including the two OCI
components and the net loss on disposal), FY2024-25 acceptance with the advertised FY2025-26 link not
selected and FY2023-24 rejected, natural-key/idempotency, no-cross-council totals, discovery/latest
selection (prior-year and mirror rejection), the `403`→documented-pin WAF fallback and the plain-UA
header.
