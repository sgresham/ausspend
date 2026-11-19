# Temora Shire Council — General Purpose Financial Statements (FY2024-25)

Source id `temora-gpfs` (NSW local government). One council only; entity-level rows, no council total
and no cross-council or state/federal addition.

## 0. Stale-year check (FY2025-26 not available)

The work-item title said FY2024-25. The official Plans and Reports page was checked on 2026-11-19:
the newest audited financial statements are **FY2024-25**; **no FY2025-26 audited standalone
statements are published**. The 2025-26/2026-27 documents listed are quarterly budget reviews and
planning documents, not audited statements. This connector therefore targets **FY2024-25** and never
substitutes a 2025-26/2023-24 document, the narrative annual report, the SPFS or the special
schedules.

## 1. Source and year

- Publisher: **Temora Shire Council**.
- Document: standalone audited **General Purpose Financial Statements for the year ended 30 June
  2025** — FY2024-25. The 110-page PDF carries the signed GPFS, notes and the independent auditor's
  reports.
- FY2024-25 is the **latest obtainable audited year**. The connector targets `2024-25` only and never
  substitutes the later 2025-26 or the earlier 2023-24 document, the narrative annual report, the
  SPFS or the special schedules. A link whose label or file name maps to any other fiscal year is
  rejected; the FY2025-26 and FY2023-24 cases are covered by focused tests.
- Official page:
  <https://www.temora.nsw.gov.au/Your-Council/Planning-and-Reporting/Plans-and-Reports>.
- Current exact PDF:
  <https://www.temora.nsw.gov.au/files/assets/public/v/1/on-exhibition/2025/financial-statements/temora-shire-council-financial-statements-2024-25.pdf>.
  The same URL is the documented official fallback pin, used when the listing yields no usable
  anchor; the downloaded bytes are SHA-256 verified either way.

## 2. Access, discovery and fetch

The inventory recorded an Edge/Akamai WAF returning `403 text/html` to bare curl, with full browser
headers required. In this retrieval run (2026-11-19) **both the listing page and the PDF returned
`200`** to `curl/8.5.0`, so no browser fetch was needed. The connector still sends an explicit plain
`curl/8.5.0` UA (plus a broad PDF/HTML `Accept`) and falls back to the documented official pin if the
page is challenged or yields no usable anchor; a focused test simulates a `403` listing and asserts
the pin fallback. No unofficial mirror was used.

The official page lists the audited financial statements from prior years, including the FY2024-25
PDF. The parser accepts direct `.pdf` uploads whose label or file name contains "Financial
Statements" and rejects the narrative annual report, SPFS/special schedules, public notices, policies
and mirrors. The fiscal year is derived from the anchor label and file name
(`temora-shire-council-financial-statements-2024-25.pdf` → FY2024-25), not from an upload-path date.

## 3. Archive (outside the repo)

The exact downloaded bytes are archived outside the repository under the configured source-archive
root, with the relative archive path
`temora-gpfs/temora-shire-council-financial-statements-2024-25.pdf`:

- URL: `https://www.temora.nsw.gov.au/files/assets/public/v/1/on-exhibition/2025/financial-statements/temora-shire-council-financial-statements-2024-25.pdf`
- retrieval date: 2026-11-19
- bytes: **2,464,389**
- SHA-256: `d24693e9f83ed992a93be059587caac6d1e359b4018404464d515dacfa31fb56`
- content type: `application/pdf`

No PDF is committed. The fixture and this note contain only the relative archive path.

## 4. Exact reconciliation (zero tolerance)

The printed unit is explicit `$ '000` on the income statement, comprehensive-income statement and
B1-1. A missing or conflicting unit rejects the whole extraction. Nothing is emitted unless all of
these agree exactly (one thousand dollars is a failure):

| Check | Printed / derived (`$ '000`) | Result |
| --- | --- | --- |
| Total income from continuing operations (Income Statement) | 40,708 | = 4,070,800,000 cents |
| Revenue components sum (rates 7,064 + user charges 14,162 + other revenues 759 + operating grants 6,813 + capital grants 10,403 + interest 1,163 + other income 344; 2025 net gain on disposal nil) | 40,708 | = printed total |
| Expense components sum (employee 10,444 + materials 13,922 + borrowing 56 + other 752 + net loss on disposal 52) | 25,226 | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment 8,628 | 33,854 | = total expenses |
| B1-1 Total functions and activities — income | 40,708 | = face total revenue |
| B1-1 Total functions and activities — expenses | 33,854 | = face expense bridge |
| B1-1 Total functions and activities — operating result | 6,854 | = face net result |
| B1-1 grants and contributions | 17,216 | = operating 6,813 + capital 10,403 |
| Total revenue − total expenses | 40,708 − 33,854 = 6,854 | = printed net result |
| Net result − capital grants | 6,854 − 10,403 = −3,549 | = printed negative before-capital result (evidence only) |
| Comprehensive-income net result | 6,854 | = Income Statement net result |
| Other comprehensive income (revaluation 39,459 + impairment/revaluation reversal 1,960 + joint ventures/associates 44) | 41,463 | = printed other comprehensive income |
| Net result + other comprehensive income | 6,854 + 41,463 = 48,317 | = printed total comprehensive income |

The Income Statement does not print a "Total expenses" line. Total expenses is therefore the
documented bridge of the printed expenses-excluding-depreciation line (25,226) plus the printed
depreciation/amortisation/impairment line (8,628) = 33,854, which equals the printed B1-1 expense
total. The council prints a real net **loss** on disposal of assets (52), emitted as an expense row;
the 2025 net gain on disposal is nil and is not emitted. The net result is positive while the
before-capital result is negative (−3,549); the before-capital figure is retained in reconciliation
evidence only. Other comprehensive income has three printed components (revaluation, impairment/
revaluation reversal and joint ventures/associates), whose sum is checked against the printed OCI.

The adapter defers the document with **0 rows** and the exact gap if any printed line is missing, the
unit is not thousands, or any bridge differs. On the audited FY2024-25 report there is no deferral.

## 5. Extracted entity rows (17, non-additive)

| `gpfs_line_item` | Printed/derived label | `$ '000` | `amount_cents` | Section |
| --- | --- | ---: | ---: | --- |
| `rates_and_annual_charges` | Rates and annual charges | 7,064 | 706,400,000 | revenue |
| `user_charges_and_fees` | User charges and fees | 14,162 | 1,416,200,000 | revenue |
| `other_revenue` | Other revenues | 759 | 75,900,000 | revenue |
| `government_grants_operating` | Grants and contributions — operating | 6,813 | 681,300,000 | revenue |
| `government_grants_capital` | Grants and contributions — capital | 10,403 | 1,040,300,000 | revenue |
| `interest_and_investment_income` | Interest and investment income | 1,163 | 116,300,000 | revenue |
| `other_income` | Other income | 344 | 34,400,000 | revenue |
| `total_revenue` | Total income from continuing operations | 40,708 | 4,070,800,000 | revenue |
| `employee_expenses` | Employee benefits and on-costs | 10,444 | 1,044,400,000 | expenses |
| `materials_and_services` | Materials and services | 13,922 | 1,392,200,000 | expenses |
| `borrowing_costs` | Borrowing costs | 56 | 5,600,000 | expenses |
| `other_expenses` | Other expenses | 752 | 75,200,000 | expenses |
| `net_loss_from_disposal_of_assets` | Net loss from the disposal of assets | 52 | 5,200,000 | expenses |
| `total_expenses_excluding_depreciation` | Total expenses excluding depreciation | 25,226 | 2,522,600,000 | expenses |
| `depreciation_amortisation_impairment` | Depreciation, amortisation and impairment | 8,628 | 862,800,000 | expenses |
| `total_expenses` | Total expenses (documented bridge) | 33,854 | 3,385,400,000 | expenses |
| `net_result` | Net operating result attributable to Council | 6,854 | 685,400,000 | result |

Every row is `jurisdiction_level: "local"`, `jurisdiction: "NSW"`,
`delivery_entity: "Temora Shire Council"`, `aggregation_role: "agency_detail"`,
`measure_type: "actual"`, `verified: false`, `data_quality_flag: "provisional/local_government"`.
Government grant rows carry `potential_double_count: true`.

## 6. No-total / no-cross-council rule

- Temora Shire Council is one entity. No council total, no state/national total and no sum with
  another council, the `dubbo-council` budget/estimate rows, a government program, the PNFC benchmark
  or the OLG summary layer is created.
- The FY2024-25 column is the reporting boundary; the FY2023-24 comparative is not added.
- Revenue, expenses, components and the net result overlap. They are published rows, not an additive
  spending series.
- Every row is `agency_detail` with no `region_id` and no `location`/LGA allocation.

## 7. Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`)

Targeted ingest of **only `temora-gpfs`** against the shared dev DB `ausspend_dev`:

- total measures **999,319 → 999,336** (exactly **+17**);
- GPFS rows (`source_id` matching `/gpfs$/`) **1801 → 1818**;
- active GPFS `data_sources` **96 → 97**;
- SOC rows (`jurisdiction_level: "soc"`) stayed at **205**; every other per-source count unchanged;
- **0** non-`agency_detail` rows, **0** rows with `region_id`/`location`, one `delivery_entity`
  (`Temora Shire Council`), all rows `fiscal_year: "2024-25"`, and no council-total/aggregate row;
- `data_sources` has the source `active` with `records_ingested: 17`;
- the latest `ingestion_logs` entry for the source is `status: "success"`,
  `records_fetched: 17`, `records_upserted: 17`.

The exact PDF is archived outside the repo at the relative path
`temora-gpfs/temora-shire-council-financial-statements-2024-25.pdf` with the SHA-256 above; no PDF is
committed.

## 8. How to verify

```bash
# Official page and the exact FY2024-25 PDF (200 in this retrieval run).
curl -sL -o /dev/null -w '%{http_code}\n' \
  -A 'curl/8.5.0' 'https://www.temora.nsw.gov.au/Your-Council/Planning-and-Reporting/Plans-and-Reports'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  -A 'curl/8.5.0' \
  'https://www.temora.nsw.gov.au/files/assets/public/v/1/on-exhibition/2025/financial-statements/temora-shire-council-financial-statements-2024-25.pdf'

# Focused connector tests (19).
TEST_MONGO_URL="mongodb://localhost:27018/ausspend_test_temoragpfs" \
  npx vitest run --project server server/test/temora-gpfs.test.ts
```

The focused suite covers the unit gate, exact reconciliation/zero tolerance (including the negative
before-capital result, the net loss on disposal and the three OCI components), FY2024-25 acceptance
and rejection of 2025-26/2023-24 documents, natural-key/idempotency, no-cross-council totals,
discovery/latest selection (annual report, prior-year and mirror rejection), the
`403`→documented-pin WAF fallback and the plain-UA header.
