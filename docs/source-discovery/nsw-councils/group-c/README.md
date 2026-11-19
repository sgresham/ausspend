# NSW council annual-report / GPFS source inventory — Batch C (Large rural 1)

Research only: 23 named missing councils. No ingestion, connector, registry, DB, or shared-doc changes.
Compiled and link-checked **2026-11-19**.

## Headline

- **21 of 23 councils** have a direct, official, audited General Purpose Financial Statements
  (or annual-report financial-statements annexure) PDF that returned `200 application/pdf`.
- **2 explicit gaps:** Oberon (no standalone GPFS after FY2021-22) and Walgett (official site is a
  client-rendered SPA with no fetchable document links).
- 11 of the 21 are already on **FY2025-26**; 10 are the latest available **FY2024-25**.

### Premise falsifier — no single statewide source

No single official NSW source was found that publishes GPFS *statement lines* for all 128 councils.
The Office of Local Government "Your Council" site publishes summary/comparative indicators, not the
audited GPFS statements, and is not open-licensed. The per-council documents below remain the
prerequisite for the next ingestion batches.

## Ranked list (easiest / highest-value first)

Ranking favours: current FY2025-26 > FY2024-25; standalone GPFS > annual-report annexure; plain
fetch > bot-walled; smaller native PDF > large bundle.

### Tier 1 — FY2025-26 standalone GPFS (best value)

| # | Council | GPFS FY | Bytes | Access |
|---|---------|---------|-------|--------|
| 1 | Uralla Shire | 2025-26 | 135,915 | Akamai headers |
| 2 | Kyogle | 2025-26 | 1,881,345 | plain fetch |
| 3 | Junee Shire | 2025-26 | 972,546 | plain fetch |
| 4 | Berrigan Shire | 2025-26 | 1,594,806 | Akamai headers |
| 5 | Blayney Shire | 2025-26 | 3,321,814 | plain fetch |
| 6 | Liverpool Plains Shire | 2025-26 | 3,419,279 | Akamai headers |
| 7 | Tenterfield Shire | 2025-26 | 1,632,568 | plain fetch |
| 8 | Cobar Shire | 2025-26 | 3,507,784 | plain fetch |
| 9 | Upper Lachlan Shire | 2025-26 | 4,215,629 | Akamai headers |
| 10 | Narrandera Shire | 2025-26 | 2,679,914 | Akamai headers (annexure F) |
| 11 | Narromine Shire | 2025-26 | 7,899,829 | plain fetch (annexure 1) |

### Tier 2 — latest available FY2024-25 standalone/annexure GPFS

| # | Council | GPFS FY | Bytes | Access |
|---|---------|---------|-------|--------|
| 12 | Gwydir Shire | 2024-25 | 1,862,025 | Akamai headers |
| 13 | Wentworth Shire | 2024-25 | 1,707,983 | plain fetch |
| 14 | Edward River | 2024-25 | 2,142,775 | Akamai headers |
| 15 | Glen Innes Severn | 2024-25 | 3,903,779 | Akamai headers |
| 16 | Temora Shire | 2024-25 | 2,464,389 | Akamai headers |
| 17 | Dungog Shire | 2024-25 | 2,733,768 | Akamai headers |
| 18 | Forbes Shire | 2024-25 | 2,560,081 | plain fetch |
| 19 | Lachlan Shire | 2024-25 | 2,779,801 | Akamai headers |
| 20 | Warrumbungle Shire | 2024-25 | 3,318,554 | Akamai headers |
| 21 | Bland Shire | 2024-25 | 2,771,199 | Akamai headers |

### Tier 3 — explicit gaps (do not ingest yet)

| # | Council | Gap |
|---|---------|-----|
| 22 | Oberon | No standalone audited GPFS published after FY2021-22. Only a 52 MB "Annual Report 2024-25 … with attachments" bundle; the FS section is not separately exposed and was not confirmed (may be scanned). Reporting page: <https://www.oberon.nsw.gov.au/Council/Integrated-Planning-Reporting> |
| 23 | Walgett | `https://www.walgett.nsw.gov.au/council/council-publications/annual-reports` returns a 2.8 KB React app shell. Content is client-rendered; no PDF/document URLs in HTML or sitemap; `api.`/`cms.` subdomains do not resolve. Needs a headless-browser pass or a direct request to Council. |

## How the inventory was checked

Every `gpfs_url` (and every `annual_report_url`) was fetched on 2026-11-19 with a range request
(`Range: bytes=0-1023`) plus a full browser header set, then the response headers were parsed:

```bash
curl -sS -L -r 0-1023 -D - -o /dev/null \
  -A 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36' \
  "$URL" | grep -iE '^HTTP|^content-type|^content-range'
```

- All 44 document URLs returned `200`/`206` with `content-type: application/pdf` and `%PDF-` magic.
- `bytes` in `inventory.csv` is the true full size from `Content-Range`, or `size_download` when a
  server ignored the range (Bland annual, Kyogle annual, Kyogle GPFS).
- `page_count` is `n/a`: no `pdfinfo`/`pdftotext` on the worker host, so page counts were not cheaply
  obtainable. PDFs were not saved in the repo.
- `/tmp`-style scratch artefacts were used only for header checks; none are committed.

## Access obstacles

- **14 of 23** council sites sit behind an Akamai bot wall that returns **403 to bare `curl`**.
  A full browser header set (UA + `Accept`, `Accept-Language`, `Sec-Fetch-*`, `Upgrade-Insecure-Requests`,
  `--compressed`) yields `200`. This is recorded per row in `access_notes`.
- **Narromine** serves PDFs from the host root with `%20` encoded spaces and `?downloadable=1`.
- **Blayney/Forbes** use ASP.NET `.pdf.aspx` wrappers; they still return `application/pdf`.
- **Walgett** cannot be resolved by HTTP fetch (see gap table).

## Suggested next step

Feed Tier 1 (rows 1–11) into the ingestion batch first: all are current FY2025-26 GPFS and directly
fetchable. Re-check Oberon and Walgett only after a headless-browser path or a Council contact is
available.

## Files

- `inventory.csv` — one row per council (23 rows), all required fields.
