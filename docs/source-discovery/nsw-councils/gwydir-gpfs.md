# Gwydir Shire Council — General Purpose Financial Statements (FY2024-25)

Source id `gwydir-gpfs` (NSW local government). One council only; entity-level rows, no council
total and no cross-council or state/federal addition.

## 0. Stale-year check (FY2025-26 not available as audited standalone statements)

The work-item title said FY2024-25. The official **Financial Statements and Budgets** page was
checked on 2026-11-19. The newest published audited standalone statements are **Annual Financial
Statements 2025** — the year ended 30 June 2025, FY2024-25. The page also lists the 2024 audited
statements, 2022-23 and older, plus adopted budgets. The Annual Report page lists Annual Report 2025
and Annual Report 2024; those are narrative annual reports, not audited standalone statements.
There is **no FY2025-26 audited standalone statements PDF** that downloads. This connector therefore
targets **FY2024-25** and never substitutes a 2025-26/2023-24 document, the narrative annual
report, the SPFS or the special schedules. A 404/JS-only 2025-26 link is recorded as a gap, not a
reason to fabricate.

## 1. Source and year

- Publisher: **Gwydir Shire Council**.
- Document: standalone audited **Annual Financial Statements 2025** for the year ended 30 June 2025
  — FY2024-25. The 94-page PDF carries the signed GPFS, notes and the independent auditor's
  reports.
- Official page:
  <https://www.gwydir.nsw.gov.au/Council/Governance/Financial-Statements-and-Budgets>.
- Current exact PDF:
  <https://www.gwydir.nsw.gov.au/files/sharedassets/public/v/1/council/governance/financial-statements-and-budgets/annual-financial-statements-2025.pdf>.
  The same URL is the documented official fallback pin, used when the listing yields no usable
  anchor; the downloaded bytes are SHA-256 verified either way.

## 2. Access, discovery and fetch

The inventory recorded an Edge/Akamai WAF returning `403 text/html` to bare curl, with a browser
fetch required. In this retrieval run (2026-11-19) **both the Financial Statements and Budgets page
and the PDF returned `200`** to `curl/8.5.0` (PDF `application/pdf`, 1,862,025 bytes), so no browser
fetch was needed for the live ingest. The connector still sends an explicit plain `curl/8.5.0` UA
(plus a broad PDF/HTML `Accept`) and falls back to the documented official pin if the page is
challenged or yields no usable anchor; a focused test simulates a `403` listing and asserts the pin
fallback. `scripts/gwydir-gpfs-browser.ts` is the documented headless-Chromium fallback for a
challenged run: it loads the official page, parses the link from the cleared HTML and fetches the
exact bytes same-origin. No unofficial mirror was used.

The parser accepts direct `.pdf` uploads whose label or file name contains "Financial Statements"
and rejects the narrative annual report, SPFS/special schedules, public notices, policies and
mirrors. The fiscal year is derived from the anchor label and file name
(`annual-financial-statements-2025.pdf` → FY2024-25), not from an upload-path date. The exclusion
filter is applied to the visible link label, not the URL, because the official upload directory is
itself named `financial-statements-and-budgets`.

## 3. Archive (outside the repo)

The exact downloaded bytes are archived outside the repository under the configured source-archive
root, with the relative archive path `gwydir-gpfs/annual-financial-statements-2025.pdf`:

- URL: `https://www.gwydir.nsw.gov.au/files/sharedassets/public/v/1/council/governance/financial-statements-and-budgets/annual-financial-statements-2025.pdf`
- retrieval date: 2026-11-19
- bytes: **1,862,025**
- SHA-256: `740b9e4cbcd804462fbd008b249bbdc520c5699dbe61f8f8fe3df8dd50841a07`
- content type: `application/pdf`

No PDF is committed. The fixture and this note contain only the relative archive path.

## 4. Exact reconciliation (zero tolerance)

The printed unit is explicit `$ '000` on the income statement, comprehensive-income statement and
B1-1. A missing or conflicting unit rejects the whole extraction. Nothing is emitted unless all of
these agree exactly (one thousand dollars is a failure):

| Check | Printed / derived (`$ '000`) | Result |
| --- | --- | --- |
| Total income from continuing operations (Income Statement) | 59,627 | = 5,962,700,000 cents |
| Revenue components sum (rates 12,766 + user charges 8,449 + other revenues 7,520 + operating grants 10,168 + capital grants 19,170 + interest 1,207 + other income 347; 2025 net gain on disposal nil) | 59,627 | = printed total |
| Expense components sum (employee 16,611 + materials 19,805 + borrowing 1,221 + other 694 + net loss on disposal 2,755) | 41,086 | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment 10,666 | 51,752 | = total expenses |
| B1-1 Total functions and activities — income | 59,627 | = face total revenue |
| B1-1 Total functions and activities — expenses | 51,752 | = face expense bridge |
| B1-1 Total functions and activities — operating result | 7,875 | = face net result |
| B1-1 grants and contributions | 29,338 | = operating 10,168 + capital 19,170 |
| Total revenue − total expenses | 59,627 − 51,752 = 7,875 | = printed net result (positive) |
| Net result − capital grants | 7,875 − 19,170 = (11,295) | = printed negative before-capital result (evidence only) |
| Comprehensive-income net result | 7,875 | = Income Statement net result |
| Other comprehensive income (revaluation 114,402 + impairment reversal 3,143 + impairment loss (4,638)) | 112,907 | = printed other comprehensive income |
| Net result + other comprehensive income | 7,875 + 112,907 = 120,782 | = printed total comprehensive income |

The Income Statement does not print a "Total expenses" line. Total expenses is therefore the
documented bridge of the printed expenses-excluding-depreciation line (41,086) plus the printed
depreciation/amortisation/impairment line (10,666) = 51,752, which equals the printed B1-1 expense
total. The council prints a real net **loss** on disposal of assets (2,755), emitted as an expense
row; the 2025 net gain on disposal is nil and is not emitted. The net result is positive (7,875)
while the before-capital result is negative (−11,295); the before-capital figure is retained in
reconciliation evidence only. Other comprehensive income has three printed components —
revaluation (114,402), impairment reversal (3,143) and impairment loss (−4,638) — whose sum
(112,907) equals the printed other comprehensive income.

The adapter defers the document with **0 rows** and the exact gap if any printed line is missing,
the unit is not thousands, or any bridge differs. On the audited FY2024-25 report there is no
deferral.

## 5. Extracted entity rows (17, non-additive)

| `gpfs_line_item` | Printed/derived label | `$ '000` | `amount_cents` | Section |
| --- | --- | ---: | ---: | --- |
| `rates_and_annual_charges` | Rates and annual charges | 12,766 | 1,276,600,000 | revenue |
| `user_charges_and_fees` | User charges and fees | 8,449 | 844,900,000 | revenue |
| `other_revenue` | Other revenues | 7,520 | 752,000,000 | revenue |
| `government_grants_operating` | Grants and contributions — operating | 10,168 | 1,016,800,000 | revenue |
| `government_grants_capital` | Grants and contributions — capital | 19,170 | 1,917,000,000 | revenue |
| `interest_and_investment_income` | Interest and investment income | 1,207 | 120,700,000 | revenue |
| `other_income` | Other income | 347 | 34,700,000 | revenue |
| `total_revenue` | Total income from continuing operations | 59,627 | 5,962,700,000 | revenue |
| `employee_expenses` | Employee benefits and on-costs | 16,611 | 1,661,100,000 | expenses |
| `materials_and_services` | Materials and services | 19,805 | 1,980,500,000 | expenses |
| `borrowing_costs` | Borrowing costs | 1,221 | 122,100,000 | expenses |
| `other_expenses` | Other expenses | 694 | 69,400,000 | expenses |
| `net_loss_from_disposal_of_assets` | Net loss from the disposal of assets | 2,755 | 275,500,000 | expenses |
| `total_expenses_excluding_depreciation` | Total expenses excluding depreciation | 41,086 | 4,108,600,000 | expenses |
| `depreciation_amortisation_impairment` | Depreciation, amortisation and impairment | 10,666 | 1,066,600,000 | expenses |
| `total_expenses` | Total expenses (documented bridge) | 51,752 | 5,175,200,000 | expenses |
| `net_result` | Net operating result attributable to Council | 7,875 | 787,500,000 | result |

Every row is `jurisdiction_level: "local"`, `jurisdiction: "NSW"`,
`delivery_entity: "Gwydir Shire Council"`, `aggregation_role: "agency_detail"`,
`measure_type: "actual"`, `verified: false`, `data_quality_flag: "provisional/local_government"`.
Government grant rows carry `potential_double_count: true`. The net result is positive, so no
printed-sign marker is stored.

## 6. No-total / no-cross-council rule

- Gwydir Shire Council is one entity. No council total, no state/national total and no sum with
  another council, the `dubbo-council` budget/estimate rows, a government program, the PNFC
  benchmark or the OLG summary layer is created.
- The FY2024-25 column is the reporting boundary; the FY2023-24 comparative is not added.
- Revenue, expenses, components and the net result overlap. They are published rows, not an
  additive spending series.
- Every row is `agency_detail` with no `region_id` and no `location`/LGA allocation.

## 7. Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`)

Targeted ingest of **only `gwydir-gpfs`** against the shared dev DB `ausspend_dev`:

- total measures **999,353 → 999,370** (exactly **+17**);
- GPFS rows (`source_id` matching `/gpfs$/`) **1835 → 1852**;
- active GPFS `data_sources` **98 → 99**;
- SOC rows (`jurisdiction_level: "soc"`) stayed at **205**; every other per-source count unchanged;
- **0** non-`agency_detail` rows, **0** rows with `region_id`/`location`, one `delivery_entity`
  (`Gwydir Shire Council`), all rows `fiscal_year: "2024-25"`, and no council-total/aggregate row;
- `data_sources` has the source `active` with `records_ingested: 17`;
- the latest `ingestion_logs` entry for the source is `status: "success"`,
  `records_fetched: 17`, `records_upserted: 17`.

The exact PDF is archived outside the repo at the relative path
`gwydir-gpfs/annual-financial-statements-2025.pdf` with the SHA-256 above; no PDF is committed.

## 8. How to verify

```bash
# Official page and exact FY2024-25 PDF (200 in this retrieval run).
curl -sL -o /dev/null -w '%{http_code}\n' \
  -A 'curl/8.5.0' \
  'https://www.gwydir.nsw.gov.au/Council/Governance/Financial-Statements-and-Budgets'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  -A 'curl/8.5.0' \
  'https://www.gwydir.nsw.gov.au/files/sharedassets/public/v/1/council/governance/financial-statements-and-budgets/annual-financial-statements-2025.pdf'

# Focused connector tests (19).
TEST_MONGO_URL="mongodb://localhost:27017/ausspend_test_gwydirgpfs" \
  npx vitest run --project server server/test/gwydir-gpfs.test.ts
```

The focused suite covers the unit gate, exact reconciliation/zero tolerance (including the
before-capital result, the net loss on disposal and all three OCI components), FY2024-25 acceptance
and rejection of 2025-26/2023-24 documents, natural-key/idempotency, no-cross-council totals,
discovery/latest selection (annual report, prior-year and mirror rejection), the
`403`→documented-pin WAF fallback and the plain-UA header.
