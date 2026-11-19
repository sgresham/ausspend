# QLD SOC — CleanCo Queensland Limited annual-report evidence

**Status:** implementation evidence only. **Entity:** CleanCo Queensland Limited only, a Queensland
Government Owned Corporation (GOC) and one of the 11 GOC-list entities. **No other QLD GOC, no
statutory body, no WA/NSW entity and no GOC/state/national total.**

**Current outcome: deferred with 0 rows (access gap).** The official FY2025-26 annual report is
published only as an embedded Flipsnack flipbook with no direct PDF. The only direct annual-report PDF
on the official site is the prior FY2024-25 report, which is **not** ingested or presented as current.

**Checked:** 2026-11-19 (Australia/Brisbane).

## 1. Discovery and access log

All probes were read-only. No PDF is committed to the repo.

| Step                                   | URL                                                                                                            | HTTP          | Result                                                                                                                             |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Entity home page                       | <https://cleancoqueensland.com.au/>                                                                            | **200**       | `text/html`, 64,760 bytes.                                                                                                         |
| Official publication-scheme page       | <https://cleancoqueensland.com.au/publication-scheme/>                                                          | **200**       | `text/html`, 77,705 bytes. Lists the FY2025-26 report only as a Flipsnack viewer; the direct PDF listed is the prior-year report.    |
| Official publications page             | <https://cleancoqueensland.com.au/publicationsandreports/>                                                     | **200**       | `text/html`, 62,897 bytes. Same two artifacts: the Flipsnack 2026 viewer and the FY2024-25 PDF.                                      |
| FY2025-26 viewer (Flipsnack)           | <https://www.flipsnack.com/5CABFCFF8D6/cleanco-queensland-annual-report-2026>                                  | **200**       | `text/html`, 6,698-byte JavaScript widget shell. No direct PDF URL; no parseable statement text.                                     |
| Embedded viewer player shell           | <https://player.flipsnack.com/index.html?hash=NUNBQkZDRkY4RDYraGpscjNmanh1Mw==>                                 | **200**       | `text/html`, 7,877 bytes. Same viewer, no PDF download exposed.                                                                     |
| Prior-year direct PDF (NOT current)    | <https://cleancoqueensland.com.au/wp-content/uploads/Annual_Report_2025_Accessible_PDF.pdf>                    | **200**       | `application/pdf`, 3,959,915 bytes, `last-modified: Mon, 29 Sep 2025 23:00:28 GMT`. This is the FY2024-25 report.                   |
| Official WordPress media search (2026) | <https://cleancoqueensland.com.au/wp-json/wp/v2/media?search=annual%20report%202026&per_page=50>               | **200**       | `application/json`, body `[]` (2 bytes). No FY2025-26 annual-report media item exists.                                              |
| Official WordPress media search (all)  | <https://cleancoqueensland.com.au/wp-json/wp/v2/media?search=annual%20report&per_page=100>                     | **200**       | `application/json`, 30,909 bytes, 11 items. Newest annual-report PDF is `Annual_Report_2025_Accessible_PDF.pdf` dated 2025-09-29.   |
| Official WordPress media (since FY26)  | <https://cleancoqueensland.com.au/wp-json/wp/v2/media?after=2025-07-01T00:00:00&per_page=100>                  | **200**       | `application/json`, 90 items. Only post-2025 PDFs are policies, charters, community-fund flyers and a gas-market form; no annual report. |
| Official WordPress site search         | <https://cleancoqueensland.com.au/wp-json/wp/v2/search?search=annual%20report%202026&per_page=50>              | **200**       | `application/json`, 1,380 bytes, 3 results: the publications page, the publication-scheme page and corporate governance. No PDF.    |
| Official sitemap index                 | <https://cleancoqueensland.com.au/sitemap_index.xml>                                                           | **200**       | 981 bytes. Child sitemaps are pages/posts/team/images/categories/tags; the page sitemap lists the publications page, no FY2025-26 PDF. |
| Robots                                 | <https://cleancoqueensland.com.au/robots.txt>                                                                  | **200**       | 182 bytes; no annual-report document location.                                                                                     |

No official direct FY2025-26 PDF was found on the site, its uploads, its WordPress media API, its
WordPress search or its sitemap. No unofficial/search-engine copy was used.

## 2. Exact document

**There is no parseable official FY2025-26 document to archive.** The current report exists only as
the official Flipsnack flipbook:

- **Title:** CleanCo Queensland Annual Report 2026.
- **Publisher of the viewer:** Flipsnack collection embedded by CleanCo Queensland.
- **URL:** <https://www.flipsnack.com/5CABFCFF8D6/cleanco-queensland-annual-report-2026>.
- **Format:** HTML/JavaScript viewer shell (6,698 bytes); no PDF, no statement text, no printed unit
  accessible to a parser.

The only direct annual-report PDF on the official site is explicitly **not** the current report:

- **File:** `Annual_Report_2025_Accessible_PDF.pdf`.
- **Bytes:** 3,959,915.
- **Last modified:** 2025-09-29, i.e. the report for the year ended 30 June 2025 (FY2024-25).
- **Use:** recorded as evidence only. Not archived as the current source, not parsed, and not ingested.

## 3. Why this is an access gap, not a unit or reconciliation gap

The adapter never reaches a statement, so there is no printed unit to gate and no face statement to
reconcile. The gap is upstream of parsing:

- The FY2025-26 report is published as a Flipsnack flipbook. A Flipsnack viewer is an official
  publication channel, but it is a JavaScript widget shell, not a PDF with extractable text.
- The site exposes no `wp-content/uploads/...FY2025-26...pdf` download, no media-library item and no
  sitemap entry for one.
- The only direct PDF is the prior FY2024-25 report. Ingesting it would substitute a stale year for
  the current year, which the brief forbids.

The adapter therefore records a deferred document for the Flipsnack viewer with the exact reason and
emits **0 rows**.

## 4. Ingest proof (shared dev DB)

The targeted SOC ingest runs with `SOC_ONLY_SOURCE_IDS=qld-cleanco` against the shared
`ausspend_dev` development database selected by `MONGO_URL`. Captured proof from the run:

- `measures` for `source_id=qld-cleanco`: **0**.
- `data_sources.records_ingested`: **0**; status `degraded` with the exact Flipsnack/access-gap
  reason in `errors`.
- `ingestion_logs`: a `partial` log with `records_fetched=0`, `records_upserted=0` and the exact
  access-gap reason.
- `deferred_soc_documents`: one `deferred` record for the FY2025-26 Flipsnack viewer.
- SOC total: **190 before and 190 after** (no rows added).
- No stale-year row: zero measures with `source_id=qld-cleanco` and zero rows for fiscal year
  `2024-25`.
- No QLD/state/national aggregate row and no combined entity row.

The exact command and captured output are in the close-out result for this item.

## 5. No-total / no-cross-entity rule

- CleanCo Queensland Limited is one Queensland GOC. No other QLD GOC or statutory body, no WA/NSW
  entity, no GOC total, no QLD total and no national total is created.
- The stale prior-year PDF is not added to any series.
- Revenue, total expenses and components would overlap if a future report were parsed; they would be
  published rows, not an additive spending series. No aggregate row is emitted.

## 6. Implementation and tests

- Adapter: `server/src/connectors/soc/qld/cleanco.ts`.
- Registration: `server/src/connectors/registry.ts`, `server/src/connectors/index.ts`,
  `server/src/api/soc.ts`, `client/src/pages/SocPage.tsx`, `scripts/ingest-soc.ts`.
- Tests: `server/test/qld-cleanco.test.ts` — discovery/latest, official-page-first with documented
  fallback, stale-year rejection, Flipsnack access-gap deferral, future direct-PDF deferral, natural
  key/idempotency and no-cross-entity aggregate.
- The adapter is entity-level only and never deploys by itself; no deploy was run.
