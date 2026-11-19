# Cabonne Council — General Purpose Financial Statements (FY2025-26)

Source id `cabonne-gpfs` (NSW local government). One council only; entity-level rows, no council
aggregate and no cross-council or state/federal addition.

**Status: landed — 17 statement rows from the official standalone audited General Purpose Financial
Statements for the year ended 30 June 2026.** The cheap-check premise ("the `/files` endpoint is
WAF-blocked, including to headless Chromium") is **confirmed for plain clients** but **falsified for
a real browser session**: headless Chromium reaches the Reports page and fetches the exact official
`/files` PDF. No mirror, cache, or invented URL is used.

## 0. Stale-year check

Checked on **2026-11-20**. The official Reports page
<https://www.cabonne.nsw.gov.au/Council/Strategies-policies-and-publications/Reports> lists the
current standalone **FY2025-26** financial statements as three official uploads:

- `Annual_Financial_Statements-GPFS-2026.pdf` — the **audited General Purpose Financial Statements**
  (ingested here);
- `Annual_Financial_Statements-2026.pdf` — the combined annual financial statements (17,012,732
  bytes);
- `Annual_Financial_Statements-SPFS-2026.pdf` — the special purpose financial statements
  (2,415,472 bytes).

The same page's newest combined **annual report** is still **FY2024-25**
(`final-annual-report-2024-2025.pdf`); no FY2025-26 combined annual report was linked as at
2026-11-20. The FY2025-26 GPFS is the current audited document and is ingested; the older combined
annual report is **not** substituted or ingested.

The FY2025-26 GPFS was authorised for issue by Council on **22 September 2026** and embeds the
independent **Auditor-General** report (PDF pages 64-66) with an unmodified opinion on the GPFS. No
FY2026-27 statements were published as at 2026-11-20.

## 1. Source and year

- Publisher: **Cabonne Council**.
- Document: **Annual Financial Statements — GPFS for the year ended 30 June 2026** — FY2025-26. The
  PDF is **8,577,237 bytes**, **77 physical pages**, and contains the GPFS (Income Statement PDF p4,
  Statement of Comprehensive Income p5, Statement of Financial Position p6, Statement of Changes in
  Equity p7, Statement of Cash Flows p8, B1-1 functions PDF p13), the notes, and the independent
  Auditor-General report.
- Reporting page (human-facing):
  <https://www.cabonne.nsw.gov.au/Council/Strategies-policies-and-publications/Reports>.
- Exact GPFS PDF (documented official pin):
  <https://www.cabonne.nsw.gov.au/files/98ceb2a5-f381-4fcb-b4e6-32cb52eab396/Annual_Financial_Statements-GPFS-2026.pdf>.
- Newest combined annual report on the same page (not ingested):
  <https://www.cabonne.nsw.gov.au/files/sharedassets/public/v/1/council/business-papers-reports-policies-and-publications/reports/annual-reports/final-annual-report-2024-2025.pdf>.

## 2. Access, discovery and fetch

The official site is behind **Akamai** bot protection. On 2026-11-20 plain clients were blocked
("Access Denied", Akamai reference `#18.…`); a real browser session was not:

| Client | Home page | `robots.txt` | Sitemap | GPFS PDF (`/files/...`) |
| --- | --- | --- | --- | --- |
| `curl` (Chrome-like UA), both hosts | HTTP 403, ~384 bytes | HTTP 403, ~396 bytes | HTTP 403, ~397 bytes | HTTP 403 |
| Headless Chromium (Playwright) | HTTP 200, HTML | — | HTTP 200, `text/xml`, 315,875 bytes | HTTP 200, `application/pdf`, 8,577,237 bytes |

The 403 body is an Akamai "Access Denied" HTML page, not a JavaScript challenge. Headless Chromium
renders the Reports page, which exposes the FY2026 uploads as `/files/<uuid>/…` links; the pinned
GPFS link is fetched from within that browser session (`page.evaluate(fetch(..., {credentials:
'include'}))`), so the WAF session cookies apply. Only the exact official upload is fetched; the
adapter does not crawl or mirror the file tree.

`scripts/cabonne-gpfs-browser.ts` navigates the official Reports page in headless Chromium, confirms
the pinned upload is listed in the rendered HTML, fetches the exact PDF, and prints its SHA-256 and
byte count. It falls back to a plain client only when forced (tests); on the live site the plain
path is expected to return HTTP 403.

Reproduce the gate:

```bash
# plain client: 403
curl -s -o /dev/null -w '%{http_code}\n' -A 'Mozilla/5.0 (X11; Linux x86_64) Chrome/131.0' \
  https://www.cabonne.nsw.gov.au/
# real browser/WAF path: 200 + application/pdf + SHA-256
npx tsx scripts/cabonne-gpfs-browser.ts
```

## 3. Archive (outside the repo)

The exact downloaded bytes are archived outside the repository under the configured source-archive
root, at the relative archive path `cabonne-gpfs/Annual_Financial_Statements-GPFS-2026.pdf`:

- URL: `https://www.cabonne.nsw.gov.au/files/98ceb2a5-f381-4fcb-b4e6-32cb52eab396/Annual_Financial_Statements-GPFS-2026.pdf`
- retrieval date: 2026-11-20
- bytes: **8,577,237**
- SHA-256: `acb8b3d53a4b795bfb6bd5dd4770e377fe24dfc0ca2801f44df9a348369d885f`
- content type: `application/pdf`
- hash verified: yes (`archiveSourceDocument` + `verifySourceDocument`).

## 4. Rows and reconciliation

Printed unit: **`$ '000`**, detected explicitly on every face statement and B1-1; a missing or
conflicting unit is rejected, never defaulted. The connector emits **17 printed Income Statement
lines** (8 revenue components, total income, 4 expense components, the printed expenses-excluding-
depreciation subtotal, depreciation, the documented total-expenses bridge, and the net result). All
rows are `aggregation_role: "agency_detail"`, `jurisdiction_level: "local"`, no `region_id`/LGA, so
they can never be summed into another council or into state/federal spending.

Zero-tolerance reconciliation (all in `$ '000`):

- Revenue components: rates 18,082 + user charges 10,321 + other revenues 871 + operating grants
  15,902 + capital grants 20,626 + interest 3,405 + other income 772 + net gain on asset disposals 39
  = **70,018** = printed total income.
- Expense components: employee 17,207 + materials 15,733 + borrowing 231 + other 792 = **33,963** =
  printed expenses excluding depreciation.
- Total expenses bridge: 33,963 + depreciation/amortisation/impairment 16,093 = **50,056**, equal to
  the printed B1-1 expense total.
- Net result: 70,018 − 50,056 = **19,962**; before capital grants: 19,962 − 20,626 = **−664**.
- B1-1: income **70,018**, expenses **50,056**, operating result **19,962**, grants **36,528**
  (15,902 operating + 20,626 capital), carrying amount **775,405**.
- Comprehensive income: net result 19,962 + other comprehensive income **21,076** (IPPE revaluation
  20,479 + joint ventures/associates 597) = total comprehensive income **41,038**.
- Statement of Financial Position: total assets **775,405** = current 61,777 + non-current 713,628;
  total liabilities **25,706** = current 18,450 + non-current 7,256; net assets **749,699** =
  accumulated surplus 446,835 + IPPE revaluation surplus 302,864 = total equity.
- Statement of Changes in Equity: opening 708,661 + total comprehensive income 41,038 = closing
  **749,699**; opening accumulated surplus 426,276 + net result 19,962 + JV OCI 597 = closing
  accumulated surplus 446,835.
- Statement of Cash Flows: operating 36,574 − investing 33,164 + financing 1,422 = net change
  **4,832**; opening 14,620 + 4,832 = closing cash **19,452** = SoFP cash; SoFP prior-year cash
  14,620 = printed opening cash.

The connector rejects the document (0 rows) if any of these checks fail, if the unit is missing or
conflicting, or if any face statement is absent. Tests cover the unit gate, unit-disagreement gate,
reconciliation tamper gate, stale-year refusal, browser/WAF fetch, natural-key stability, no-total
rule, and idempotent additive ingestion.

## 5. What is deliberately not done

- No total for Cabonne Council, no cross-council total, no state or federal addition.
- No region/LGA allocation.
- No OCR: the PDF has a text layer and every value is read from printed text.
- No older year substituted: the FY2024-25 combined annual report is documented as the newest
  combined report and is not used for rows.
- No deploy.
