# NSW council GPFS — Snowy Valleys Council FY2024-25 (DEFERRED)

**Status:** DEFERRED. No `snowy-valleys-gpfs` connector was registered and **no rows were ingested or
invented**. One council, one audited year. The exact PDF was retrieved and SHA-256 recorded; no PDF or
raw table is committed.
**Entity:** Snowy Valleys Council only. **No council total, no cross-council addition.**

**Checked:** 2026-11-19 (Australia/Sydney).

## 0. Decision and premise falsifier

The FY2024-25 standalone signed audited financial statements are a **scanned image-only PDF with no
text layer**. It cannot be parsed for printed statement lines or printed reconciling totals, so the
adapter is deferred with **0 rows** and the exact gap below. No FY2025-26 audited standalone
statements are published (only a 2025-26 six-monthly progress report), so there is no newer
machine-readable year to prefer. No prior year, narrative figure or annual-report-only substitute was
used.

## 1. Discovery and access log (with UA probe)

| Step                                                | URL                                                                                                           | HTTP  | Result                                                                 |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ----- | ---------------------------------------------------------------------- |
| Official Integrated Reporting page (plain UA)       | <https://www.snowyvalleys.nsw.gov.au/Council/Strategies-Plans-and-Reporting/Integrated-Planning-and-Reporting/Integrated-Reporting> | **200** | `text/html`; the page lists FY2024-25 as the newest audited statements |
| FY2024-25 standalone signed AFS (plain UA)          | <https://www.snowyvalleys.nsw.gov.au/files/assets/public/v/1/reports-amp-strategies/202425-ipampr/2024-2025-signed-audited-financial-statements.pdf> | **200** | `application/pdf`, 42,979,731 bytes, 99 PDF pages, scanned images      |
| Same PDF (bare Chrome UA, inventory note)           | same URL                                                                                                       | **403** | `text/html` — WAF rejects a bare browser UA (inventory record)          |

**Method recorded.** The host's Akamai WAF returns 200 `application/pdf` to a plain client UA and 403
to a bare Chrome UA. A future implementation must send a plain UA. No connector was registered.

## 2. Exact document

- **Title:** 2024-2025 Signed Audited Financial Statements.
- **Financial year:** 2024-25, for the year ended 30 June 2025.
- **URL:** `https://www.snowyvalleys.nsw.gov.au/files/assets/public/v/1/reports-amp-strategies/202425-ipampr/2024-2025-signed-audited-financial-statements.pdf`
- **Bytes:** 42,979,731.
- **PDF pages:** 99.
- **SHA-256:** `e21e519a60f7e65ad3cb33ab1e601cdbe385840c70b0a67852a1d2e0a50e4162`.
- **Archive:** the exact PDF was retrieved and verified locally; it is not committed. A future
  connector must archive it outside the repo under the configured source-archive root.

## 3. Why it cannot be parsed

- The PDF contains **99 `/Subtype/Image` objects and zero fonts** (`/Font`/`FontFile` count 0): every
  page is a scanned image.
- The repository's `pdf-extract` (pdfjs) returns **0 text characters on every one of the 99 pages**.
- No page yields an Income Statement, Statement of Comprehensive Income, B1-1 statement line,
  printed `$ '000` unit, or any printed subtotal/result bridge.
- No OCR tool is installed in this environment (`tesseract`, `pytesseract`, `pdftotext` unavailable),
  and OCR-guessing line values would not be the established zero-tolerance pipeline.

Because the required printed statement lines and printed reconciling totals are not machine-readable,
the premise falsifier applies: the item stops with **0 rows** and this exact access/extraction gap.
Reading outline/narrative figures or OCR-guessing line values would fabricate data and is not done.

## 4. What was not used

- **FY2025-26:** the Integrated Reporting page has no audited FY2025-26 standalone statements; the
  only 2025-26 document is a **six-monthly progress report**, not audited statements. It was
  rejected.
- The **FY2024-25 annual report including audited financial statements** (a separate PDF) was **not**
  used: the brief prohibits an annual-report-only substitute, and the standalone statements PDF is
  the correct source.
- No prior year (2023-24) or narrative summary figure was substituted.

## 5. Database record and counts (no rows)

- `measures` for `source_id = snowy-valleys-gpfs`: **0**.
- Total measures: **999,253** (unchanged).
- SOC measures (`jurisdiction_level: "soc"`): **205** (unchanged).
- Active GPFS `data_sources`: **92** (unchanged; no connector was registered).
- A `deferred_soc_documents` record for `source_id = snowy-valleys-gpfs` records the exact gap:
  standalone statements URL, SHA-256 `e21e519a…50e4162`, fiscal year 2024-25, status `deferred`, and
  the reason "99-page scanned image-only PDF with no text layer; no statement lines or printed totals
  are readable".

## 6. How to verify

```bash
# The page and the standalone PDF both return 200 to a plain UA.
curl -sL -o /dev/null -w '%{http_code}\n' \
  -A 'curl/8.5.0' 'https://www.snowyvalleys.nsw.gov.au/Council/Strategies-Plans-and-Reporting/Integrated-Planning-and-Reporting/Integrated-Reporting'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  -A 'curl/8.5.0' \
  'https://www.snowyvalleys.nsw.gov.au/files/assets/public/v/1/reports-amp-strategies/202425-ipampr/2024-2025-signed-audited-financial-statements.pdf'

# The PDF has 99 image objects and zero fonts; pdfjs extraction returns 0 characters per page.
MONGO_URL='<shared-dev MONGO_URL>' mongosh "$MONGO_URL" --quiet --eval 'printjson({measures:db.measures.countDocuments({source_id:"snowy-valleys-gpfs"}), total:db.measures.countDocuments({}), soc:db.measures.countDocuments({jurisdiction_level:"soc"}), activeGpfs:db.data_sources.countDocuments({source_id:/gpfs$/,status:"active"}), deferred:db.deferred_soc_documents.findOne({source_id:"snowy-valleys-gpfs"},{projection:{_id:0,source_id:1,fiscal_year:1,status:1,reason:1}})})'
```

## 7. If this is revisited

A future item must supply a **machine-readable** audited FY2024-25 financial statements PDF (or a
text layer/OCR of this exact standalone PDF that preserves every printed line and total), including
the Income Statement, Statement of Comprehensive Income and B1-1, with an explicit `$ '000` unit and
printed reconciling totals. Do not substitute the annual report, a prior year, or narrative figures.
If a FY2025-26 audited standalone PDF is published, retarget to it only if it actually downloads and
is machine-readable.
