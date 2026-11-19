# Narrandera Shire Council — General Purpose Financial Statements (FY2025-26)

Source id `narrandera-gpfs` (NSW local government). One council only; entity-level rows, no
council total and no cross-council or state/federal addition.

## 0. Stale/current-year check (FY2025-26 is the newest)

The work-item title said FY2025-26. The official **Integrated planning and reporting** page was
checked on 2026-11-19 and lists **Annexure F — Audited financial statements for 2025-26** (the year
ended 30 June 2026) as the newest audited standalone statements. The same page lists the 2025-26
Annual Report and other annexures A–I, 2024-25 Annual Report, the Community Strategic Plan,
Operational Plan/Budget 2026-27 and other planning documents; those are narrative or planning
documents, not audited standalone statements. No later (2026-27) audited standalone statements were
published. The connector therefore targets **FY2025-26** and never substitutes the earlier
2024-25/2023-24 document, the narrative annual report, the SPFS or the special schedules. A
404/JS-only later-year link would be recorded as a gap, not a reason to fabricate.

## 1. Source and year

- Publisher: **Narrandera Shire Council**.
- Document: standalone audited **Annexure F — Audited financial statements for 2025-26** for the year
  ended 30 June 2026 — FY2025-26. The 92-page PDF carries the signed GPFS, notes and the independent
  auditor's reports.
- Official page:
  <https://www.narrandera.nsw.gov.au/Council/Governance-and-transparency/Integrated-planning-and-reporting>.
- Current exact PDF:
  <https://www.narrandera.nsw.gov.au/files/content/public/v/34/council/governance-and-transparency/integrated-planning-and-reporting/2026-11-11-annexure-f-audited-financial-statements-for-2025-26.pdf>.
  The same URL is the documented official fallback pin, used when the listing yields no usable
  anchor; the downloaded bytes are SHA-256 verified either way.

## 2. Access, discovery and fetch

The inventory recorded an Edge/Akamai WAF returning `403 text/html` to bare curl, with a browser
fetch required. In this retrieval run (2026-11-19) **both the Integrated planning and reporting page
and the PDF returned `200`** to `curl/8.5.0` (PDF `application/pdf`, 2,679,914 bytes), so no browser
fetch was needed for the live ingest. The connector still sends an explicit plain `curl/8.5.0` UA
(plus a broad PDF/HTML `Accept`) and falls back to the documented official pin if the page is
challenged or yields no usable anchor; a focused test simulates a `403` listing and asserts the pin
fallback. `scripts/narrandera-gpfs-browser.ts` is the documented headless-Chromium fallback for a
challenged run: it loads the official page, parses the link from the cleared HTML and fetches the
exact bytes same-origin. No unofficial mirror was used.

The parser accepts direct `.pdf` uploads whose label or file name contains "Financial Statements"
and rejects the narrative annual report, SPFS/special schedules, public notices, policies and
mirrors. The fiscal year is derived from the anchor label and file name
(`2026-11-11-annexure-f-audited-financial-statements-for-2025-26.pdf` → FY2025-26), not from an
upload-path date.

## 3. Archive (outside the repo)

The exact downloaded bytes are archived outside the repository under the configured source-archive
root, with the relative archive path
`narrandera-gpfs/2026-11-11-annexure-f-audited-financial-statements-for-2025-26.pdf`:

- URL: `https://www.narrandera.nsw.gov.au/files/content/public/v/34/council/governance-and-transparency/integrated-planning-and-reporting/2026-11-11-annexure-f-audited-financial-statements-for-2025-26.pdf`
- retrieval date: 2026-11-19
- bytes: **2,679,914**
- SHA-256: `0996e1544d34fdc1b88d4609034486896ea9f084d9242ae0bb54632e2316d380`
- content type: `application/pdf`

No PDF is committed. The fixture and this note contain only the relative archive path.

## 4. Exact reconciliation (zero tolerance)

The printed unit is explicit `$ '000` on the income statement, comprehensive-income statement and
B1-1. A missing or conflicting unit rejects the whole extraction. Nothing is emitted unless all of
these agree exactly (one thousand dollars is a failure):

| Check | Printed / derived (`$ '000`) | Result |
| --- | --- | --- |
| Total income from continuing operations (Income Statement) | 31,516 | = 3,151,600,000 cents |
| Revenue components sum (rates 12,127 + user charges 3,166 + other revenues 1,354 + operating grants 11,972 + capital grants 1,089 + interest 1,551 + other income 257; 2026 net gain on disposal nil) | 31,516 | = printed total |
| Expense components sum (employee 10,572 + materials 9,259 + borrowing 151 + other 445 + net loss on disposal 818) | 21,245 | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment 6,667 | 27,912 | = total expenses |
| B1-1 Total functions and activities — income | 31,516 | = face total revenue |
| B1-1 Total functions and activities — expenses | 27,912 | = face expense bridge |
| B1-1 Total functions and activities — operating result | 3,604 | = face net result |
| B1-1 grants and contributions | 13,061 | = operating 11,972 + capital 1,089 |
| Total revenue − total expenses | 31,516 − 27,912 = 3,604 | = printed net result (positive) |
| Net result − capital grants | 3,604 − 1,089 = 2,515 | = printed positive before-capital result (evidence only) |
| Comprehensive-income net result | 3,604 | = Income Statement net result |
| Other comprehensive income (single 2026 revaluation component) | 17,143 | = printed other comprehensive income |
| Net result + other comprehensive income | 3,604 + 17,143 = 20,747 | = printed total comprehensive income |

The Income Statement does not print a "Total expenses" line. Total expenses is therefore the
documented bridge of the printed expenses-excluding-depreciation line (21,245) plus the printed
depreciation/amortisation/impairment line (6,667) = 27,912, which equals the printed B1-1 expense
total. The council prints a real net **loss** on disposal of assets (818), emitted as an expense
row; the 2026 net gain on disposal is nil and is not emitted. The net result is positive (3,604)
and the before-capital result is also positive (2,515); the before-capital figure is retained in
reconciliation evidence only. Other comprehensive income has a single printed 2026 component —
revaluation (17,143) — which equals the printed other comprehensive income. The statement prints the
labels `Gain/(loss) on revaluation ...` and `Other comprehensive income for the year` (without a
"Total" prefix), both handled explicitly.

The adapter defers the document with **0 rows** and the exact gap if any printed line is missing,
the unit is not thousands, or any bridge differs. On the audited FY2025-26 report there is no
deferral.

## 5. Extracted entity rows (17, non-additive)

| `gpfs_line_item` | Printed/derived label | `$ '000` | `amount_cents` | Section |
| --- | --- | ---: | ---: | --- |
| `rates_and_annual_charges` | Rates and annual charges | 12,127 | 1,212,700,000 | revenue |
| `user_charges_and_fees` | User charges and fees | 3,166 | 316,600,000 | revenue |
| `other_revenue` | Other revenues | 1,354 | 135,400,000 | revenue |
| `government_grants_operating` | Grants and contributions — operating | 11,972 | 1,197,200,000 | revenue |
| `government_grants_capital` | Grants and contributions — capital | 1,089 | 108,900,000 | revenue |
| `interest_and_investment_income` | Interest and investment income | 1,551 | 155,100,000 | revenue |
| `other_income` | Other income | 257 | 25,700,000 | revenue |
| `total_revenue` | Total income from continuing operations | 31,516 | 3,151,600,000 | revenue |
| `employee_expenses` | Employee benefits and on-costs | 10,572 | 1,057,200,000 | expenses |
| `materials_and_services` | Materials and services | 9,259 | 925,900,000 | expenses |
| `borrowing_costs` | Borrowing costs | 151 | 15,100,000 | expenses |
| `other_expenses` | Other expenses | 445 | 44,500,000 | expenses |
| `net_loss_from_disposal_of_assets` | Net loss from the disposal of assets | 818 | 81,800,000 | expenses |
| `total_expenses_excluding_depreciation` | Total expenses excluding depreciation | 21,245 | 2,124,500,000 | expenses |
| `depreciation_amortisation_impairment` | Depreciation, amortisation and impairment | 6,667 | 666,700,000 | expenses |
| `total_expenses` | Total expenses (documented bridge) | 27,912 | 2,791,200,000 | expenses |
| `net_result` | Net operating result attributable to Council | 3,604 | 360,400,000 | result |

Every row is `jurisdiction_level: "local"`, `jurisdiction: "NSW"`,
`delivery_entity: "Narrandera Shire Council"`, `aggregation_role: "agency_detail"`,
`measure_type: "actual"`, `verified: false`, `data_quality_flag: "provisional/local_government"`.
Government grant rows carry `potential_double_count: true`. The net result is positive, so no
printed-sign marker is stored.

## 6. No-total / no-cross-council rule

- Narrandera Shire Council is one entity. No council total, no state/national total and no sum with
  another council, the `dubbo-council` budget/estimate rows, a government program, the PNFC
  benchmark or the OLG summary layer is created.
- The FY2025-26 column is the reporting boundary; the FY2024-25 comparative is not added.
- Revenue, expenses, components and the net result overlap. They are published rows, not an
  additive spending series.
- Every row is `agency_detail` with no `region_id` and no `location`/LGA allocation.

## 7. Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`)

Targeted ingest of **only `narrandera-gpfs`** against the shared dev DB `ausspend_dev`:

- total measures **999,437 → 999,454** (exactly **+17**);
- GPFS rows (`source_id` matching `/gpfs$/`) **1919 → 1936**;
- active GPFS `data_sources` **103 → 104**;
- SOC rows (`jurisdiction_level: "soc"`) stayed at **205**; every other per-source count unchanged;
- **0** non-`agency_detail` rows, **0** rows with `region_id`/`location`, one `delivery_entity`
  (`Narrandera Shire Council`), all rows `fiscal_year: "2025-26"`, and no council-total/aggregate
  row;
- `data_sources` has the source `active` with `records_ingested: 17`;
- the latest `ingestion_logs` entry for the source is `status: "success"`,
  `records_fetched: 17`, `records_upserted: 17`.

The exact PDF is archived outside the repo at the relative path
`narrandera-gpfs/2026-11-11-annexure-f-audited-financial-statements-for-2025-26.pdf` with the
SHA-256 above; no PDF is committed.

## 8. How to verify

```bash
# Official page and exact FY2025-26 PDF (200 in this retrieval run).
curl -sL -o /dev/null -w '%{http_code}\n' \
  -A 'curl/8.5.0' \
  'https://www.narrandera.nsw.gov.au/Council/Governance-and-transparency/Integrated-planning-and-reporting'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  -A 'curl/8.5.0' \
  'https://www.narrandera.nsw.gov.au/files/content/public/v/34/council/governance-and-transparency/integrated-planning-and-reporting/2026-11-11-annexure-f-audited-financial-statements-for-2025-26.pdf'

# Focused connector tests (19).
TEST_MONGO_URL="mongodb://localhost:27017/ausspend_test_narranderagpfs" \
  npx vitest run --project server server/test/narrandera-gpfs.test.ts
```

The focused suite covers the unit gate, exact reconciliation/zero tolerance (including the positive
net and before-capital results, the net loss on disposal and the single OCI revaluation component),
FY2025-26 acceptance and rejection of 2026-27/2024-25 documents, natural-key/idempotency,
no-cross-council totals, discovery/latest selection (annual report, prior-year and mirror rejection),
the `403`→documented-pin WAF fallback and the plain-UA header.
