# Gunnedah Shire Council — General Purpose Financial Statements (FY2025-26)

Source id `gunnedah-gpfs` (NSW local government). One council only; entity-level rows, no council
total and no cross-council or state/federal addition.

## 0. Stale-year correction (FY2024-25 → FY2025-26)

The work-item title said FY2024-25, but the official Financial Reports page publishes both FY2024-25
and FY2025-26. The FY2025-26 standalone PDF is
`.../v/2/.../gunnedah-shire-council-financial-statements-2025-26.pdf` (year ended 30 June 2026). This
connector therefore targets **FY2025-26**. No FY2024-25 rows were ever ingested, so there were no
prior-year rows to delete. The group-D inventory and README are corrected to FY2025-26.

## 1. Source and year

- Publisher: **Gunnedah Shire Council**.
- Document: standalone audited **General Purpose Financial Statements for the year ended 30 June
  2026** — FY2025-26. The 121-page PDF carries the signed GPFS, notes and the independent auditor's
  reports.
- FY2025-26 is the **current audited year**. The connector targets `2025-26` only and never
  substitutes the prior-year (2024-25 or 2023-24) document, the narrative annual report, the SPFS or
  the special schedules. A link whose label or file name maps to any other fiscal year is rejected;
  the FY2024-25 and FY2026-27 cases are covered by focused tests.
- Official page:
  <https://www.gunnedah.nsw.gov.au/Council/The-Future-Of-Gunnedah/Financial-Reports>.
- Current exact PDF:
  <https://www.gunnedah.nsw.gov.au/files/assets/public/v/2/images/gunnedahshirecouncil/council/the-future-of-gunnedah/financial-reports/gunnedah-shire-council-financial-statements-2025-26.pdf>.
  The same URL is the documented official fallback pin, used when the listing yields no usable
  anchor; the downloaded bytes are SHA-256 verified either way.

## 2. Access, discovery and fetch

The inventory recorded an Edge/Akamai WAF returning `403 text/html` to plain curl, with the PDF
reachable in headless Chromium. In this retrieval run (2026-11-19) **both the listing page and the PDF
returned `200`** to `curl/8.5.0`, so no browser fetch was needed. The connector still sends an
explicit plain `curl/8.5.0` UA (plus a broad PDF/HTML `Accept`) and falls back to the documented
official pin if the page is challenged or yields no usable anchor; a focused test simulates a `403`
listing and asserts the pin fallback. No unofficial mirror was used.

The official page lists the financial statements from FY2011-12 onwards, including the current
FY2025-26 PDF. The parser accepts direct `.pdf` uploads whose label or file name contains "Financial
Statements" and rejects the narrative annual report, SPFS/special schedules, public notices, policies
and mirrors. The fiscal year is derived from the anchor label and file name
(`gunnedah-shire-council-financial-statements-2025-26.pdf` → FY2025-26), not from an upload-path
date.

## 3. Archive (outside the repo)

The exact downloaded bytes are archived outside the repository under the configured source-archive
root, with the relative archive path
`gunnedah-gpfs/gunnedah-shire-council-financial-statements-2025-26.pdf`:

- URL: `https://www.gunnedah.nsw.gov.au/files/assets/public/v/2/images/gunnedahshirecouncil/council/the-future-of-gunnedah/financial-reports/gunnedah-shire-council-financial-statements-2025-26.pdf`
- retrieval date: 2026-11-19
- bytes: **5,734,060**
- SHA-256: `f99d6eeaf582d25d87657ae1baf0800eb31b1d4ffe324be3150599dd330b05ad`
- content type: `application/pdf`

No PDF is committed. The fixture and this note contain only the relative archive path.

## 4. Exact reconciliation (zero tolerance)

The printed unit is explicit `$ '000` on the income statement, comprehensive-income statement and
B1-1. A missing or conflicting unit rejects the whole extraction. Nothing is emitted unless all of
these agree exactly (one thousand dollars is a failure):

| Check | Printed / derived (`$ '000`) | Result |
| --- | --- | --- |
| Total income from continuing operations (Income Statement) | 79,958 | = 7,995,800,000 cents |
| Revenue components sum (rates 25,683 + user charges 14,983 + other revenues 1,028 + operating grants 20,189 + capital grants 13,591 + interest 4,350 + other income 134) | 79,958 | = printed total |
| Expense components sum (employee 22,476 + materials 18,025 + borrowing 983 + other 706 + net loss on disposal 2,712) | 44,902 | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment 16,310 | 61,212 | = total expenses |
| B1-1 Total functions and activities — income | 79,958 | = face total revenue |
| B1-1 Total functions and activities — expenses | 61,212 | = face expense bridge |
| B1-1 Total functions and activities — operating result | 18,746 | = face net result |
| B1-1 grants and contributions | 33,780 | = operating 20,189 + capital 13,591 |
| Total revenue − total expenses | 79,958 − 61,212 = 18,746 | = printed net result |
| Net result − capital grants | 18,746 − 13,591 = 5,155 | = printed before-capital result (evidence only) |
| Comprehensive-income net result | 18,746 | = Income Statement net result |
| Other comprehensive income (revaluation 27,474) | 27,474 | = printed other comprehensive income |
| Net result + other comprehensive income | 18,746 + 27,474 = 46,220 | = printed total comprehensive income |

The Income Statement does not print a "Total expenses" line. Total expenses is therefore the
documented bridge of the printed expenses-excluding-depreciation line (44,902) plus the printed
depreciation/amortisation/impairment line (16,310) = 61,212, which equals the printed B1-1 expense
total. Gunnedah prints a real net **loss** on disposal of assets (2,712), emitted as an expense row;
there is no net gain on disposal line. The net result and the before-capital result are both
positive; the before-capital figure is retained in reconciliation evidence only. Other comprehensive
income has a single printed component (revaluation), checked against the printed OCI.

The adapter defers the document with **0 rows** and the exact gap if any printed line is missing, the
unit is not thousands, or any bridge differs. On the audited FY2025-26 report there is no deferral.

## 5. Extracted entity rows (17, non-additive)

| `gpfs_line_item` | Printed/derived label | `$ '000` | `amount_cents` | Section |
| --- | --- | ---: | ---: | --- |
| `rates_and_annual_charges` | Rates and annual charges | 25,683 | 2,568,300,000 | revenue |
| `user_charges_and_fees` | User charges and fees | 14,983 | 1,498,300,000 | revenue |
| `other_revenue` | Other revenues | 1,028 | 102,800,000 | revenue |
| `government_grants_operating` | Grants and contributions — operating | 20,189 | 2,018,900,000 | revenue |
| `government_grants_capital` | Grants and contributions — capital | 13,591 | 1,359,100,000 | revenue |
| `interest_and_investment_income` | Interest and investment income | 4,350 | 435,000,000 | revenue |
| `other_income` | Other income | 134 | 13,400,000 | revenue |
| `total_revenue` | Total income from continuing operations | 79,958 | 7,995,800,000 | revenue |
| `employee_expenses` | Employee benefits and on-costs | 22,476 | 2,247,600,000 | expenses |
| `materials_and_services` | Materials and services | 18,025 | 1,802,500,000 | expenses |
| `borrowing_costs` | Borrowing costs | 983 | 98,300,000 | expenses |
| `other_expenses` | Other expenses | 706 | 70,600,000 | expenses |
| `net_loss_from_disposal_of_assets` | Net loss from the disposal of assets | 2,712 | 271,200,000 | expenses |
| `total_expenses_excluding_depreciation` | Total expenses excluding depreciation | 44,902 | 4,490,200,000 | expenses |
| `depreciation_amortisation_impairment` | Depreciation, amortisation and impairment | 16,310 | 1,631,000,000 | expenses |
| `total_expenses` | Total expenses (documented bridge) | 61,212 | 6,121,200,000 | expenses |
| `net_result` | Net operating result attributable to Council | 18,746 | 1,874,600,000 | result |

Every row is `jurisdiction_level: "local"`, `jurisdiction: "NSW"`,
`delivery_entity: "Gunnedah Shire Council"`, `aggregation_role: "agency_detail"`,
`measure_type: "actual"`, `verified: false`, `data_quality_flag: "provisional/local_government"`.
Government grant rows carry `potential_double_count: true`.

## 6. No-total / no-cross-council rule

- Gunnedah Shire Council is one entity. No council total, no state/national total and no sum with
  another council, the `dubbo-council` budget/estimate rows, a government program, the PNFC benchmark
  or the OLG summary layer is created.
- The FY2025-26 column is the reporting boundary; the FY2024-25 comparative is not added.
- Revenue, expenses, components and the net result overlap. They are published rows, not an additive
  spending series.
- Every row is `agency_detail` with no `region_id` and no `location`/LGA allocation.

## 7. Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`)

Targeted ingest of **only `gunnedah-gpfs`** against the shared dev DB `ausspend_dev`:

- total measures **999,151 → 999,168** (exactly **+17**);
- GPFS rows (`source_id` matching `/gpfs$/`) **1633 → 1650**;
- active GPFS `data_sources` **86 → 87**;
- SOC rows (`jurisdiction_level: "soc"`) stayed at **205**; every other per-source count unchanged;
- **0** non-`agency_detail` rows, **0** rows with `region_id`/`location`, one `delivery_entity`
  (`Gunnedah Shire Council`), all rows `fiscal_year: "2025-26"` (no FY2024-25 rows), and no
  council-total/aggregate row;
- `data_sources` has the source `active` with `records_ingested: 17`;
- the latest `ingestion_logs` entry for the source is `status: "success"`,
  `records_fetched: 17`, `records_upserted: 17`.

The exact PDF is archived outside the repo at the relative path
`gunnedah-gpfs/gunnedah-shire-council-financial-statements-2025-26.pdf` with the SHA-256 above; no
PDF is committed.

## 8. How to verify

```bash
# Official page and the exact FY2025-26 PDF (200 in this retrieval run).
curl -sL -o /dev/null -w '%{http_code}\n' \
  -A 'curl/8.5.0' 'https://www.gunnedah.nsw.gov.au/Council/The-Future-Of-Gunnedah/Financial-Reports'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  -A 'curl/8.5.0' \
  'https://www.gunnedah.nsw.gov.au/files/assets/public/v/2/images/gunnedahshirecouncil/council/the-future-of-gunnedah/financial-reports/gunnedah-shire-council-financial-statements-2025-26.pdf'

# Focused connector tests (19).
TEST_MONGO_URL="mongodb://localhost:27018/ausspend_test_gunnedahgpfs" \
  npx vitest run --project server server/test/gunnedah-gpfs.test.ts
```

The focused suite covers the unit gate, exact reconciliation/zero tolerance, FY2025-26 acceptance
and rejection of 2024-25/2026-27 documents, natural-key/idempotency, no-cross-council totals,
discovery/latest selection (prior-year and mirror rejection), the `403`→documented-pin WAF fallback
and the plain-UA header.
