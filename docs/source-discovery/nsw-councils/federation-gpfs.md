# Federation Council — General Purpose Financial Statements (FY2024-25, latest available)

Source id `federation-gpfs` (NSW local government). One council only; entity-level rows, no council
aggregate and no cross-council or state/federal addition.

**Status: landed — 17 statement rows from the official audited Annual Financial Statements
2024-2025, which embed the General Purpose Financial Statements.** The cheap-check premise (the
`/files` endpoint is WAF-blocked to plain clients and needs a browser) is **confirmed for plain
clients** and **falsified for a real browser session**: headless Chromium reaches the Annual
Financial Statements page and fetches the exact official `/files` PDF. No mirror, cache, or invented
URL is used.

The premise falsifier — "an official current audited GPFS/FS is retrievable" — resolves to
**FY2024-25 only**: as at 2026-11-20 the council had not published FY2025-26 annual financial
statements. FY2024-25 is therefore the latest available audited GPFS and is explicitly labelled as
such; no older year is substituted.

## 0. Stale-year check

Checked on **2026-11-20**. The official **Annual Financial Statements** page
<https://www.federationcouncil.nsw.gov.au/Council/Corporate-Planning/Reporting/Annual-Financial-Statements>
lists the newest financial statements as:

- `Annual Financial Statements 2024-2025 (PDF, 5MB)` — the audited Annual Financial Statements
  (ingested here; it incorporates the GPFS, the Special Purpose Financial Statements and the Special
  Schedules);
- `Annual Financial Statements 2023-2024`, `2022-2023`, … `2016-2017` — older years.

The same site's **Annual Report** page
<https://www.federationcouncil.nsw.gov.au/Council/Corporate-Planning/Reporting/Annual-Report>
presents the **2024-2025** Annual Report as current and lists only older annual reports below it.
Neither page links any FY2025-26 annual financial statements or FY2025-26 annual report as at
2026-11-20. The FY2024-25 AFS is the latest published audited GPFS; the narrative FY2024-25 Annual
Report is **not** substituted for it and is not ingested.

## 1. Source and year

- Publisher: **Federation Council**.
- Document: **Annual Financial Statements 2024-2025** — GPFS for the year ended **30 June 2025**
  (FY2024-25). The PDF is **4,790,806 bytes**, **114 physical pages**, and contains the GPFS
  (Income Statement PDF p5, Statement of Comprehensive Income p6, Statement of Financial Position
  p7, Statement of Changes in Equity p8, Statement of Cash Flows p9, B1-1 functions PDF p14), the
  notes, the Special Purpose Financial Statements (p89+), the Special Schedules (p104+), and the
  Auditor-General's reports.
- Reporting page (human-facing):
  <https://www.federationcouncil.nsw.gov.au/Council/Corporate-Planning/Reporting/Annual-Financial-Statements>.
- Exact AFS PDF (documented official pin):
  <https://www.federationcouncil.nsw.gov.au/files/assets/public/v/1/document-library/corporate-documents/other/financial-statements/federation-council-annual_financial_statements-2025.pdf>.
- Current narrative annual report on the same site (not ingested):
  <https://www.federationcouncil.nsw.gov.au/files/assets/public/v/2/document-library/corporate-documents/plans-amp-strategies-ampipampr/2024-2025-strategic-documents/annual-report-2024-2025-v1.1.pdf>.
- Audit opinion: the PDF embeds the Auditor-General's **unmodified** opinions on the General Purpose
  Financial Statements (PDF pages 76-80) and the Special Purpose Financial Statements (PDF pages
  101-102); page 77 states "I expressed an unmodified opinion on the Council's GPFS."

## 2. Access, discovery and fetch

The official site is behind **Akamai** bot protection. On 2026-11-20 plain clients were blocked
("Access Denied", Akamai reference `#18.…`); a real browser session was not:

| Client | Home page | `robots.txt` / sitemap | AFS PDF (`/files/...`) |
| --- | --- | --- | --- |
| `curl` (Chrome-like UA) | HTTP 403, ~392 bytes | HTTP 403 | HTTP 403 |
| Headless Chromium (Playwright) | HTTP 200, HTML | HTTP 200 (home) | HTTP 200, `application/pdf`, 4,790,806 bytes |

The 403 body is an Akamai "Access Denied" HTML page, not a JavaScript challenge. Headless Chromium
renders the Annual Financial Statements page, which exposes the FY2024-25 upload as a root-relative
`/files/assets/...` link; the pinned PDF is fetched from within that browser session
(`page.evaluate(fetch(..., {credentials: 'include'}))`), so the WAF session cookies apply. Only the
exact official upload is fetched; the adapter does not crawl or mirror the file tree.

`scripts/federation-gpfs-browser.ts` navigates the official Annual Financial Statements page in
headless Chromium, confirms the pinned upload is listed in the rendered HTML, fetches the exact PDF,
and prints its SHA-256 and byte count. It falls back to a plain client only when forced (tests); on
the live site the plain path is expected to return HTTP 403.

Reproduce the gate:

```bash
# plain client: 403
curl -s -o /dev/null -w '%{http_code}\n' -A 'Mozilla/5.0 (X11; Linux x86_64) Chrome/131.0' \
  https://www.federationcouncil.nsw.gov.au/
# real browser/WAF path: 200 + application/pdf + SHA-256
npx tsx scripts/federation-gpfs-browser.ts
```

Verified live on 2026-11-20: the browser path returned `application/pdf`, **4,790,806 bytes**,
SHA-256 `7dbdc2a08b4f03e217f1112db1684c1302363d6632ce2660c1f8717779426ca5`.

## 3. Archive (outside the repo)

The exact downloaded bytes are archived outside the repository under the configured source-archive
root, at the relative archive path
`federation-gpfs/federation-council-annual_financial_statements-2025.pdf`:

- URL: `https://www.federationcouncil.nsw.gov.au/files/assets/public/v/1/document-library/corporate-documents/other/financial-statements/federation-council-annual_financial_statements-2025.pdf`
- retrieval date: 2026-11-20
- bytes: **4,790,806**
- SHA-256: `7dbdc2a08b4f03e217f1112db1684c1302363d6632ce2660c1f8717779426ca5`
- content type: `application/pdf`
- hash verified: yes (`archiveSourceDocument` + `verifySourceDocument`).

## 4. Rows and reconciliation

Printed unit: **`$ '000`**, detected explicitly on every face statement and B1-1; a missing or
conflicting unit is rejected, never defaulted. The connector emits **17 printed Income Statement
lines**: 7 revenue components plus total income (8), 5 expense components plus the printed
expenses-excluding-depreciation subtotal, depreciation, the documented total-expenses bridge and the
net loss on asset disposals (8), and the net result (1). All rows are
`aggregation_role: "agency_detail"`, `jurisdiction_level: "local"`, no `region_id`/LGA, so they can
never be summed into another council or into state/federal spending.

Zero-tolerance reconciliation (all in `$ '000`):

- Revenue components: rates 22,913 + user charges 11,411 + other revenues 1,084 + operating grants
  13,299 + capital grants 5,590 + interest 3,390 + net gain on asset disposals 0 = **57,687** =
  printed total income.
- Expense components: employee 17,354 + materials 17,561 + borrowing 525 + other 575 + net loss on
  asset disposals 926 = **36,941** = printed expenses excluding depreciation.
- Total expenses bridge: 36,941 + depreciation/amortisation/impairment **18,288** = **55,229**,
  equal to the printed B1-1 expense total.
- Net result: 57,687 − 55,229 = **2,458**; before capital grants: 2,458 − 5,590 = **−3,132**.
- B1-1: income **57,687**, expenses **55,229**, operating result **2,458**, grants **18,889**
  (13,299 operating + 5,590 capital), carrying amount **966,188**.
- Comprehensive income: net result 2,458 + other comprehensive income **60,273** (the single IPPE
  revaluation component, equal to the Statement of Changes in Equity's 59,444 revaluation plus 829
  impairment loss reversal) = total comprehensive income **62,731**.
- Statement of Financial Position: total assets **966,188** = current 85,512 + non-current 880,676;
  total liabilities **33,887** = current 10,708 + non-current 23,179; net assets **932,301** =
  accumulated surplus 550,813 + IPPE revaluation surplus 381,488 = total equity.
- Statement of Changes in Equity: opening 869,570 + total comprehensive income 62,731 = closing
  **932,301**; opening accumulated surplus 548,355 + net result 2,458 = closing accumulated surplus
  550,813; opening IPPE revaluation surplus 321,215 + revaluation 60,273 = closing 381,488.
- Statement of Cash Flows: operating 12,160 + investing −29,233 + financing −949 = net change
  **−18,022**; opening 24,964 + net change = closing **6,942** = the SoFP cash.

## 5. Tests and registration

- `server/test/federation-gpfs.test.ts` covers browser discovery/fetch, stale-year refusal, the
  explicit-$'000 unit gate, conflicting-unit rejection, reconciliation failure, entity-only rows,
  natural-key stability, and additive-only idempotent ingestion.
- `server/test/gpfs-modules-golden.test.ts` exercises the banked fixture via
  `server/test/generated-gpfs-fixtures.ts` (row count 17, golden digest).
- Registered through `scripts/generate-connector-manifest.mjs`; the source doc is generated from
  the connector registry.
- Every row is `provisional/local_government`, `verified: false`; no totals are published and
  nothing is summed into another source.

## 6. Caveats

- Licence: © Federation Council. The document is used for public-interest research; this is not an
  open-data licence grant.
- FY2024-25 is the **latest available** audited GPFS as at 2026-11-20, not the newest possible
  statutory year. When FY2025-26 AFS are published they must be added as a new year, not merged or
  substituted into these rows.
- The AFS document also contains Special Purpose Financial Statements (water, sewerage, domestic
  waste) and Special Schedules; only the GPFS Income Statement / B1-1 statement lines are ingested.
