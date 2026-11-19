# NSW councils inventory — Batch A (Metro remainder + regional cities, 27)

Research pass 2026-11-19. Scope: official council annual-report / GPFS PDF discovery only.
No ingestion, no registry/DB/code changes, no PDFs committed.

Companion file: `inventory.csv` (one row per council, verified URLs and headers).

## Premise falsifier (checked first)

**No single official NSW source publishes GPFS statement lines for all 128 councils.**
`docs/NSW_COUNCILS.md` records that the OLG *Your Council* site/workbook is summary/benchmark
only, is not open-licensed for line items, and that statement-line coverage requires the 128
individual council GPFS PDFs. This pass found no new statewide GPFS file, so the per-council
inventory remains the prerequisite for the next ingestion batches.

## Ranked list — easiest / highest value first

### Tier 1 — current FY2025-26 standalone GPFS on a dedicated official page (best)

1. **Queanbeyan-Palerang Regional** — FS 2025-26 + AR 2025-26; paired PDFs on Budgets-and-Planning.
2. **Richmond Valley** — FS year ended 30 Jun 2026 + AR 2025-26; WordPress media URLs.
3. **Mid-Western Regional** — FS 2025-26 + AR 2024-25; separate FS series back to 2006-07.
4. **Wingecarribee** — audited FS 2025-26 + AR 2025-26; Council Reports page.
5. **Clarence Valley** — FS 2025-26 + AR 2025-26; Annual Reports and statements page.
6. **Armidale Regional** — audited GPFS 2025-26; Financial statements page lists 8 years.
7. **Byron** — financial statements 2025-26 + AR 2025-26; Reports on Our Progress page.
8. **Kempsey** — Part C audited financial statements 2025-26 + AR parts; annual report is split into A/B/C.
9. **Singleton** — 2025/2026 audited FS + 2025/2026 AR; served via `DocID` endpoints, no `.pdf` suffix.

### Tier 2 — usable FY2024-25 documents (current FY2025-26 not yet posted)

10. **Goulburn Mulwaree** — FS 2024-25 + AR 2024-25.
11. **Griffith** — FS 2024-25 + AR 2024-25.
12. **Lithgow** — FS 2024-25 + AR 2024-25.
13. **Bega Valley** — annual financial statements year ended 30 Jun 2025 (page has 2012-2025).
14. **Broken Hill** — annual financial statements 2024-25 + AR 2024-25.
15. **Snowy Monaro Regional** — audited GPFS 2024-25 + AR 2024-25.
16. **Orange** — audited FS 2024-25 (with audit letter) + AR 2024-25.

### Tier 3 — annual report only; financial statements likely embedded, unverified

17. **Albury** — AR 2024-25 via e-services portal; no separate GPFS link.
18. **Ballina** — AR 2024-25; no separate GPFS link.
19. **Cessnock** — AR 2024-25; no separate GPFS link.
20. **Kiama** — AR 2024-25; no separate GPFS link.
21. **Lismore** — AR 2024-25; only an older 2019-20 standalone financial report.
22. **Burwood** — AR 2024-25 has summary financial performance only; already deferred in
    `BURWOOD_GPFS_DEFERRED.md`.
23. **Bathurst Regional** — only small meeting-attachment PDFs (AR 90 KB, FS 111 KB) and no
    dedicated reports page; contents unverified.

## Explicit gaps

- **Port Stephens** — whole official site is behind a **Cloudflare JS challenge**
  (`Just a moment...`) on home, `robots.txt` and every HTML path. A headless Chromium cannot
  pass it from this host. No document URL could be verified.
- **Wagga Wagga** — same Cloudflare JS challenge; no document URL could be verified.
- **Eurobodalla** — same Cloudflare JS challenge (`esc.nsw.gov.au`); no document URL could be
  verified.
- **Tamworth Regional** — the official Financial reporting page links
  `ArticleDocuments/226/Annual Financial Statements - 2026.pdf.aspx`, but direct fetch returns
  **403** (Akamai/WAF). URL recorded; access gap only.
- **Bathurst Regional** — no dedicated annual-report/GPFS landing page; the only current
  documents found are meeting attachments and are suspiciously small (see Tier 3).

## Access notes for whoever ingests next

- **Akamai WAF quirk — UA-sensitive, not a fixed rule.** Re-verified 2026-11-19T04:4x on the
  Armidale, Lithgow, Queanbeyan-Palerang, Snowy Monaro and Wingecarribee GPFS PDFs:

  | request variant | observed result (all five URLs) |
  |---|---|
  | plain `curl` (default UA/headers) | **200** `application/pdf`; bytes match the CSV |
  | bare Chrome `User-Agent` only | **403** `text/html` (~0.5 KB challenge/deny body) |
  | Chrome UA + full browser bundle (`Accept: application/pdf,...`, `Accept-Language`, `Sec-Fetch-Dest/Mode/Site`, `Upgrade-Insecure-Requests`) | **200** `application/pdf`; same bytes |

  The earlier "plain curl gets 403 / browser headers get 200" wording in this file was wrong.
  The reliable failure case is a **bare browser UA**; on all five tested sites both plain `curl`
  defaults and the full browser-header bundle returned the real PDF. Because the edge rule can
  change and may differ by council, **use a two-attempt probe rather than a fixed header
  recipe**: try plain `curl` first, then the full browser-header bundle, and accept whichever
  returns `200 application/pdf`. This applies to the HTML pages as well as the PDFs.
- **Cloudflare** (`portstephens`, `wagga`, `esc`) is different: it serves a JS challenge page,
  not a header gate. Do not treat a 403 there as a missing document.
- **Redirects:** Kiama and Lismore old `/v/1` asset paths 301 to `/v/2` (Kiama) and to
  `/5.-council/6.-corporate-information/` (Lismore); the CSV records the final URLs.
- **Non-`.pdf` endpoints:** Albury uses `eservice.../RecordURI?URI=...` (octet-stream but a
  real PDF); Singleton uses `docs.singleton.nsw.gov.au/default.aspx?DocID=...` (returns
  `application/pdf`); Tamworth uses `.pdf.aspx`.
- `bytes`/`content_type` in the CSV refer to the primary document in that row (GPFS where
  present, otherwise the annual report). All were fetched at inventory time. `page_count` and
  `unit` were left blank where not cheaply/actually verified (no PDF text extraction was run).

## How to reproduce a check

```bash
# Akamai-hosted GPFS: probe twice — plain curl first, then the full browser-header bundle.
# Plain curl (default UA) returned 200 application/pdf on the five re-verified sites;
# a bare Chrome UA alone returns 403, while UA + Accept/Sec-Fetch also returns 200.
U='https://www.snowymonaro.nsw.gov.au/files/assets/public/v/2/council/ipr/annual-reports/smrc-annual_financial_statements-gpfs-2025-final-audited.pdf'
curl -sL -o /dev/null -w 'plain: %{http_code} %{content_type} %{size_download}\n' "$U"
curl -sL -o /dev/null -w 'browser: %{http_code} %{content_type} %{size_download}\n' \
  -A 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36' \
  -H 'Accept: application/pdf,*/*;q=0.8' -H 'Sec-Fetch-Dest: document' \
  -H 'Sec-Fetch-Mode: navigate' -H 'Sec-Fetch-Site: none' \
  -H 'Upgrade-Insecure-Requests: 1' "$U"

# Plain-fetch example (Richmond Valley)
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  'https://richmondvalley.nsw.gov.au/wp-content/uploads/2026/10/Richmond-Valley-Council-Financial-Statements-for-the-year-ended-30-June-2026.pdf'

# Cloudflare gap (Port Stephens)
curl -sL -o /dev/null -w '%{http_code} %{content_type}\n' 'https://www.portstephens.nsw.gov.au/'
```
