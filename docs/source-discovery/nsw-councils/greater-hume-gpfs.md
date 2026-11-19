# Greater Hume Shire Council — General Purpose Financial Statements (FY2025-26)

Source id `greater-hume-gpfs` (NSW local government). One council only; entity-level rows, no
council aggregate and no cross-council or state/federal addition.

**Status: landed — 18 statement rows from the current official audited Annual Financial Statements
2025-2026, which embed the General Purpose Financial Statements.** The cheap-check premise (the
`/files` endpoint is WAF-blocked to plain clients and needs a browser) is **confirmed for plain
clients** and **falsified for a real browser session**: headless Chromium reaches the official
Financial Statements page and fetches the exact official `/files` PDF. No mirror, cache, or invented
URL is used.

The premise falsifier — "an official current audited GPFS/FS is retrievable" — **holds for
FY2025-26**. Council's Financial Statements page states that the 18 November 2026 Ordinary Council
meeting included the presentation of the audited Financial Statements and the Auditor's Reports
for the year ended 30 June 2026, and links the audited FY2025-26 document. That current document is
ingested; the older FY2024-25 financial statements on Documents and Policies are not substituted.

## 0. Stale-year check

Checked on **2026-11-20**. Two official pages matter:

- The **Financial Statements** exhibition page
  <https://www.greaterhume.nsw.gov.au/Your-Greater-Hume-Council/Have-Your-Say-On-Exhibition/Financial-Statements>
  states: "the Ordinary Council meeting to be held on Wednesday, 18 November 2026 will include the
  presentation of the audited Financial Statements and the Auditor's Reports for the financial year
  ended 30 June 2026", invites submissions until 5pm Wednesday 25 November 2026, and links
  `Annual Financial Statements (PDF, 25MB)` — the **FY2025-26** audited document ingested here.
- The **Documents and Policies** page
  <https://www.greaterhume.nsw.gov.au/Your-Greater-Hume-Council/Documents-and-Policies> also lists
  older statements, including `Financial Statement for the year ended 30 June 2025 (PDF, 25MB)` and
  `Annual Report 2025 (PDF, 41MB)`. These are the prior year and the narrative annual report; they
  are **not** ingested or substituted.

No FY2025-26 narrative Annual Report was linked as at 2026-11-20; the current audited financial
statements are the correct current source. The FY2025-26 statements are audited and published for
public exhibition; submissions close 25 November 2026.

## 1. Source and year

- Publisher: **Greater Hume Shire Council**.
- Document: **Annual Financial Statements 2025-2026** — GPFS for the year ended **30 June 2026**
  (FY2025-26). The PDF is **26,114,412 bytes**, **122 physical pages**, and contains the GPFS
  (Income Statement PDF p8, Statement of Comprehensive Income p9, Statement of Financial Position
  p10, Statement of Changes in Equity p11, Statement of Cash Flows p12, B1-1 functions PDF p18),
  the notes, the Special Purpose Financial Statements (p97+), the Special Schedules (p111+), and the
  Auditor-General's reports.
- Reporting page (human-facing):
  <https://www.greaterhume.nsw.gov.au/Your-Greater-Hume-Council/Have-Your-Say-On-Exhibition/Financial-Statements>.
- Exact AFS PDF (documented official pin):
  <https://www.greaterhume.nsw.gov.au/files/sharedassets/public/v/1/have-your-say/2026/greater-hume-council-financial-statements-2025-2026-final.pdf>.
- Audit opinion: the PDF embeds the Auditor-General's **unmodified** opinions on the General Purpose
  Financial Statements (PDF pages 88-89) and the Special Purpose Financial Statements (PDF page
  108); the auditor states "I expressed an unmodified opinion on the Council's GPFS."

## 2. Access, discovery and fetch

The official site is behind **Akamai** bot protection. On 2026-11-20 plain clients were blocked
("Access Denied", Akamai reference `#18.…`); a real browser session was not:

| Client | Home page | `robots.txt` / sitemap | AFS PDF (`/files/...`) |
| --- | --- | --- | --- |
| `curl` (Chrome-like UA) | HTTP 403, 388 bytes | HTTP 403, ~398 bytes | HTTP 403, 566 bytes |
| Headless Chromium (Playwright) | HTTP 200, HTML | HTTP 200 (home) | HTTP 200, `application/pdf`, 26,114,412 bytes |

The 403 body is an Akamai "Access Denied" HTML page, not a JavaScript challenge. Headless Chromium
renders the Financial Statements page, which exposes the FY2025-26 upload as a root-relative
`/files/sharedassets/...` link; the pinned PDF is fetched from within that browser session
(`page.evaluate(fetch(..., {credentials: 'include'}))`), so the WAF session cookies apply. Only the
exact official upload is fetched; the adapter does not crawl or mirror the file tree.

`scripts/greater-hume-gpfs-browser.ts` navigates the official Financial Statements page in headless
Chromium, confirms the pinned upload is listed in the rendered HTML, fetches the exact PDF, and
prints its SHA-256 and byte count. It falls back to a plain client only when forced (tests); on the
live site the plain path is expected to return HTTP 403.

Reproduce the gate:

```bash
# plain client: 403
curl -s -o /dev/null -w '%{http_code}\n' -A 'Mozilla/5.0 (X11; Linux x86_64) Chrome/131.0' \
  https://www.greaterhume.nsw.gov.au/
# real browser/WAF path: 200 + application/pdf + SHA-256
npx tsx scripts/greater-hume-gpfs-browser.ts
```

Verified live on 2026-11-20: the browser path returned `application/pdf`, **26,114,412 bytes**,
SHA-256 `f181da5b9a70f33ec4c2a2ee5fbac7b0eae5ebd4162e91624226c675fefe9db5`.

## 3. Archive (outside the repo)

The exact downloaded bytes are archived outside the repository under the configured source-archive
root, at the relative archive path
`greater-hume-gpfs/greater-hume-council-financial-statements-2025-2026-final.pdf`:

- URL: `https://www.greaterhume.nsw.gov.au/files/sharedassets/public/v/1/have-your-say/2026/greater-hume-council-financial-statements-2025-2026-final.pdf`
- retrieval date: 2026-11-20
- bytes: **26,114,412**
- SHA-256: `f181da5b9a70f33ec4c2a2ee5fbac7b0eae5ebd4162e91624226c675fefe9db5`
- content type: `application/pdf`
- hash verified: yes (`archiveSourceDocument` + `verifySourceDocument`).

## 4. Rows and reconciliation

Printed unit: **`$ '000`**, detected explicitly on every face statement and B1-1; a missing or
conflicting unit is rejected, never defaulted. The connector emits **18 printed Income Statement
lines**: 8 revenue components plus total income (9), 5 expense components plus the printed
expenses-excluding-depreciation subtotal, depreciation, the documented total-expenses bridge and the
net loss on asset disposals (8), and the net result (1). All rows are
`aggregation_role: "agency_detail"`, `jurisdiction_level: "local"`, no `region_id`/LGA, so they can
never be summed into another council or into state/federal spending.

Zero-tolerance reconciliation (all in `$ '000`):

- Revenue components: rates 15,482 + user charges 9,875 + other revenues 2,108 + operating grants
  19,622 + capital grants 1,494 + interest 1,622 + other income 239 + net gain on asset disposals
  1,258 = **51,700** = printed total income.
- Expense components: employee 15,967 + materials 15,860 + borrowing 175 + other 1,907 + net loss on
  asset disposals 0 = **33,909** = printed expenses excluding depreciation.
- Total expenses bridge: 33,909 + depreciation/amortisation/impairment **18,106** = **52,015**,
  equal to the printed B1-1 expense total.
- Net result: 51,700 − 52,015 = **−315**; before capital grants: −315 − 1,494 = **−1,809**.
- B1-1: income **51,700**, expenses **52,015**, operating result **−315**, grants **21,116**
  (19,622 operating + 1,494 capital), carrying amount **981,118**.
- Comprehensive income: net result −315 + other comprehensive income **31,285** (the single IPPE
  revaluation component) = total comprehensive income **30,970**.
- Statement of Financial Position: total assets **981,118** = current 50,939 + non-current 930,179;
  total liabilities **16,658** = current 10,647 + non-current 6,011; net assets **964,460** =
  accumulated surplus 289,952 + IPPE revaluation surplus 674,508 = total equity.
- Statement of Changes in Equity: opening 933,490 + total comprehensive income 30,970 = closing
  **964,460**; opening accumulated surplus 290,267 + net result −315 = closing accumulated surplus
  289,952; opening IPPE revaluation surplus 643,223 + revaluation 31,285 = closing 674,508.
- Statement of Cash Flows: operating 20,747 + investing −18,266 + financing −404 = net change
  **2,077**; opening 14,648 + net change = closing **16,725** = the SoFP cash.

## 5. Tests and registration

- `server/test/greater-hume-gpfs.test.ts` covers browser discovery/fetch, stale-year refusal, the
  explicit-$'000 unit gate, conflicting-unit rejection, reconciliation failure, entity-only rows,
  natural-key stability, and additive-only idempotent ingestion.
- `server/test/gpfs-modules-golden.test.ts` exercises the banked fixture via
  `server/test/generated-gpfs-fixtures.ts` (row count 18, golden digest).
- Registered through `scripts/generate-connector-manifest.mjs`; the source doc is generated from
  the connector registry.
- Every row is `provisional/local_government`, `verified: false`; no totals are published and
  nothing is summed into another source.

## 6. Caveats

- Licence: © Greater Hume Shire Council. The document is used for public-interest research; this is
  not an open-data licence grant.
- The FY2025-26 statements were presented to Council on 18 November 2026 and were on public
  exhibition until 25 November 2026. They are audited; if the exhibited document is later replaced,
  the pinned SHA-256 will change and a fresh ingestion must be recorded rather than silently mixed.
- The AFS document also contains Special Purpose Financial Statements (water and sewerage) and
  Special Schedules; only the GPFS Income Statement / B1-1 statement lines are ingested.
