# Oberon Council — General Purpose Financial Statements (FY2024-25)

Source id `oberon-gpfs` (NSW local government). One council only; entity-level rows, no council
total and no cross-council or state/federal addition.

**Status: landed — 17 statement rows from the official separate audited General Purpose Financial
Statements for the year ended 30 June 2025 (FY2024-25).** The known gap was that the main Integrated
Planning & Reporting page exposes only a 52 MB combined annual report bundle and no standalone GPFS
after FY2021-22. That premise is superseded: the official **Have Your Say Oberon** page for the
2024/2025 audited financial statements publishes a separate GPFS PDF in its Documents tab.

## 0. Stale-year check

Checked on 2026-11-20.

- The main IP&R page
  <https://www.oberon.nsw.gov.au/Council/Integrated-Planning-Reporting> lists the **Annual Report
  2024-2025** bundle (54,350,198 bytes) as the latest annual report, plus the older 2023-24 and
  2022-23 bundles and the FY2021-22 standalone financial statements. It does not expose a separate
  FY2024-25 GPFS.
- The official Have Your Say page
  <https://haveyoursay.oberon.nsw.gov.au/2024-2025-audited-financial-statements> presents the
  audited financial statements and Auditor's Reports for the year ending 30 June 2025 to the
  Ordinary Council Meeting on **18 November 2025**. Its Documents tab lists:
  - **General Purpose Annual Financial Statements - 2025 (6.79 MB)** — ingested;
  - Special Purpose Annual Financial Statements - 2025 (1.39 MB);
  - Special Schedules Annual Financial Statements - 2025 (10 MB).
- No full FY2025-26 audited GPFS was published as at 2026-11-20. FY2024-25 is therefore ingested as
  the **latest available full audited GPFS**, explicitly labelled, with no older year substituted.

## 1. Source and year

- Publisher: **Oberon Council**.
- Document: **General Purpose Financial Statements for the year ended 30 June 2025** — FY2024-25.
- Stable official document entry point (triggers the official browser download):
  <https://haveyoursay.oberon.nsw.gov.au/104015/widgets/476199/documents/318527>.
- Reporting/exhibition page:
  <https://haveyoursay.oberon.nsw.gov.au/2024-2025-audited-financial-statements>.
- The PDF is named `Annual_Financial_Statements-GPFS-2025 Complete.pdf` and contains the Statement by
  Councillors and Management, the five primary statements (PDF pages 4–8), the notes and B1-1 (PDF
  page 13), and the independent Auditor-General's reports. The GPFS opinion is unmodified and dated
  24 October 2025.

## 2. Access and WAF note

The main council site gives a plain client UA HTTP 200 but a bare Chrome UA HTTP 403. The Have Your
Say Oberon host serves the plain UA and triggers the official document download from the stable
document entry point.

| Client | Have Your Say page | GPFS PDF |
| --- | --- | --- |
| `curl` with `curl/8.5.0` UA | HTTP 200, `text/html` | document page returns the Documents HTML; the download is triggered by the page |
| Headless Chromium with `curl/8.5.0` UA | HTTP 200 | official download captured through Playwright's download event |

`scripts/oberon-gpfs-browser.ts` navigates the official project page, opens the pinned document entry
point, captures the browser download, and checks that the suggested filename is the FY2024-25 GPFS
PDF. The live browser run on 2026-11-20 captured 7,118,843 bytes and the SHA-256 below.

## 3. Archive (outside the repo)

The exact PDF is archived outside the repository by `archiveSourceDocument` and re-verified by
`verifySourceDocument` before parsing:

- bytes: **7,118,843**
- pages: **80**
- SHA-256: **`ef24ded09ec28724e7b622f97860685c606eeec42b6b31f38b59088ac866a630`**
- `hash_verified: true`

The PDF is not committed to the repository. The resolved S3 download URL is recorded as evidence but
is signed and expiring; the stable source is the official document page above.

## 4. Printed unit and extraction

The printed unit is **`$ '000`** on every primary statement and B1-1. The connector rejects a missing
or conflicting unit and refuses to guess. The primary statements are machine-readable text on PDF
pages 4–8; B1-1 is PDF page 13.

## 5. Reconciliation (all zero tolerance)

| Check | Printed values ($'000) |
| --- | --- |
| Revenue components = total income | 7,429 + 4,685 + 381 + 4,030 + 10,757 + 1,363 + 302 = **28,947** |
| Expense components = printed expenses excluding depreciation | 8,385 + 6,956 + 167 + 708 + 2,390 = **18,606** |
| Expenses excluding depreciation + depreciation/amortisation/impairment = total expenses bridge | 18,606 + 7,216 = **25,822** |
| Total income − total expenses = net result | 28,947 − 25,822 = **3,125** |
| Net result − capital grants = before-capital result | 3,125 − 10,757 = **−7,632** |
| B1-1 income / expenses / result / grants / carrying amount | **28,947 / 25,822 / 3,125 / 14,787 / 394,496** |
| Comprehensive income | net result 3,125 + IPPE revaluation 13,354 = **16,479** |
| Balance sheet | assets 394,496 − liabilities 7,289 = net assets **387,207**; accumulated surplus 175,846 + IPPE revaluation 211,361 = total equity **387,207** |
| Cash flows | operating 5,059 + investing (5,832) + financing (674) = net change **−1,447**; opening 7,463 − 1,447 = closing **6,016** |

The face Income Statement does not print a separate "Total expenses" line. B1-1 equals the face
statements exactly: income 28,947, expenses 25,822, result 3,125, grants 14,787 and carrying amount
394,496. There is no internal allocation difference.

## 6. Ingested rows

`oberon-gpfs` emits **17** non-additive `agency_detail` rows (7 revenue components + total revenue,
5 expense components + expenses-excluding-depreciation + depreciation + total-expenses bridge, and
net result), all `provisional/local_government`, `verified: false`, with no `region_id`/LGA
allocation. Government grants and contributions are marked `potential_double_count`. No council
total, no cross-council row, no state/federal addition.

## 7. Verification

- Focused test: `npx vitest run server/test/oberon-gpfs.test.ts` (17 tests, including browser
  download, plain-test path, unit-gate, reconciliation-failure, golden-digest and idempotent-ingest
  checks).
- Live browser fetch: `npx tsx scripts/oberon-gpfs-browser.ts` — 7,118,843 bytes, SHA-256
  `ef24ded09ec28724e7b622f97860685c606eeec42b6b31f38b59088ac866a630`.
- Typecheck: `npm run typecheck -w server`.
- Lint: `npx eslint server/src/connectors/oberon-gpfs scripts/oberon-gpfs-browser.ts
  server/test/oberon-gpfs.test.ts`.
- Docs counts: `npm run generate:connectors && npm run generate:sources` then
  `npm run check:doc-counts`.
