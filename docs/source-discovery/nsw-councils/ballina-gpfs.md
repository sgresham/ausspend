# Ballina Shire Council — General Purpose Financial Statements (FY2024-25)

Source id `ballina-gpfs` (NSW local government). One council only; entity-level rows, no council
total and no cross-council or state/federal addition.

## 0. Stale-year check

The work-item title said FY2024-25. The official **Reporting** page was checked on 2026-11-19 and
lists **Annual Report 2024-25** (PDF, 16MB) as the latest annual report. No FY2025-26 annual report
was published yet. The FY2024-25 annual report contains the audited General Purpose Financial
Statements section (GPFS PDF pp. 216, 217 and 225), so the connector targets **FY2024-25** and does
not substitute an older standalone report, the narrative-only annual-report sections, the SPFS or
the special schedules. A 404/JS-only later-year link would be recorded as a gap, not a reason to
fabricate.

## 1. Source and year

- Publisher: **Ballina Shire Council**.
- Document: **Annual Report 2024-25** for the year ended 30 June 2025 — FY2024-25. The 327-page PDF
  embeds the audited GPFS section (Income Statement PDF p216, Statement of Comprehensive Income
  p217, B1-1 "Functions or activities" p225) plus the notes and the independent auditor's reports.
- Official page:
  <https://www.ballina.nsw.gov.au/Council/Forms-and-Documents/Integrated-Planning-and-Reporting/Reporting>.
- Current exact PDF:
  <https://www.ballina.nsw.gov.au/files/assets/public/v/2/council/documents/council-documents/ballina-shire-council-annual-report-202425-resized.pdf>.
  The same URL is the documented official fallback pin, used when the listing yields no usable
  anchor; the downloaded bytes are SHA-256 verified either way.

## 2. Access, discovery and fetch

The inventory listed the annual report as annual-report-only and not yet confirmed ingest-ready. In
this retrieval run (2026-11-19) **both the Reporting page and the PDF returned `200`** to
`curl/8.5.0` (PDF `application/pdf`, 17,070,707 bytes), so no browser fetch was needed. The item
areas did not include a browser script, so the connector uses the existing plain fetch/archive path
and a documented official pin fallback. No website mirror was used.

The parser accepts the official annual-report PDF, finds the audited GPFS section inside it, and
extracts only the Income Statement, Statement of Comprehensive Income and B1-1 statement-line slice;
it does not ingest narrative annual-report pages. The fiscal year is derived from the annual-report
label (`Annual Report 2024-25` → FY2024-25), not from an upload-path date.

## 3. Archive (outside the repo)

The exact downloaded bytes are archived outside the repository under the configured source-archive
root, with the relative archive path
`ballina-gpfs/ballina-shire-council-annual-report-202425-resized.pdf`:

- URL: `https://www.ballina.nsw.gov.au/files/assets/public/v/2/council/documents/council-documents/ballina-shire-council-annual-report-202425-resized.pdf`
- retrieval date: 2026-11-19
- bytes: **17,070,707**
- SHA-256: `eeeb8354b0bc2a80b918eb218a145861eafafbae3dfc6383cac3b2fcefa99007`
- content type: `application/pdf`

No PDF is committed. The fixture and this note contain only the relative archive path.

## 4. Exact reconciliation (zero tolerance)

The printed unit is explicit `$ '000` on the income statement, comprehensive-income statement and
B1-1. A missing or conflicting unit rejects the whole extraction. Nothing is emitted unless all of
these agree exactly (one thousand dollars is a failure):

| Check | Printed / derived (`$ '000`) | Result |
| --- | --- | --- |
| Total income from continuing operations (Income Statement) | 157,649 | = 15,764,900,000 cents |
| Revenue components sum (rates 65,020 + user charges 34,210 + other revenues 3,431 + operating grants 11,690 + capital grants 22,255 + interest 5,410 + other income 5,784 + net gain on disposal 9,849) | 157,649 | = printed total |
| Expense components sum (employee 38,505 + materials 49,690 + borrowing 4,067 + other 3,277; the 2025 net loss on disposal is nil) | 95,539 | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment 30,610 | 126,149 | = total expenses |
| B1-1 Total functions and activities — income | 157,649 | = face total revenue |
| B1-1 Total functions and activities — expenses | 126,149 | = face expense bridge |
| B1-1 Total functions and activities — operating result | 31,500 | = face net result |
| B1-1 grants and contributions | 33,945 | = operating 11,690 + capital 22,255 |
| Total revenue − total expenses | 157,649 − 126,149 = 31,500 | = printed net result (positive) |
| Net result − capital grants | 31,500 − 22,255 = 9,245 | = printed positive before-capital result (evidence only) |
| Comprehensive-income net result | 31,500 | = Income Statement net result |
| Other comprehensive income (revaluation 203,585 + impairment reversal 654) | 204,239 | = printed other comprehensive income |
| Net result + other comprehensive income | 31,500 + 204,239 = 235,739 | = printed total comprehensive income |

The Income Statement does not print a "Total expenses" line. Total expenses is therefore the
documented bridge of the printed expenses-excluding-depreciation line (95,539) plus the printed
depreciation/amortisation/impairment line (30,610) = 126,149, which equals the printed B1-1 expense
total. The council prints a real **net gain on disposal of assets** (9,849) as a revenue line and a
nil 2025 net loss on disposal (the 2024 comparative is 6,707); the gain is emitted as a revenue row
and the nil 2025 loss is not emitted. The net result is positive (31,500) and the before-capital
result is also positive (9,245); the before-capital figure is retained in reconciliation evidence
only. Other comprehensive income has two printed components — revaluation (203,585) and impairment
reversal (654) — whose sum (204,239) equals the printed other comprehensive income.

The adapter defers the document with **0 rows** and the exact gap if any printed line is missing,
the unit is not thousands, or any bridge differs. On the audited FY2024-25 GPFS section there is no
deferral.

## 5. Extracted entity rows (17, non-additive)

| `gpfs_line_item` | Printed/derived label | `$ '000` | `amount_cents` | Section |
| --- | --- | ---: | ---: | --- |
| `rates_and_annual_charges` | Rates and annual charges | 65,020 | 6,502,000,000 | revenue |
| `user_charges_and_fees` | User charges and fees | 34,210 | 3,421,000,000 | revenue |
| `other_revenue` | Other revenues | 3,431 | 343,100,000 | revenue |
| `government_grants_operating` | Grants and contributions — operating | 11,690 | 1,169,000,000 | revenue |
| `government_grants_capital` | Grants and contributions — capital | 22,255 | 2,225,500,000 | revenue |
| `interest_and_investment_income` | Interest and investment income | 5,410 | 541,000,000 | revenue |
| `other_income` | Other income | 5,784 | 578,400,000 | revenue |
| `net_gain_from_disposal_of_assets` | Net gain from the disposal of assets | 9,849 | 984,900,000 | revenue |
| `total_revenue` | Total income from continuing operations | 157,649 | 15,764,900,000 | revenue |
| `employee_expenses` | Employee benefits and on-costs | 38,505 | 3,850,500,000 | expenses |
| `materials_and_services` | Materials and services | 49,690 | 4,969,000,000 | expenses |
| `borrowing_costs` | Borrowing costs | 4,067 | 406,700,000 | expenses |
| `other_expenses` | Other expenses | 3,277 | 327,700,000 | expenses |
| `total_expenses_excluding_depreciation` | Total expenses excluding depreciation | 95,539 | 9,553,900,000 | expenses |
| `depreciation_amortisation_impairment` | Depreciation, amortisation and impairment | 30,610 | 3,061,000,000 | expenses |
| `total_expenses` | Total expenses (documented bridge) | 126,149 | 12,614,900,000 | expenses |
| `net_result` | Net operating result attributable to Council | 31,500 | 3,150,000,000 | result |

Every row is `jurisdiction_level: "local"`, `jurisdiction: "NSW"`,
`delivery_entity: "Ballina Shire Council"`, `aggregation_role: "agency_detail"`,
`measure_type: "actual"`, `verified: false`, `data_quality_flag: "provisional/local_government"`.
Government grant rows carry `potential_double_count: true`. The net result is positive, so no
printed-sign marker is stored.

## 6. No-total / no-cross-council rule

- Ballina Shire Council is one entity. No council total, no state/national total and no sum with
  another council, the `dubbo-council` budget/estimate rows, a government program, the PNFC
  benchmark or the OLG summary layer is created.
- The FY2024-25 column is the reporting boundary; the FY2023-24 comparative is not added.
- Revenue, expenses, components and the net result overlap. They are published rows, not an
  additive spending series.
- Every row is `agency_detail` with no `region_id` and no `location`/LGA allocation.

## 7. Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`)

Targeted ingest of **only `ballina-gpfs`** against the shared dev DB `ausspend_dev`:

- total measures **999,471 → 999,488** (exactly **+17**);
- GPFS rows (`source_id` matching `/gpfs$/`) **1953 → 1970**;
- active GPFS `data_sources` **105 → 106**; total GPFS source ids **107 → 108** (Berrigan and
  Albury remain registered/degraded with 0 rows);
- SOC rows (`jurisdiction_level: "soc"`) stayed at **205**; every other per-source count unchanged;
- **0** non-`agency_detail` rows, **0** rows with `region_id`/`location`, one `delivery_entity`
  (`Ballina Shire Council`), all rows `fiscal_year: "2024-25"`, and no council-total/aggregate row;
- `data_sources` has the source `active` with `records_ingested: 17`;
- the latest `ingestion_logs` entry for the source is `status: "success"`,
  `records_fetched: 17`, `records_upserted: 17`.

The exact annual report is archived outside the repo at the relative path
`ballina-gpfs/ballina-shire-council-annual-report-202425-resized.pdf` with the SHA-256 above; no PDF
is committed.

## 8. How to verify

```bash
# Official page and exact FY2024-25 annual report (200 in this retrieval run).
curl -sL -o /dev/null -w '%{http_code}\n' \
  -A 'curl/8.5.0' \
  'https://www.ballina.nsw.gov.au/Council/Forms-and-Documents/Integrated-Planning-and-Reporting/Reporting'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  -A 'curl/8.5.0' \
  'https://www.ballina.nsw.gov.au/files/assets/public/v/2/council/documents/council-documents/ballina-shire-council-annual-report-202425-resized.pdf'

# Focused connector tests (19).
TEST_MONGO_URL="mongodb://localhost:27017/ausspend_test_ballinagpfs" \
  npx vitest run --project server server/test/ballina-gpfs.test.ts
```

The focused suite covers annual-report GPFS-section selection and latest discovery (prior-year and
future-year rejection), the `403`→documented-pin WAF fallback, the plain-UA header, the unit gate,
exact zero-tolerance reconciliation (including the net gain on disposal, nil 2025 net loss,
before-capital result and both OCI components), natural-key/idempotency, no-cross-council totals,
and additive-only ingestion.
