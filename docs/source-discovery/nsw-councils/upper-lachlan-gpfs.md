# Upper Lachlan Shire Council — General Purpose Financial Statements (FY2025-26)

Source id `upper-lachlan-gpfs` (NSW local government). One council only; entity-level rows, no
council total and no cross-council or state/federal addition.

## 0. Stale/current-year check (FY2025-26 is the newest)

The work-item title said FY2025-26. The official **Plans and Reports** page was checked on
2026-11-19 and lists **Financial Statements 2025-2026** (the year ended 30 June 2026) as the newest
audited standalone statements, above Financial Statements 2024-2025, 2023-2024, 2022-2023 and
older. The page also lists Annual Report 2025-2026 and planning/budget documents; those are
narrative or planning documents, not audited standalone statements. No later (2026-27) audited
standalone statements were published. The connector therefore targets **FY2025-26** and never
substitutes the earlier 2024-25/2023-24 document, the narrative annual report, the SPFS or the
special schedules. A 404/JS-only later-year link would be recorded as a gap, not a reason to
fabricate.

## 1. Source and year

- Publisher: **Upper Lachlan Shire Council**.
- Document: standalone audited **Financial Statements 2025-2026** for the year ended 30 June 2026 —
  FY2025-26. The 105-page PDF carries the signed GPFS, notes and the independent auditor's reports.
- Official page:
  <https://upperlachlan.nsw.gov.au/council/plans-and-reports/>.
- Current exact PDF:
  <https://upperlachlan.nsw.gov.au/wp-content/uploads/2026/10/ANNEXURE-A-Part-2-Annual_Financial_Statements-2026_Final-Audited.pdf>.
  The same URL is the documented official fallback pin, used when the listing yields no usable
  anchor; the downloaded bytes are SHA-256 verified either way.

## 2. Access, discovery and fetch

The inventory recorded an Edge/Akamai WAF returning `403 text/html` to bare curl, with a browser
fetch required. In this retrieval run (2026-11-19) **both the Plans and Reports page and the PDF
returned `200`** to `curl/8.5.0` (PDF `application/pdf`, 4,215,629 bytes), so no browser fetch was
needed for the live ingest. The connector still sends an explicit plain `curl/8.5.0` UA (plus a
broad PDF/HTML `Accept`) and falls back to the documented official pin if the page is challenged or
yields no usable anchor; a focused test simulates a `403` listing and asserts the pin fallback.
`scripts/upper-lachlan-gpfs-browser.ts` is the documented headless-Chromium fallback for a challenged
run: it loads the official page, parses the link from the cleared HTML and fetches the exact bytes
same-origin. No unofficial mirror was used.

The parser accepts direct `.pdf` uploads whose label or file name contains "Financial Statements"
and rejects the narrative annual report, SPFS/special schedules, public notices, policies and
mirrors. The fiscal year is derived from the anchor label and file name
(`Financial Statements 2025-2026` → FY2025-26), not from an upload-path date.

## 3. Archive (outside the repo)

The exact downloaded bytes are archived outside the repository under the configured source-archive
root, with the relative archive path
`upper-lachlan-gpfs/ANNEXURE-A-Part-2-Annual_Financial_Statements-2026_Final-Audited.pdf`:

- URL: `https://upperlachlan.nsw.gov.au/wp-content/uploads/2026/10/ANNEXURE-A-Part-2-Annual_Financial_Statements-2026_Final-Audited.pdf`
- retrieval date: 2026-11-19
- bytes: **4,215,629**
- SHA-256: `3ca065982ea966c62c69243ae74039ce539fd1a055fdd94e2c8eec832ef66e41`
- content type: `application/pdf`

No PDF is committed. The fixture and this note contain only the relative archive path.

## 4. Exact reconciliation (zero tolerance)

The printed unit is explicit `$ '000` on the income statement, comprehensive-income statement and
B1-1. A missing or conflicting unit rejects the whole extraction. Nothing is emitted unless all of
these agree exactly (one thousand dollars is a failure):

| Check | Printed / derived (`$ '000`) | Result |
| --- | --- | --- |
| Total income from continuing operations (Income Statement) | 51,074 | = 5,107,400,000 cents |
| Revenue components sum (rates 15,372 + user charges 10,991 + other revenues 830 + operating grants 14,650 + capital grants 7,562 + interest 1,669; the council prints no "Other income" line and the 2026 net gain on disposal is nil) | 51,074 | = printed total |
| Expense components sum (employee 12,709 + materials 17,647 + borrowing 504 + other 874 + net loss on disposal 1,468) | 33,202 | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment 11,500 | 44,702 | = total expenses |
| B1-1 Total functions and activities — income | 51,074 | = face total revenue |
| B1-1 Total functions and activities — expenses | 44,702 | = face expense bridge |
| B1-1 Total functions and activities — operating result | 6,372 | = face net result |
| B1-1 grants and contributions | 22,212 | = operating 14,650 + capital 7,562 |
| Total revenue − total expenses | 51,074 − 44,702 = 6,372 | = printed net result (positive) |
| Net result − capital grants | 6,372 − 7,562 = (1,190) | = printed negative before-capital result (evidence only) |
| Comprehensive-income net result | 6,372 | = Income Statement net result |
| Other comprehensive income (single 2026 revaluation component) | 36,721 | = printed other comprehensive income |
| Net result + other comprehensive income | 6,372 + 36,721 = 43,093 | = printed total comprehensive income |

The Income Statement does not print a "Total expenses" line. Total expenses is therefore the
documented bridge of the printed expenses-excluding-depreciation line (33,202) plus the printed
depreciation/amortisation/impairment line (11,500) = 44,702, which equals the printed B1-1 expense
total. The council prints a real net **loss** on disposal of assets (1,468), emitted as an expense
row; the 2026 net gain on disposal is nil and is not emitted. The net result is positive (6,372)
while the before-capital result is negative (−1,190); the before-capital figure is retained in
reconciliation evidence only. Other comprehensive income has a single printed 2026 component —
revaluation (36,721) — which equals the printed other comprehensive income. The council prints six
revenue components and no "Other income" line, so no such row is invented.

The adapter defers the document with **0 rows** and the exact gap if any printed line is missing,
the unit is not thousands, or any bridge differs. On the audited FY2025-26 report there is no
deferral.

## 5. Extracted entity rows (16, non-additive)

| `gpfs_line_item` | Printed/derived label | `$ '000` | `amount_cents` | Section |
| --- | --- | ---: | ---: | --- |
| `rates_and_annual_charges` | Rates and annual charges | 15,372 | 1,537,200,000 | revenue |
| `user_charges_and_fees` | User charges and fees | 10,991 | 1,099,100,000 | revenue |
| `other_revenue` | Other revenues | 830 | 83,000,000 | revenue |
| `government_grants_operating` | Grants and contributions — operating | 14,650 | 1,465,000,000 | revenue |
| `government_grants_capital` | Grants and contributions — capital | 7,562 | 756,200,000 | revenue |
| `interest_and_investment_income` | Interest and investment income | 1,669 | 166,900,000 | revenue |
| `total_revenue` | Total income from continuing operations | 51,074 | 5,107,400,000 | revenue |
| `employee_expenses` | Employee benefits and on-costs | 12,709 | 1,270,900,000 | expenses |
| `materials_and_services` | Materials and services | 17,647 | 1,764,700,000 | expenses |
| `borrowing_costs` | Borrowing costs | 504 | 50,400,000 | expenses |
| `other_expenses` | Other expenses | 874 | 87,400,000 | expenses |
| `net_loss_from_disposal_of_assets` | Net loss from the disposal of assets | 1,468 | 146,800,000 | expenses |
| `total_expenses_excluding_depreciation` | Total expenses excluding depreciation | 33,202 | 3,320,200,000 | expenses |
| `depreciation_amortisation_impairment` | Depreciation, amortisation and impairment | 11,500 | 1,150,000,000 | expenses |
| `total_expenses` | Total expenses (documented bridge) | 44,702 | 4,470,200,000 | expenses |
| `net_result` | Net operating result attributable to Council | 6,372 | 637,200,000 | result |

Every row is `jurisdiction_level: "local"`, `jurisdiction: "NSW"`,
`delivery_entity: "Upper Lachlan Shire Council"`, `aggregation_role: "agency_detail"`,
`measure_type: "actual"`, `verified: false`, `data_quality_flag: "provisional/local_government"`.
Government grant rows carry `potential_double_count: true`. The net result is positive, so no
printed-sign marker is stored.

## 6. No-total / no-cross-council rule

- Upper Lachlan Shire Council is one entity. No council total, no state/national total and no sum
  with another council, the `dubbo-council` budget/estimate rows, a government program, the PNFC
  benchmark or the OLG summary layer is created.
- The FY2025-26 column is the reporting boundary; the FY2024-25 comparative is not added.
- Revenue, expenses, components and the net result overlap. They are published rows, not an
  additive spending series.
- Every row is `agency_detail` with no `region_id` and no `location`/LGA allocation.

## 7. Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`)

Targeted ingest of **only `upper-lachlan-gpfs`** against the shared dev DB `ausspend_dev`:

- total measures **999,421 → 999,437** (exactly **+16**);
- GPFS rows (`source_id` matching `/gpfs$/`) **1903 → 1919**;
- active GPFS `data_sources` **102 → 103**;
- SOC rows (`jurisdiction_level: "soc"`) stayed at **205**; every other per-source count unchanged;
- **0** non-`agency_detail` rows, **0** rows with `region_id`/`location`, one `delivery_entity`
  (`Upper Lachlan Shire Council`), all rows `fiscal_year: "2025-26"`, and no council-total/aggregate
  row;
- `data_sources` has the source `active` with `records_ingested: 16`;
- the latest `ingestion_logs` entry for the source is `status: "success"`,
  `records_fetched: 16`, `records_upserted: 16`.

The exact PDF is archived outside the repo at the relative path
`upper-lachlan-gpfs/ANNEXURE-A-Part-2-Annual_Financial_Statements-2026_Final-Audited.pdf` with the
SHA-256 above; no PDF is committed.

## 8. How to verify

```bash
# Official page and exact FY2025-26 PDF (200 in this retrieval run).
curl -sL -o /dev/null -w '%{http_code}\n' \
  -A 'curl/8.5.0' \
  'https://upperlachlan.nsw.gov.au/council/plans-and-reports/'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  -A 'curl/8.5.0' \
  'https://upperlachlan.nsw.gov.au/wp-content/uploads/2026/10/ANNEXURE-A-Part-2-Annual_Financial_Statements-2026_Final-Audited.pdf'

# Focused connector tests (19).
TEST_MONGO_URL="mongodb://localhost:27017/ausspend_test_upperlachlangpfs" \
  npx vitest run --project server server/test/upper-lachlan-gpfs.test.ts
```

The focused suite covers the unit gate, exact reconciliation/zero tolerance (including the positive
net result, the negative before-capital result, the net loss on disposal and the single OCI
revaluation component), FY2025-26 acceptance and rejection of 2026-27/2024-25 documents,
natural-key/idempotency, no-cross-council totals, discovery/latest selection (annual report,
prior-year and mirror rejection), the `403`→documented-pin WAF fallback and the plain-UA header.
