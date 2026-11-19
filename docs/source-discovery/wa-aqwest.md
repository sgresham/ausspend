# WA SOC — Aqwest discovery gap (not officially resolvable)

**Status:** **ACCESS GAP — stopped; no adapter registered, no rows ingested.** The current Aqwest
annual report could not be resolved from the official publications page. Per the item brief, a
search-engine copy was **not** used. **Entity (not ingested):** Aqwest (Bunbury Water Corporation), a
WA Government Trading Enterprise.

**Checked:** 2026-11-19 (Australia/Perth).

## 1. Official pages probed

| Step                          | URL                                                                                                         | HTTP    | Result                                                                                       |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------- |
| Corporate-reports page        | <https://www.aqwest.com.au/properties-and-developments/publications?cat=corporate-reports>                   | **200** | `text/html` (833,342 bytes); category catalogue with an “Annual reports” option, but no PDF.  |
| Parent publications page      | <https://www.aqwest.com.au/properties-and-developments/publications>                                         | **200** | `text/html` (833,260 bytes); same JS-driven catalogue.                                       |
| Annual-reports category       | <https://www.aqwest.com.au/properties-and-developments/publications?cat=annual-reports>                      | **200** | `text/html` (833,330 bytes); the category is selected, but the served HTML has no PDF link.   |
| Official sitemap              | <https://www.aqwest.com.au/sitemap.xml>                                                                      | **200** | `application/xml` (29,821 bytes, 204 URLs); no annual-report page and no annual-report PDF.  |

## 2. What was and was not found

- The served HTML for the corporate-reports page and the parent page contains a client-side
  catalogue: a React/Next.js category filter with “Corporate reports”, “Annual reports”
  (`annual-reports`), “Water quality reports”, and other categories.
- The served HTML exposes ordinary PDFs for unrelated documents (policies, rebate forms, water
  quality, board charter, etc.) on `https://a-ap.storyblok.com/…`, but **no annual-report PDF**.
- Requesting `?cat=annual-reports` still returns the same page shell; the annual-report list is
  populated client-side (the page's JavaScript calls its content-delivery endpoint). The official
  sitemap lists no annual-report page or PDF.
- Therefore the official annual report is **not resolvable from the official page HTML/sitemap**
  without executing the site's client application or reverse-engineering its content API. The brief
  explicitly says to stop and document the gap in that case and not to use a search-engine copy.

## 3. Outcome

- **No annual-report PDF was archived** (there was no official URL to archive).
- **No `qld`/`wa` SOC rows were fabricated.** Aqwest is not registered as a source, so existing SOC
  counts are unchanged.
- No adapter (`server/src/connectors/soc/wa/aqwest.ts`), API/UI entry, or test was added; doing so
  would imply a source that could not be verified.
- The only change is this evidence document and the Aqwest note in `docs/SOC_MULTI_STATE.md`.

## 4. What would unblock it

An official Aqwest annual-report PDF URL (or a documented official tabled/fallback copy) is needed.
Once an official URL is available, the existing WA SOC pattern
(`water-corporation`/`synergy`/`western-power`/`horizon-power`/`fremantle-ports`/`developmentwa`/
`southern-ports`) can be followed: archive the exact PDF outside the repo with URL, retrieval date
and SHA-256, detect the printed unit, and reconcile the face statement at zero tolerance before any
row is emitted.

## 5. How to verify the gap

```bash
# Both pages return 200 but contain no annual-report PDF link.
curl -sSI -L -A 'Mozilla/5.0' 'https://www.aqwest.com.au/properties-and-developments/publications?cat=corporate-reports' | head -1
curl -sS -L -A 'Mozilla/5.0' 'https://www.aqwest.com.au/properties-and-developments/publications?cat=annual-reports' \
  | grep -oiE 'href="[^"]*annual[^"]*\.pdf[^"]*"' | head
# (no output)

# The official sitemap has no annual-report URL.
curl -sS -L -A 'Mozilla/5.0' 'https://www.aqwest.com.au/sitemap.xml' \
  | grep -oiE '<loc>[^<]*annual[^<]*</loc>'
# only https://aqwest.com.au/news/annual-supply-charge
```
