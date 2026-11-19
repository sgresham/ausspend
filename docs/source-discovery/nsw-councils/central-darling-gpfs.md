# Central Darling Shire Council — General Purpose Financial Statements (FY2024-25)

Source id `central-darling-gpfs` (NSW local government). One council only; entity-level rows, no
council total and no cross-council or state/federal addition.

**Status: landed — 17 statement rows from the official separate audited General Purpose Financial
Statements for the year ended 30 June 2025 (FY2024-25).** The earlier `DEFERRED` decision was based on
the FY2024-25 **annual report**, whose statutory financial-statements section is scanned images with
no text layer. The council also publishes a separate, machine-readable, audited GPFS PDF on its
public-notice page; that document is the source here, so the deferral is superseded.

## 0. Stale-year check

Checked on 2026-11-20. The official public-notice page
<https://www.centraldarling.nsw.gov.au/Public-notices/Presentation-of-Council-Financial-Statements-at-Council-meeting>
lists:

- the **FY2024-25 separate audited GPFS PDF** `cdsc-annual_financial_statements-2025-olg.pdf`
  (3,386,192 bytes, 102 pages) — ingested;
- the **FY2025-26 public notice** (1 page, 120,015 bytes, SHA-256
  `77a91c3a63721d50819b56e98ca666a4839edeb215007fa91f2e9ec4ae656e97`), which states that the
  ordinary Council meeting on **17 November 2026** would present the audited financial statements and
  Auditor's Reports for the year ending 30 June 2026. The notice prints only summary figures and is
  **not** a full GPFS, so it is not substituted.

No full FY2025-26 audited GPFS PDF was published as at 2026-11-20. FY2024-25 is therefore ingested as
the **latest available full audited GPFS**, explicitly labelled, with no older year substituted.

## 1. Source and year

- Publisher: **Central Darling Shire Council**.
- Document: **General Purpose Financial Statements for the year ended 30 June 2025** — FY2024-25.
- Exact PDF:
  <https://www.centraldarling.nsw.gov.au/files/assets/public/v/1/finance-2025/financial-statements/cdsc-annual_financial_statements-2025-olg.pdf>.
- Reporting page:
  <https://www.centraldarling.nsw.gov.au/Public-notices/Presentation-of-Council-Financial-Statements-at-Council-meeting>.
- The PDF contains the Statement by Councillors and Management, the five primary statements (PDF
  pages 6–10), the notes and B1-1 (PDF page 15), and the independent Auditor-General's reports. The
  statements were authorised for issue on 17 September 2025.

## 2. Access and WAF note

The council host has the **opposite** WAF quirk to most NSW council sites: a plain client UA gets
HTTP 200, while a bare Chrome UA gets HTTP 403.

| Client | Public-notice page | GPFS PDF |
| --- | --- | --- |
| `curl -sSL` with `curl/8.5.0` UA | HTTP 200, `text/html` | HTTP 200, `application/pdf`, 3,386,192 bytes |
| Headless Chromium with `curl/8.5.0` UA | HTTP 200 | HTTP 200 through the browser context request client |

`scripts/central-darling-gpfs-browser.ts` navigates the official public-notice page with the plain
UA, confirms the page lists the pinned `/files/.../cdsc-annual_financial_statements-2025-olg.pdf`
link, and fetches the exact bytes through the browser context request client with a plain-client
fallback. The live browser run on 2026-11-20 reproduced 3,386,192 bytes and the SHA-256 below.

## 3. Archive (outside the repo)

The exact PDF is archived outside the repository by `archiveSourceDocument` and re-verified by
`verifySourceDocument` before parsing:

- bytes: **3,386,192**
- pages: **102**
- SHA-256: **`b583822dce9f5bac927d04dd60455f1de058f8542f990817839e3ed03c53b5c6`**
- `hash_verified: true`

The PDF is not committed to the repository.

## 4. Printed unit and extraction

The printed unit is **`$ '000`** on every primary statement and B1-1. The connector rejects a missing
or conflicting unit and refuses to guess. The primary statements are machine-readable text on PDF
pages 6–10; B1-1 is PDF page 15.

## 5. Reconciliation (all zero tolerance)

| Check | Printed values ($'000) |
| --- | --- |
| Revenue components = total income | 2,547 + 5,820 + 865 + 15,844 + 6,835 + 180 + 44 = **32,135** |
| Expense components = printed expenses excluding depreciation | 7,372 + 20,804 + 75 + 626 + 1,932 = **30,809** |
| Expenses excluding depreciation + depreciation/amortisation/impairment = total expenses bridge | 30,809 + 7,041 = **37,850** |
| Total income − total expenses = net result | 32,135 − 37,850 = **−5,715** |
| Net result − capital grants = before-capital result | −5,715 − 6,835 = **−12,550** |
| B1-1 income / expenses / result / grants / carrying amount | **32,191 / 37,906 / −5,715 / 22,679 / 304,214** |
| B1-1 internal charge/recovery allocation (equal on both sides) | **56** (32,191 − 32,135 = 37,906 − 37,850) |
| Comprehensive income | net result −5,715 + IPPE revaluation 28,893 = **23,178** |
| Balance sheet | assets 304,214 − liabilities 9,887 = net assets **294,327**; accumulated surplus 181,150 + IPPE revaluation 113,177 = total equity **294,327** |
| Cash flows | operating 9,743 + investing (13,507) + financing (535) = net change **−4,299**; opening 14,734 − 4,299 = closing **10,435** |

The face Income Statement does not print a separate "Total expenses" line. B1-1 includes a printed
internal charge/recovery allocation of **$56 thousand** on both income and expenses; the B1-1 result,
grants and carrying amount reconcile to the face statements, and the equal allocation is checked as a
documented bridge rather than netted away.

## 6. Ingested rows

`central-darling-gpfs` emits **17** non-additive `agency_detail` rows (7 revenue components + total
revenue, 5 expense components + expenses-excluding-depreciation + depreciation + total-expenses
bridge, and net result), all `provisional/local_government`, `verified: false`, with no
`region_id`/LGA allocation. Government grants and contributions are marked
`potential_double_count`. The net result is stored as a magnitude with `gpfs_printed_sign:
"negative"`. No council total, no cross-council row, no state/federal addition.

## 7. Verification

- Focused test: `npx vitest run server/test/central-darling-gpfs.test.ts` (17 tests, including
  browser, plain-fallback, unit-gate, reconciliation-failure, golden-digest and idempotent-ingest
  checks).
- Live browser fetch: `npx tsx scripts/central-darling-gpfs-browser.ts` — 3,386,192 bytes, SHA-256
  `b583822dce9f5bac927d04dd60455f1de058f8542f990817839e3ed03c53b5c6`.
- Typecheck: `npm run typecheck -w server`.
- Lint: `npx eslint server/src/connectors/central-darling-gpfs
  scripts/central-darling-gpfs-browser.ts server/test/central-darling-gpfs.test.ts`.
- Docs counts: `npm run generate:connectors && npm run generate:sources` then
  `npm run check:doc-counts`.
