# NSW council GPFS — Central Darling Shire Council FY2024-25 (DEFERRED)

**Status:** DEFERRED. No `central-darling-gpfs` connector was registered and **no rows were
ingested or invented**. One council, one audited year. The exact annual-report PDF is archived outside
the repo; no PDF or raw table is committed.
**Entity:** Central Darling Shire Council only. **No council total, no cross-council addition.**

**Checked:** 2026-11-19 (Australia/Sydney).

## 0. Decision and premise falsifier

The statutory financial statements section in the FY2024-25 annual report is **scanned images with no
text layer**. It cannot be parsed for printed statement lines or printed reconciling totals, so the
adapter is deferred with **0 rows** and the exact gap below. The 2025-26 "GPFS" link is a one-page
presentation notice, not statements, and was rejected; no prior year or narrative figure was
substituted.

## 1. Discovery and access log (with UA probe)

| Step                              | URL                                                                                          | HTTP    | Result                                                                 |
| --------------------------------- | -------------------------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------- |
| Official FY2024-25 annual report (plain UA) | <https://www.centraldarling.nsw.gov.au/files/assets/public/v/1/governance/annual-report/2024-2025-annual-report/annual-report-2024-2205-final.pdf> | **200** | `application/pdf`, 9,421,161 bytes, 151 PDF pages.                    |
| Same PDF (bare Chrome UA)         | same URL                                                                                     | **403** | `text/html`, 563 bytes — WAF rejects a bare browser UA.                |

**Method recorded.** The host's Akamai WAF returns 200 `application/pdf` to a plain client UA and 403
to a bare Chrome UA. No connector was registered; a future implementation must send a plain UA.

## 2. Exact document

- **Title:** Central Darling Shire Council Annual Report 2024-2025.
- **Financial year:** 2024-25, for the year ended 30 June 2025.
- **URL:** `https://www.centraldarling.nsw.gov.au/files/assets/public/v/1/governance/annual-report/2024-2025-annual-report/annual-report-2024-2205-final.pdf`
- **Bytes:** 9,421,161.
- **PDF pages:** 151.
- **SHA-256:** `e00628ff2d75c2c71c354dffca1f2c7e1086c8ff566f1b5279fc3f1a9e540070`.
- **Archive:** the exact PDF is archived outside the repo under the configured source-archive root
  (not committed).

## 3. Where the statutory statements are, and why they cannot be parsed

- The annual report's table of contents says **"Council's Audited Financial Reports: Starts page 45"**.
- PDF page 49 carries the section title **"Audited Financial Statements 2024 - 2025"** (printed page
  45).
- PDF pages **50–151** (102 pages) are **scanned images with no text layer**. pdfjs text extraction
  returns only `Page 46`, `Page 47`, …, i.e. the page number, for every one of those pages.
- No page in the financial-statements section yields an Income Statement, Statement of Comprehensive
  Income, B1-1 "Total functions and activities" row, printed `$ '000` unit, or any printed
  subtotal/result bridge.

Because the required printed statement lines and printed reconciling totals are not machine-readable,
the premise falsifier applies: the item stops with **0 rows** and this exact access/extraction gap.
Reading outline/narrative figures or OCR-guessing line values would fabricate data and is not done.

## 4. What was not used

- The **2025-26 "GPFS" link** is a one-page presentation notice, not statements; rejected.
- No **prior year** (2023-24) document and no **narrative annual-report summary** figure was
  substituted.
- No standalone full GPFS PDF is published by the council.

## 5. Database record and counts (no rows)

- `measures` for `source_id = central-darling-gpfs`: **0**.
- Total measures: **998,728** (unchanged).
- SOC measures (`jurisdiction_level: "soc"`): **205** (unchanged).
- Active GPFS `data_sources`: **61** (unchanged; no connector was registered).
- A `deferred_soc_documents` record for `source_id = central-darling-gpfs` records the exact gap:
  annual-report URL, SHA-256 `e00628ff…e540070`, fiscal year 2024-25, status `deferred`, and the
  reason "pages 49–151 are scanned with no text layer; no statement lines or printed totals are
  readable".

## 6. How to verify

```bash
# Plain UA succeeds; bare Chrome UA returns 403.
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  'https://www.centraldarling.nsw.gov.au/files/assets/public/v/1/governance/annual-report/2024-2025-annual-report/annual-report-2024-2205-final.pdf'

# The annual report's FS section is scanned: inspect PDF pages 49–151, which contain only page numbers.
MONGO_URL='<shared-dev MONGO_URL>' mongosh "$MONGO_URL" --quiet --eval 'printjson({measures:db.measures.countDocuments({source_id:"central-darling-gpfs"}), total:db.measures.countDocuments({}), soc:db.measures.countDocuments({jurisdiction_level:"soc"}), activeGpfs:db.data_sources.countDocuments({source_id:/gpfs$/,status:"active"}), deferred:db.deferred_soc_documents.findOne({source_id:"central-darling-gpfs"},{projection:{_id:0,source_id:1,fiscal_year:1,status:1,reason:1}})})'
```

## 7. If this is revisited

A future item must supply a **machine-readable** audited FY2024-25 financial statements PDF (or the
same annual report with a text layer/OCR that preserves every printed line and total), including the
Income Statement, Statement of Comprehensive Income and B1-1, with an explicit `$ '000` unit and
printed reconciling totals. Do not substitute the one-page 2025-26 notice, a prior year, or narrative
annual-report figures.
