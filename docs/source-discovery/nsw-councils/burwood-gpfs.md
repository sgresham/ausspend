# Burwood Council — General Purpose Financial Statements (FY2025-26)

Source id `burwood-gpfs` (NSW local government). One council only; entity-level rows, no council
total and no cross-council or state/federal addition.

**Status: landed — 18 statement rows from the official standalone audited Annual Financial Statements
for the year ended 30 June 2026.** The prior `BURWOOD_GPFS_DEFERRED.md` decision was based on the
FY2024-25 narrative annual report, which is summary-only. The premise falsifier for this item is a
current official audited GPFS: the council's official consultation host publishes the FY2025-26
audited Annual Financial Statements (with the Auditor-General's unmodified opinion), so the deferral
is superseded and the exact printed rows are ingested.

## 0. Stale-year check

The work item was opened on 2026-11-19. On 2026-11-20:

- The council's Reports page still lists only the **Annual Report 2023-2024**, **Annual Report
  2024-2025** and the **State of Our City Report 2021-2024**; the 2024-25 annual report (38 pages,
  SHA-256 `66a268845ccf33cea9567c878ce3aa65f69aead32970a7ff122fb55d6bec176b`) is summary-only.
- The official consultation host publishes **Annual Financial Statements for the year ended 30 June
  2026** at
  <https://participate.burwood.nsw.gov.au/annual-financial-statement-year-ended-30-june-2026>,
  stating that the ordinary Council Meeting on **27 October 2026** included the audited Financial
  Statements and Auditor's Report for the year ending 30 June 2026.
- The exhibition page's Document Library links **`Annual financial statements 2026` PDF (4.24 MB)**
  at <https://participate.burwood.nsw.gov.au/download_file/2459/1036>.

No FY2025-26 narrative annual report was published as at 2026-11-20, so the current audited FS is
the FY2025-26 GPFS and is ingested as such; no older-year report is substituted.

## 1. Source and year

- Publisher: **Burwood Council**.
- Document: **Annual Financial Statements for the year ended 30 June 2026** — FY2025-26. The PDF is
  **4,450,607 bytes**, **70 physical pages**, and contains the Statement by Councillors and
  Management, the GPFS primary statements (Income Statement p5, Statement of Comprehensive Income
  p6, Statement of Financial Position p7, Statement of Changes in Equity p8, Statement of Cash Flows
  p9), B1-1 functions p14, the notes, and the independent Auditor-General's report (p68) with an
  unmodified opinion dated 20 October 2026. The statements were authorised for issue by Council on
  22 September 2026.
- Reporting/exhibition page:
  <https://participate.burwood.nsw.gov.au/annual-financial-statement-year-ended-30-june-2026>.
- Exact audited PDF:
  <https://participate.burwood.nsw.gov.au/download_file/2459/1036>.
  The same URL is the documented official fallback pin.

The prior deferral's premise (annual-report-only, no standalone audited FS) is **falsified** by the
FY2025-26 Annual Financial Statements PDF.

## 2. Access, discovery and fetch

The council's main site (`www.burwood.nsw.gov.au`) is behind Akamai: a plain client gets HTTP 403
("Access Denied") for the home page and `/files` paths. The official consultation host
(`participate.burwood.nsw.gov.au`) is not WAF-blocked.

| Client | Exhibition page | PDF |
| --- | --- | --- |
| `curl -sSL` (Chrome UA) | HTTP 200, `text/html` | HTTP 302 → HTTP 200, `application/pdf`, 4,450,607 bytes |
| Headless Chromium (Playwright, Chrome 131 UA) | HTTP 200 | HTTP 200 (browser fetch), 4,450,607 bytes |

`scripts/burwood-gpfs-browser.ts` navigates the official exhibition page, confirms the Document
Library still lists the pinned `/download_file/2459/1036` upload, and fetches the exact PDF bytes
through the browser first with a plain-client fallback. The live browser run on 2026-11-20 produced
the same 4,450,607 bytes and SHA-256 as the plain fetch.

## 3. Archive (outside the repo)

The exact PDF is archived outside the repository by `archiveSourceDocument` and re-verified by
`verifySourceDocument` before parsing:

- bytes: **4,450,607**
- pages: **70**
- SHA-256: **`9b6e3f8725e47823038329b269d955ef263d7cc6680aacea9b944320919f2e13`**
- `hash_verified: true`

The PDF is not committed to the repository.

## 4. Printed unit and extraction

The printed unit is **`$ '000`** on every primary statement and B1-1. The connector rejects a
missing or conflicting unit and refuses to guess.

The Income Statement PDF lays its text out in overlapping text runs, so `parse.ts` reconstructs
visual rows from the positioned text items and reads the actual-2026 column (x≈443) and
actual-2025 column (x≈513) directly, accumulating multi-line printed labels. The original unaudited
budget column is never ingested.

## 5. Reconciliation (all zero tolerance)

| Check | Printed values ($'000) |
| --- | --- |
| Revenue components = total income | 43,883 + 12,019 + 6,474 + 4,277 + 15,821 + 2,931 + 3,846 + 0 = **89,251** |
| Expense components = printed expenses excluding depreciation | 26,800 + 28,667 + 409 + 1,239 + 2,640 = **59,755** |
| Expenses excluding depreciation + depreciation/amortisation/impairment = total expenses bridge | 59,755 + 10,654 = **70,409** |
| Total income − total expenses = net result | 89,251 − 70,409 = **18,842** |
| Net result − capital grants = before-capital result | 18,842 − 15,821 = **3,021** |
| B1-1 income / expenses / result / grants / carrying amount | **89,251 / 70,409 / 18,842 / 20,098 / 697,329** |
| Comprehensive income | net result 18,842 + IPPE revaluation 21,728 = **40,570** |
| Balance sheet | assets 697,329 − liabilities 28,931 = net assets **668,398**; accumulated surplus 302,006 + IPPE revaluation 366,392 = total equity **668,398** |
| Cash flows | operating 29,599 + investing (32,015) + financing 3,870 = net change **1,454**; closing cash 10,615 − net change 1,454 = prior-year cash **9,161** |

The B1-1 "Total functions and activities" row is the documented total-expense bridge; the face
Income Statement does not print a separate "Total expenses" line.

## 6. Ingested rows

`burwood-gpfs` emits **18** non-additive `agency_detail` rows (8 revenue components + total revenue,
5 expense components + expenses-excluding-depreciation + depreciation + total-expenses bridge, and
net result), all `provisional/local_government`, `verified: false`, with no `region_id`/LGA
allocation. Government grants and contributions are marked `potential_double_count`. No council
total, no cross-council row, no state/federal addition.

## 7. Verification

- Focused test: `npx vitest run server/test/burwood-gpfs.test.ts` (17 tests, including browser,
  plain-fallback, unit-gate, reconciliation-failure, golden-digest and idempotent-ingest checks).
- Live browser fetch: `npx tsx scripts/burwood-gpfs-browser.ts` — 4,450,607 bytes, SHA-256
  `9b6e3f8725e47823038329b269d955ef263d7cc6680aacea9b944320919f2e13`.
- Typecheck: `npm run typecheck -w server`.
- Lint: `npx eslint server/src/connectors/burwood-gpfs scripts/burwood-gpfs-browser.ts
  server/test/burwood-gpfs.test.ts`.
- Docs counts: `npm run generate:connectors && npm run generate:sources` then
  `npm run check:doc-counts`.
