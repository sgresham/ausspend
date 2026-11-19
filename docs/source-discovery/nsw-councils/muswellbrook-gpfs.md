# Muswellbrook Shire Council — Annual Report Financial Statements (FY2024-25)

Source id `muswellbrook-gpfs` (NSW local government). One council only; entity-level rows, no council
total and no cross-council or state/federal addition.

**Status: registered but deferred with 0 rows.** The 196-page FY2024-25 annual report embeds the
audited GPFS section (contents list General Purpose Financial Statements at page 79), but the GPFS
section (pages 79-171) has no text layer: every page contains only the running header/footer and the
statement content is vector-drawn, so the printed lines, subtotals and currency unit cannot be read or
reconciled without OCR. The narrative Financial Reporting summary (pages 74-77) is in $millions and is
not the audited GPFS. No standalone FY2024-25 GPFS PDF was found.

## 0. Stale-year check

The work-item title said FY2024-25. The official **Strategic Reporting** page was checked on 2026-11-20
and lists **2024-2025 Annual Report** (PDF, 34MB) as the latest annual report, plus older annual
reports, the State of the Shire report and the 2016-2021 End of Term report. No FY2025-26 annual report
was published. A 404/JS-only later-year link would be recorded as a gap, not a reason to fabricate.

## 1. Source and year

- Publisher: **Muswellbrook Shire Council**.
- Document: **2024-2025 Annual Report** for the year ended 30 June 2025 — FY2024-25. The PDF is
  35,369,135 bytes and 196 pages.
- Official page:
  <https://www.muswellbrook.nsw.gov.au/strategic-reporting/>.
- Current exact document:
  <https://www.muswellbrook.nsw.gov.au/wp-content/uploads/2025/12/2024-2025-Annual-Report-FINAL-Ready-for-Endorsement-1.pdf>.
  The same URL is the documented official fallback pin.

## 2. Access, discovery and fetch

The inventory listed the annual report as annual-report-only and not yet confirmed ingest-ready. In
this retrieval run (2026-11-20) **both the page and the PDF returned `200`** to `curl/8.5.0` (the PDF
as `application/pdf`, 35,369,135 bytes, `PDF document, version 1.7`). The connector uses the existing
plain fetch/archive path and a documented official pin fallback; no browser path or mirror was
introduced.

The current report is rendered as a `download` block whose visible anchor text is just "PDF (34 MB)";
the document name "2024-2025 Annual Report" is in the preceding `download__name` line. The connector
pairs the block's name with its href, so it still discovers and selects the annual report. Older
annual reports, the State of the Shire report and the End of Term report are excluded.

## 3. Archive (outside the repo)

The exact downloaded bytes are archived outside the repository under the configured source-archive
root, with the relative archive path
`muswellbrook-gpfs/2024-2025-Annual-Report-FINAL-Ready-for-Endorsement-1.pdf`:

- URL: `https://www.muswellbrook.nsw.gov.au/wp-content/uploads/2025/12/2024-2025-Annual-Report-FINAL-Ready-for-Endorsement-1.pdf`
- retrieval date: 2026-11-20
- bytes: **35,369,135**
- SHA-256: `45ecbde31f0fb1152d0edb30a60506a7fa3f75abadccb71a5d6e858dbe0cd9b9`
- content type: `application/pdf`

No PDF is committed. The fixture and this note contain only the relative archive path.

## 4. Embedded GPFS present but not machine-readable

The annual report contents (page 3) list:

- Annual Financial Statements 78
- General Purpose FInancial Statements 79
- Special Purpose FInancial Statements 172
- Special Schedules 185

So the GPFS is **embedded** at pages 79-171 (93 pages). However, a pdf.js text extraction of all 196
pages returns only the running header/footer for every page in that range (26-30 characters per page;
e.g. page 79 = "Annual Report 2024-2025 79", page 80 = "Muswellbrook Shire Council 80"). The statement
content is drawn as vector paths: pdf.js operator lists show two `beginText` operations (the
header/footer) and **no `showText` operators** for the body, with **1,302-1,546 `constructPath`
operations per page**. There is therefore no printed line, subtotal, result bridge or currency unit that
can be parsed or reconciled at zero tolerance.

The narrative **Financial Reporting** summary on pages 74-77 is text-native but is in $millions and is
not the audited GPFS primary statements; it was not used. No standalone FY2024-25 GPFS PDF was found on
the official reporting page.

The parser therefore returns 0 rows with the exact gap:

```
audited GPFS section is present in the FY2024-25 annual report but is not machine-readable; page 3
lists General Purpose Financial Statements at page 79, but the GPFS section (pages 79-171) has no text
layer — every page contains only the running header/footer and the statement content is vector-drawn,
so no printed line, subtotal or currency unit can be read or reconciled without OCR; the narrative
financial summary on page 74 is in $m and is not the audited GPFS; no standalone FY2024-25 GPFS PDF was
found on the official reporting page; no rows ingested
```

OCR was not performed: reading the vector-drawn statements by any non-deterministic method would be
fabrication rather than a zero-tolerance reconciliation. A future OCR/verified-adapter item would be
required.

## 5. Extracted entity rows (0, deferred)

No measure rows are emitted. The connector does not publish the narrative $m summary as a partial
slice and does not invent a council total or any cross-council row. If a future annual report contains
a text-layer GPFS section, the connector's page predicate will detect it and still defer rather than
partially parse it; a new verified adapter would be required.

## 6. No-total / no-cross-council rule

- Muswellbrook Shire Council is one entity. No council total, no state/national total and no sum with
  another council, the `dubbo-council` budget/estimate rows, a government program, the PNFC benchmark
  or the OLG summary layer is created.
- The FY2024-25 annual report is the reporting boundary; no older standalone report and no newer
  FY2025-26 document is substituted.
- No rows are emitted at all.

## 7. How to verify

```bash
# Official page and exact FY2024-25 annual report (200 in this retrieval run).
curl -sL -o /dev/null -w '%{http_code}\n' \
  -A 'curl/8.5.0' \
  'https://www.muswellbrook.nsw.gov.au/strategic-reporting/'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  -A 'curl/8.5.0' \
  'https://www.muswellbrook.nsw.gov.au/wp-content/uploads/2025/12/2024-2025-Annual-Report-FINAL-Ready-for-Endorsement-1.pdf'

# Embedded-GPFS text check: pages 79-171 return only the header/footer.
node - <<'JS'
const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
const fs = await import('node:fs');
const doc = await getDocument({ data: new Uint8Array(fs.readFileSync('ar.pdf')) }).promise;
for (const pn of [79, 80, 171]) {
  const page = await doc.getPage(pn);
  const tc = await page.getTextContent();
  const ops = await page.getOperatorList();
  let showText = 0;
  for (const fn of ops.fnArray) if (fn === 44 || fn === 45) showText++;
  console.log('page', pn, 'textItems', tc.items.length, 'showTextOps', showText, 'ops', ops.fnArray.length);
}
JS

# Focused connector tests.
TEST_MONGO_URL="mongodb://127.0.0.1:27118/ausspend_test_muswellbrookgpfs" \
  npx vitest run --project server server/test/muswellbrook-gpfs.test.ts
```

The focused suite covers annual-report discovery/latest selection (including the `download__name` block
whose anchor text is only "PDF (34 MB)"), exclusion of the State of the Shire and End of Term reports,
prior-year and future-year rejection, the documented-pin fallback, the plain-UA header, the embedded-
GPFS no-text-layer gap with the exact page range, natural-key stability, and additive-only 0-row
ingestion that preserves existing rows and marks the source `degraded`. A live connector run against
the real 196-page PDF returned `LIVE_RECORDS 0` with the exact gap above.
