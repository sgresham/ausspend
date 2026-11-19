# Murray River Council — General Purpose Financial Statements (FY2025-26)

Source id `murray-river-gpfs` (NSW local government). One council only; entity-level rows, no
council total and no cross-council or state/federal addition.

## 0. Stale-year check (retargeted to the newer FY2025-26 document)

The work-item title said FY2024-25. The official **Annual Report** page was checked on 2026-11-19
and lists **MRC-25-26-Annual-Report-with-financial-statements** (the year ended 30 June 2026) above
MRC-24-25 and older annual reports. The FY2025-26 document downloads and contains the audited
General Purpose Financial Statements section (Income Statement, Statement of Comprehensive Income,
B1-1 and the independent auditor's reports), so the connector **retargeted to FY2025-26** rather
than ingesting the older FY2024-25 document. No FY2024-25 rows were ever created, so there was
nothing prior-year to delete. No later (2026-27) audited statements were published. A 404/JS-only
later-year link would be recorded as a gap, not a reason to fabricate.

## 1. Source and year

- Publisher: **Murray River Council**.
- Document: audited **MRC-25-26 Annual Report with Financial Statements** for the year ended 30 June
  2026 — FY2025-26. The 198-page annual report embeds the signed GPFS section (Income Statement PDF
  p86, Statement of Comprehensive Income p87, B1-1 "Functions or activities" p95) plus the notes and
  the independent auditor's reports.
- Official page:
  <https://www.murrayriver.nsw.gov.au/Council/Fees-forms-documents/Annual-Reporting/Annual-Report>.
- Current exact PDF:
  <https://www.murrayriver.nsw.gov.au/files/assets/public/v/1/documents/ipampr-docs-and-budgets/2025-2026/mrc-25-26-annual-report-with-financial-statements.pdf>.
  The same URL is the documented official fallback pin, used when the listing yields no usable
  anchor; the downloaded bytes are SHA-256 verified either way.

## 2. Access, discovery and fetch

The inventory recorded an Edge/Akamai WAF that may return `403` to plain curl. In this retrieval run
(2026-11-19) **both the Annual Report page and the PDF returned `200`** to `curl/8.5.0` (PDF
`application/pdf`, 5,726,687 bytes), so no browser fetch was needed for the live ingest. The
connector still sends an explicit plain `curl/8.5.0` UA and falls back to the documented official pin
if the page is challenged or yields no usable anchor; a focused test simulates a `403` listing and
asserts the pin fallback. `scripts/murray-river-gpfs-browser.ts` is the documented headless-Chromium
fallback for a challenged run: it loads the official page, parses the link from the cleared HTML and
fetches the exact bytes same-origin. No unofficial mirror was used.

The parser accepts direct `.pdf` uploads whose label or file name contains "Financial Statements"
and uses the audited GPFS section inside the annual report. The narrative-only annual reports and
non-GPFS annexures are not ingested. The fiscal year is derived from the label, filename and upload
path; the FY2025-26 filename uses a two-digit year pair (`mrc-25-26-...`) while the upload path
contains `2025-2026`, so the full href is used as a final fiscal-year source.

## 3. Archive (outside the repo)

The exact downloaded bytes are archived outside the repository under the configured source-archive
root, with the relative archive path
`murray-river-gpfs/mrc-25-26-annual-report-with-financial-statements.pdf`:

- URL: `https://www.murrayriver.nsw.gov.au/files/assets/public/v/1/documents/ipampr-docs-and-budgets/2025-2026/mrc-25-26-annual-report-with-financial-statements.pdf`
- retrieval date: 2026-11-19
- bytes: **5,726,687**
- SHA-256: `347ee9345dbb979ab3d6eb2e471f257a5f25ab7dce0960c42b7700d54166ef01`
- content type: `application/pdf`

No PDF is committed. The fixture and this note contain only the relative archive path.

## 4. Exact reconciliation (zero tolerance)

The printed unit is explicit `$ '000` on the income statement, comprehensive-income statement and
B1-1. A missing or conflicting unit rejects the whole extraction. Nothing is emitted unless all of
these agree exactly (one thousand dollars is a failure):

| Check | Printed / derived (`$ '000`) | Result |
| --- | --- | --- |
| Total income from continuing operations (Income Statement) | 86,403 | = 8,640,300,000 cents |
| Revenue components sum (rates 27,238 + user charges 13,577 + other revenue 1,210 + operating grants 21,518 + capital grants 19,223 + interest 2,963 + other income 674; 2026 net gain on disposal nil) | 86,403 | = printed total |
| Expense components sum (employee 23,740 + materials 23,385 + borrowing 214 + other 9,450 + net loss on disposal 10,687) | 67,476 | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment 22,071 | 89,547 | = total expenses |
| B1-1 Total functions and activities — income | 86,403 | = face total revenue |
| B1-1 Total functions and activities — expenses | 89,547 | = face expense bridge |
| B1-1 Total functions and activities — operating result | (3,144) | = face net result |
| B1-1 grants and contributions | 40,741 | = operating 21,518 + capital 19,223 |
| Total revenue − total expenses | 86,403 − 89,547 = (3,144) | = printed net result (negative) |
| Net result − capital grants | (3,144) − 19,223 = (22,367) | = printed negative before-capital result (evidence only) |
| Comprehensive-income net result | (3,144) | = Income Statement net result |
| Other comprehensive income (revaluation 4,320 + revaluation of intangible assets 802) | 5,122 | = printed other comprehensive income |
| Net result + other comprehensive income | (3,144) + 5,122 = 1,978 | = printed total comprehensive income |

The Income Statement does not print a "Total expenses" line. Total expenses is therefore the
documented bridge of the printed expenses-excluding-depreciation line (67,476) plus the printed
depreciation/amortisation/impairment line (22,071) = 89,547, which equals the printed B1-1 expense
total. The council prints a real net **loss** on disposal of assets (10,687), emitted as an expense
row; the 2026 net gain on disposal is nil and is not emitted. The net result is negative (−3,144)
and is stored with a printed-sign marker; the before-capital result is more negative (−22,367) and
is retained in reconciliation evidence only. Other comprehensive income has two printed components —
revaluation (4,320) and revaluation of intangible assets (802) — whose sum (5,122) equals the printed
other comprehensive income.

The adapter defers the document with **0 rows** and the exact gap if any printed line is missing,
the unit is not thousands, or any bridge differs. On the audited FY2025-26 report there is no
deferral.

## 5. Extracted entity rows (17, non-additive)

| `gpfs_line_item` | Printed/derived label | `$ '000` | `amount_cents` | Section |
| --- | --- | ---: | ---: | --- |
| `rates_and_annual_charges` | Rates and annual charges | 27,238 | 2,723,800,000 | revenue |
| `user_charges_and_fees` | User charges and fees | 13,577 | 1,357,700,000 | revenue |
| `other_revenue` | Other revenue | 1,210 | 121,000,000 | revenue |
| `government_grants_operating` | Grants and contributions — operating | 21,518 | 2,151,800,000 | revenue |
| `government_grants_capital` | Grants and contributions — capital | 19,223 | 1,922,300,000 | revenue |
| `interest_and_investment_income` | Interest and investment income | 2,963 | 296,300,000 | revenue |
| `other_income` | Other income | 674 | 67,400,000 | revenue |
| `total_revenue` | Total income from continuing operations | 86,403 | 8,640,300,000 | revenue |
| `employee_expenses` | Employee benefits and on-costs | 23,740 | 2,374,000,000 | expenses |
| `materials_and_services` | Materials and services | 23,385 | 2,338,500,000 | expenses |
| `borrowing_costs` | Borrowing costs | 214 | 21,400,000 | expenses |
| `other_expenses` | Other expenses | 9,450 | 945,000,000 | expenses |
| `net_loss_from_disposal_of_assets` | Net loss from the disposal of assets | 10,687 | 1,068,700,000 | expenses |
| `total_expenses_excluding_depreciation` | Total expenses excluding depreciation | 67,476 | 6,747,600,000 | expenses |
| `depreciation_amortisation_impairment` | Depreciation, amortisation and impairment | 22,071 | 2,207,100,000 | expenses |
| `total_expenses` | Total expenses (documented bridge) | 89,547 | 8,954,700,000 | expenses |
| `net_result` | Net operating result attributable to Council | (3,144) | 314,400,000 (printed negative) | result |

Every row is `jurisdiction_level: "local"`, `jurisdiction: "NSW"`,
`delivery_entity: "Murray River Council"`, `aggregation_role: "agency_detail"`,
`measure_type: "actual"`, `verified: false`, `data_quality_flag: "provisional/local_government"`.
Government grant rows carry `potential_double_count: true`. The net-result row carries
`gpfs_printed_sign: "negative"`.

## 6. No-total / no-cross-council rule

- Murray River Council is one entity. No council total, no state/national total and no sum with
  another council, the `dubbo-council` budget/estimate rows, a government program, the PNFC
  benchmark or the OLG summary layer is created.
- The FY2025-26 column is the reporting boundary; the FY2024-25 comparative is not added.
- Revenue, expenses, components and the net result overlap. They are published rows, not an
  additive spending series.
- Every row is `agency_detail` with no `region_id` and no `location`/LGA allocation.

## 7. Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`)

Targeted ingest of **only `murray-river-gpfs`** against the shared dev DB `ausspend_dev`:

- total measures **999,454 → 999,471** (exactly **+17**);
- GPFS rows (`source_id` matching `/gpfs$/`) **1936 → 1953**;
- active GPFS `data_sources` **104 → 105**; total GPFS source ids **105 → 106** (Berrigan remains
  registered/degraded with 0 rows);
- SOC rows (`jurisdiction_level: "soc"`) stayed at **205**; every other per-source count unchanged;
- **0** non-`agency_detail` rows, **0** rows with `region_id`/`location`, one `delivery_entity`
  (`Murray River Council`), all rows `fiscal_year: "2025-26"`, and no council-total/aggregate row;
- `data_sources` has the source `active` with `records_ingested: 17`;
- the latest `ingestion_logs` entry for the source is `status: "success"`,
  `records_fetched: 17`, `records_upserted: 17`.

The exact PDF is archived outside the repo at the relative path
`murray-river-gpfs/mrc-25-26-annual-report-with-financial-statements.pdf` with the SHA-256 above; no
PDF is committed.

## 8. How to verify

```bash
# Official page and exact FY2025-26 PDF (200 in this retrieval run).
curl -sL -o /dev/null -w '%{http_code}\n' \
  -A 'curl/8.5.0' \
  'https://www.murrayriver.nsw.gov.au/Council/Fees-forms-documents/Annual-Reporting/Annual-Report'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  -A 'curl/8.5.0' \
  'https://www.murrayriver.nsw.gov.au/files/assets/public/v/1/documents/ipampr-docs-and-budgets/2025-2026/mrc-25-26-annual-report-with-financial-statements.pdf'

# Focused connector tests (19).
TEST_MONGO_URL="mongodb://localhost:27017/ausspend_test_murrayrivergpfs" \
  npx vitest run --project server server/test/murray-river-gpfs.test.ts
```

The focused suite covers discovery/latest selection (annual report, prior-year and mirror
rejection), the `403`→documented-pin WAF fallback, the plain-UA header, the unit gate, exact
zero-tolerance reconciliation (including the negative net/ before-capital results, the net loss on
disposal and both OCI components), natural-key/idempotency, and additive-only ingestion with no
cross-council total.
