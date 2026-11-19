# NSW council source inventory — Group D (Large rural 2)

Research-only inventory of official annual-report / General Purpose Financial Statements
(GPFS) documents for the 19 councils in batch D. No ingestion, connector, registry, DB or
shared-doc changes were made. PDFs were not saved in the repo.

Checked: 2026-11-19. Scope: `docs/source-discovery/nsw-councils/group-d/`.

## Premise falsifier

**No single official NSW source publishes GPFS statement lines for all 128 councils.** There is
no central official GPFS file; OLG "Your Council" is summary-only and not open-licensed. The
per-council inventory is therefore still the prerequisite for the next ingestion batches.

## Method / access notes

- Every council's HTML was retrieved with headless Chromium (Playwright's cached Chromium,
  `--headless=new --dump-dom`), because a plain `curl` gets an Akamai "Access Denied" 403 on
  most of these council sites (the HTML **and** the `/files/` PDFs sit behind the same WAF).
- Primary document chosen = latest **audited FY2024-25** (year ended 30 June 2025) standalone
  GPFS/AFS PDF where one exists; otherwise the annual report that carries the financial
  statements. FY2025-26 sets (often still "on exhibition"/unaudited) were noted but not used as
  the primary.
- "Plain fetch OK" means `curl` returned `200 application/pdf`. "WAF / browser" means `curl`
  returned a 403 block page but headless Chromium opened the PDF viewer (i.e. the PDF is real
  and reachable with a browser/JS context).
- `page_count` and `unit` were **not verified** here — there is no `pdftotext`/PDF library in
  this environment. Unit extraction is an ingestion-time step.

## Ranked list (easiest / highest-value first)

### Tier 1 — plain-fetch standalone FS (drop-in ready)
1. **Cootamundra-Gundagai Regional** — audited FS FY2024-25, `200 application/pdf`, 2.57 MB.
2. **Moree Plains** — FS FY2024-25, `200 application/pdf`, 2.00 MB.
3. **Hilltops** — AFS FY2024-25, `200 application/pdf`, 5.07 MB.
4. **Inverell** — FS **FY2025-26**, `200 application/pdf`, 6.37 MB (also FY2024-25); the HTML publications page returns a Cloudflare challenge to plain fetch, but the direct PDF is `200`.

### Tier 2 — standalone FS present, WAF needs browser/JS (high value)
5. **Bellingen** — AFS **FY2025-26**, 1.29 MB (also FY2024-25); plain fetch in this run (WAF may challenge other clients).
6. **Cowra** — AFS **FY2025-26**, 3.42 MB (also FY2024-25); plain fetch in this run (WAF may challenge other clients).
7. **Gunnedah** — FS **FY2025-26**, 5.73 MB (also FY2024-25); plain fetch in this run (WAF may challenge other clients).
8. **Leeton** — signed audited FS **FY2025-26**, 2.72 MB (also FY2024-25); plain fetch in this run (WAF may challenge other clients).
9. **Nambucca Valley** — audited AFS **FY2024-25**, 1.73 MB (FY2025-26 link advertised but 404); plain fetch in this run.
10. **Narrabri** — FS **FY2025-26**, 2.90 MB (also FY2024-25); plain fetch in this run (WAF may challenge other clients).
11. **Parkes** — audited FS **YE 30 Jun 2026**, 6.31 MB (also FY2024-25); plain fetch in this run (WAF may challenge other clients).
12. **Snowy Valleys** — signed audited FS FY2024-25 is **scanned image-only (no text layer)**; **DEFERRED, 0 rows**, no connector registered. FY2025-26 audited standalone FS is not published (only a six-monthly progress report).
13. **Upper Hunter** — signed FS **FY2024-25**, 2.88 MB; FY2025-26 audited standalone FS not published (only 2026 budget/planning and quarterly-review documents); plain fetch in this run.
14. **Yass Valley** — audited FS FY2024-25.

### Tier 3 — FS only embedded in the annual report
15. **Murray River** — no separate GPFS; FY2024-25 annual report includes the financial
    statements. Still WAF/browser access.

### Tier 4 — explicit gaps (do not ingest yet)
16. **Cabonne** — official links exist (AFS FY2024-25 and a dedicated `GPFS-2026` PDF), but the
    `/files` endpoint returned a WAF 403 to `curl` **and an empty response to headless Chromium**.
    Manual browser check / WAF allowlist needed.
17. **Federation** — official standalone AFS FY2024-25 linked; same `/files` WAF no-response.
18. **Greater Hume** — official financial statement FY2024-25 linked; same `/files` WAF
    no-response.
19. **Muswellbrook** — **no standalone financial-statements page or PDF found**. Only the
    FY2024-25 annual report (plain-fetchable, 35.4 MB); whether it embeds the audited FS is
    unverified.

## Gaps summary

- **No standalone FS document found:** Muswellbrook (annual report only).
- **Official URL known but not retrievable in this environment (WAF/no-response):** Cabonne,
  Federation, Greater Hume.
- **FS bundled in annual report:** Murray River.

## How to check

```bash
# Count rows / list councils
column -s, -t docs/source-discovery/nsw-councils/group-d/inventory.csv

# Plain-fetch PDFs (expect 200 application/pdf)
curl -sS -o /dev/null -w '%{http_code} %{content_type}\n' \
  https://www.cgrc.nsw.gov.au/wp-content/uploads/2026/01/Cootamundra-Gundagai-Regional-Council-Financial-Statements-2024-25-Audited.pdf

# WAF-host PDFs return 403 to curl; verify with a browser (headless Chromium opens PDF viewer):
#   <chromium> --headless=new --dump-dom "<pdf-url>"
```
