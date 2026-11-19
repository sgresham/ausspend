# NSW councils inventory — Batch B (Rural small, 15)

Research pass 2026-11-19. Scope: official council annual-report / GPFS PDF discovery only.
No ingestion, no registry/DB/code changes, no PDFs committed.

Companion file: `inventory.csv` (one row per council, verified URLs and headers).

## Premise falsifier (checked first)

**No single official NSW source publishes GPFS statement lines for all 128 councils.**
`docs/NSW_COUNCILS.md` already records that the OLG *Your Council* site/workbook is
summary/benchmark-only, is not open-licensed for line items, and that statement-line coverage
requires the 128 individual council GPFS PDFs. This pass found no new statewide GPFS file; the
per-council inventory remains the prerequisite. Batch B is therefore built council-by-council
from official council domains.

## Ranked list — easiest / highest value first

### Tier 1 — current FY2025-26 standalone GPFS (best)

1. **Warren** — GPFS 2025-26 + annual report 2025-26. Cleanest current-year pair.
2. **Brewarrina** — standalone GPFS 2025-26; annual report 2024-25.
3. **Bourke** — standalone GPFS 2025-26; annual report 2024-25.
4. **Bogan** — standalone GPFS 2025-26 (`14.10.2026 Annual_Financial_Statements-2026`);
   annual report 2024-25.
5. **Coolamon** — combined GPFS FY2026 (incl. audit reports); annual report 2024-25.
6. **Gilgandra** — standalone GPFS 2025-26; annual report 2024-25.
7. **Lockhart** — standalone GPFS 2025-26 (3-in-1); annual report FY2025.

### Tier 2 — usable FY2024-25 documents (current year not yet posted)

8. **Coonamble** — audited GPFS 2024-25 + annual report 2024-25. Correct domain is
   `coonambleshire.nsw.gov.au`; `coonamble.nsw.gov.au` does not resolve.
9. **Weddin** — audited GPFS 2024-25 + annual report 2024-25.
10. **Walcha** — standalone GPFS 2024-25; annual-report page is stale (latest 2022-23), so
    ingest from the GPFS page directly.
11. **Murrumbidgee** — annual report 2024-25 plus Appendix A financial information; no
    standalone GPFS and no 2025-26 yet.
12. **Central Darling** — annual report 2024-25 (statutory financial statements section).
    The 2025-26 "GPFS" link is only a **1-page presentation notice**, not the statements.
13. **Hay** — annual report 2024-25 only; the dedicated financial-statements page renders no
    documents. Statement-line availability is unconfirmed.

## Explicit gaps

- **Balranald** — the entire official site returns **HTTP 403** (home, `robots.txt`,
  `sitemap.xml`, and known PDF paths all blocked from this host). No mirror was substituted, so
  no document is recorded. Needs a different network/browser or a direct council request.
- **Carrathool** — the annual-report page and sitemap expose nothing newer than the
  **2023-24** combined annual report. Missing FY2024-25 and FY2025-26.
- **Hay** — no standalone GPFS located (see above).
- **Central Darling** — no standalone full GPFS; annual report is the usable source.

## Access notes for whoever ingests next

- **WAF quirk:** `centraldarling`, `gilgandra`, `murrumbidgee` and `weddin` return **200 to a
  plain `curl/8.5.0` UA** but **403 to a Chrome UA** on both pages and PDFs. Use the plain UA
  (or a session with cookies) for those four.
- `bogan` `.pdf.aspx` endpoints serve a genuine `application/pdf` body.
- `coolamon` `/s/` assets redirect to `coolamon.squarespace.com`; `warren` requires the
  `?downloadable=1` query.
- All `bytes`/`content_type` values in the CSV were re-fetched at inventory time; they refer to
  the primary document named in that row (GPFS where present, otherwise the annual report).

## How to reproduce a check

```bash
# Tier-1 example (Warren GPFS)
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  'https://www.warren.nsw.gov.au/__media_downloads/Financial%20Reports/GPFS-2026.pdf?downloadable=1'
# WAF example (Weddin; plain UA 200, Chrome UA 403)
curl -sL -o /dev/null -w '%{http_code}\n' -A 'curl/8.5.0' \
  'https://www.weddin.nsw.gov.au/files/assets/public/v/1/council/plans-strategies-amp-reports/other-plans-amp-strategies/20251106-2024-2025-annual-financial-statements.pdf'
```
