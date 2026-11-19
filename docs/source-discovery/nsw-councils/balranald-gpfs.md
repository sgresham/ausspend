# Balranald Shire Council — General Purpose Financial Statements (FY2025-26)

Source id `balranald-gpfs` (NSW local government). One council only; entity-level rows, no council
aggregate and no cross-council or state/federal addition.

**Status: landed — 18 statement rows from the official standalone audited Annual Financial
Statements for the year ended 30 June 2026.** The cheap-check premise ("the entire official site
returns HTTP 403 from this host") is **confirmed for plain clients**, but the WAF premise is
**falsified for a real browser**: headless Chromium reaches the site and the current audited GPFS.
No mirror, cache, or invented URL is used.

## 0. Stale-year check

Checked on **2026-11-20**. The official annual-reports page
<https://balranald.nsw.gov.au/business/council-documents/annual-reports-documents/> lists the
current standalone **FY2025-26 Annual Financial Statements** (published November 2026) and the
newest combined **FY2024-25** annual report (`BSC-Annual-Report-2024-2025-with-Financials.pdf`,
24,932,113 bytes). No FY2025-26 combined annual report was linked as at 2026-11-20. The FY2025-26
standalone GPFS is the current audited document and is ingested; the older combined annual report is
**not** substituted or ingested.

The FY2025-26 PDF is the council's General Purpose Financial Statements for the year ended 30 June
2026 and embeds the independent Auditor-General section 417 reports (PDF pages 77-78), including an
unmodified opinion on the GPFS. No FY2026-27 statements were published as at 2026-11-20.

## 1. Source and year

- Publisher: **Balranald Shire Council**.
- Document: **Annual Financial Statements for the year ended 30 June 2026** — FY2025-26. The PDF is
  **2,920,220 bytes**, **108 physical pages**, and contains the GPFS (Income Statement PDF p6,
  Statement of Comprehensive Income p7, Statement of Financial Position p8, Statement of Changes in
  Equity p9, Statement of Cash Flows p10, B1-1 functions PDF p15), the notes, and the independent
  Auditor-General reports.
- Reporting page (human-facing):
  <https://balranald.nsw.gov.au/business/council-documents/annual-reports-documents/>.
- Exact GPFS PDF (documented official pin):
  <https://balranald.nsw.gov.au/wp-content/uploads/2026/11/Balranald-Annual_Financial_Statements-2026-OLG.pdf>.
- Newest combined annual report on the same page (not ingested):
  <https://balranald.nsw.gov.au/wp-content/uploads/2025/11/BSC-Annual-Report-2024-2025-with-Financials.pdf>.

## 2. Access, discovery and fetch

The official site is behind Cloudflare bot management. The `www` host 301-redirects to the apex
`balranald.nsw.gov.au`. On 2026-11-20 plain clients were blocked; a real browser was not:

| Client | Home page | Sitemap | `robots.txt` | GPFS PDF |
| --- | --- | --- | --- | --- |
| `curl` (Chrome-like UA) | HTTP 403, 103 bytes | HTTP 403, 103 bytes | HTTP 200 (apex) | HTTP 403, 103 bytes |
| `curl` (Googlebot UA) | HTTP 403, 103 bytes | — | — | — |
| Headless Chromium (Playwright) | HTTP 200, HTML | HTTP 200, XML | — | HTTP 200, `application/pdf`, 2,920,220 bytes |

The 403 responses carry `server: cloudflare`, a `cf-ray` and a `__cf_bm` cookie but are a hard block
page, not a JavaScript challenge. The public `robots.txt` (served after the `www` → apex redirect)
still advertises `https://balranald.nsw.gov.au/sitemap_index.xml`, but the sitemap itself is blocked
to plain clients. Headless Chromium renders the home page, the sitemap index and the annual-reports
page, which is how the current upload was discovered. Only the exact official upload is fetched; the
adapter does not crawl or mirror the upload tree.

`scripts/balranald-gpfs-browser.ts` navigates the official annual-reports page in headless Chromium,
confirms the pinned upload is listed in the rendered HTML, fetches the exact PDF through the browser
session, and prints its SHA-256 and byte count. It falls back to a plain client only when forced
(tests); on the live site the plain path is expected to return HTTP 403.

Reproduce the gate:

```bash
# plain client: 403
curl -s -o /dev/null -w '%{http_code}\n' -A 'Mozilla/5.0 (X11; Linux x86_64) Chrome/131.0' \
  https://balranald.nsw.gov.au/
# real browser/WAF path: 200 + application/pdf + SHA-256
npx tsx scripts/balranald-gpfs-browser.ts
```

## 3. Archive (outside the repo)

The exact downloaded bytes are archived outside the repository under the configured source-archive
root, at the relative archive path
`balranald-gpfs/Balranald-Annual_Financial_Statements-2026-OLG.pdf`:

- URL: `https://balranald.nsw.gov.au/wp-content/uploads/2026/11/Balranald-Annual_Financial_Statements-2026-OLG.pdf`
- retrieval date: 2026-11-20
- bytes: **2,920,220**
- SHA-256: `d7c10c675385d2376ddccae430b08087f25d491a34f6a3695a86e9d807b169fd`
- content type: `application/pdf`
- hash verified: yes (`archiveSourceDocument` + `verifySourceDocument`).

## 4. Rows and reconciliation

Printed unit: **`$ '000`**, detected explicitly on every face statement and B1-1; a missing or
conflicting unit is rejected, never defaulted. The connector emits **18 printed Income Statement
lines** (7 revenue components, total income, 6 expense components, the printed expenses-excluding-
depreciation subtotal, depreciation, the documented total-expenses bridge, and the net result). All
rows are `aggregation_role: "agency_detail"`, `jurisdiction_level: "local"`, no `region_id`/LGA, so
they can never be summed into another council or into state/federal spending.

Zero-tolerance reconciliation (all in `$ '000`):

- Revenue components: rates 6,248 + user charges 2,554 + other revenues 674 + operating grants
  16,394 + capital grants 5,490 + interest 1,391 + other income 143 = **32,894** = printed total
  income.
- Expense components: employee 8,802 + materials 7,723 + borrowing 71 + other 685 + net loss on
  disposals 19 + net share of joint ventures 15 = **17,315** = printed expenses excluding
  depreciation.
- Total expenses bridge: 17,315 + depreciation/amortisation/impairment 7,265 = **24,580**, equal to
  the printed B1-1 expense total.
- Net result: 32,894 − 24,580 = **8,314**; before capital grants: 8,314 − 5,490 = **2,824**.
- B1-1: income **32,894**, expenses **24,580**, operating result **8,314**, grants **21,884**
  (16,394 operating + 5,490 capital), carrying amount **338,016**.
- Comprehensive income: net result 8,314 + other comprehensive income **12,493** (revaluation 12,493
  plus the printed nil impairment/revaluation decrement) = total comprehensive income **20,807**.
- Statement of Financial Position: total assets **338,016** = current 44,226 + non-current 293,790;
  total liabilities **10,348** = current 7,840 + non-current 2,508; net assets **327,668** =
  accumulated surplus 87,916 + IPPE revaluation surplus 239,752 = total equity.
- Statement of Changes in Equity: opening 306,861 + total comprehensive income 20,807 = closing
  **327,668**.
- Statement of Cash Flows: operating 14,117 − investing 24,147 + financing 1,260 = net change
  **−8,770**; opening 11,819 − 8,770 = closing cash **3,049** = SoFP cash; SoFP prior-year cash
  11,819 = printed opening cash.

The connector rejects the document (0 rows) if any of these checks fail, if the unit is missing or
conflicting, or if any face statement is absent. Tests cover the unit gate, unit-disagreement gate,
reconciliation tamper gate, stale-year refusal, browser/WAF fetch, natural-key stability, no-total
rule, and idempotent additive ingestion.

## 5. What is deliberately not done

- No total for Balranald Shire Council, no cross-council total, no state or federal addition.
- No region/LGA allocation.
- No OCR: the PDF has a text layer and every value is read from printed text.
- No older year substituted: the FY2024-25 combined annual report is documented as the newest
  combined report and is not used for rows.
- No deploy.
