# Cessnock City Council — Annual Report Financial Statements (FY2024-25)

Source id `cessnock-gpfs` (NSW local government). One council only; entity-level rows, no council
total and no cross-council or state/federal addition.

**Status: registered but deferred with 0 rows.** The official FY2024-25 annual report is
annual-report-only for this item: it is a narrative report with a narrative "Financial summary" and
ends at the Attestation Statement, so it does **not** contain the audited GPFS Income Statement,
Statement of Comprehensive Income, Statement of Financial Position, Cash Flow Statement, notes or
auditor's report. The separate FY2024-25 Annual Financial Statements was not substituted.

## 0. Stale-year check

The work-item title said FY2024-25. The official **Annual Report** page was checked on 2026-11-20 and
lists **Annual Report 2024-2025** (PDF, 16MB) as its only annual-report attachment. The separate
**Annual Financial Statements** page lists both an FY2025-26 document (year ended 30 June 2026) and
the FY2024-25 document. The newer FY2025-26 document is out of scope for this FY2024-25 item and was
not substituted; no older standalone report was substituted either. A 404/JS-only later-year link
would be recorded as a gap, not a reason to fabricate.

## 1. Source and year

- Publisher: **Cessnock City Council**.
- Document: **Annual Report 2024-2025** for the year ended 30 June 2025 — FY2024-25. The PDF
  (16,506,336 bytes) is a 103-page spread document covering printed pages 2-203.
- Official page:
  <https://www.cessnock.nsw.gov.au/Council/Forms-and-documents/Community-information/Annual-Report>.
- Current exact document:
  <https://www.cessnock.nsw.gov.au/files/assets/public/v/1/hptrim/website-integrated-planning-reporting-documents-do-not-change/2025_annual-report-cessnock-city-council_2024-2025_spread.pdf>.
  The same URL is the documented official fallback pin.

The Annual Report page states:

> "This annual report has been prepared in accordance with **Section 428** of the Local Government
> Act 1993. The Annual Financial Statements for the Year Ended 30 June 2025
> [can be viewed here](https://www.cessnock.nsw.gov.au/Council/Forms-and-documents/Finance-and-budget/Annual-Financial-Statements)."

So the audited financial statements are published separately; they are not embedded in the annual
report.

## 2. Access, discovery and fetch

The inventory listed the annual report as annual-report-only and not yet confirmed ingest-ready. In
this retrieval run (2026-11-20) **both the Annual Report page and the PDF returned `200`** to
`curl/8.5.0` (the PDF as `application/pdf`, 16,506,336 bytes, `PDF document, version 1.7`). The
connector uses the existing plain fetch/archive path and a documented official pin fallback; no
browser path or mirror was introduced.

Discovery parses the direct `.pdf` upload whose visible label ("Annual Report 2024-2025") and file
name carry the year pair. The separate Annual Financial Statements pointer is an HTML page, not a
PDF, so it is never selected as the annual report.

## 3. Archive (outside the repo)

The exact downloaded bytes are archived outside the repository under the configured source-archive
root, with the relative archive path
`cessnock-gpfs/2025_annual-report-cessnock-city-council_2024-2025_spread.pdf`:

- URL: `https://www.cessnock.nsw.gov.au/files/assets/public/v/1/hptrim/website-integrated-planning-reporting-documents-do-not-change/2025_annual-report-cessnock-city-council_2024-2025_spread.pdf`
- retrieval date: 2026-11-20
- bytes: **16,506,336**
- SHA-256: `d111d81c727c7e65f76866487e6a470bf717d301ffbe36d84fd88bba0411a494`
- content type: `application/pdf`

No PDF is committed. The fixture and this note contain only the relative archive path.

## 4. Exact gap and deferral

The parser searched the annual report for the audited GPFS statement pages and found none. The 103
spread pages were text-extracted and searched for Income Statement, Statement of Comprehensive
Income, Statement of Financial Position, Cash Flow Statement, notes, B1-1 and auditor's report
phrases; none is present. The only finance content is the narrative **Financial summary** on PDF
page 13 (printed pp. 24-25): "What were our sources of income?" with $71.2m rates, $61.3m grants and
contributions, $26.4m non-cash dedications, $4m other revenues and a percentage split. The report
ends at the **Attestation Statement** on PDF page 101 (printed pp. 200-201). The exact rejection is:

```
audited GPFS section not found in the FY2024-25 annual report; page 13 contains only the narrative
Financial summary; the report ends at the Attestation Statement on page 101; no Income
Statement/Statement of Comprehensive Income/Statement of Financial Position/B1-1 with printed
subtotals was found; the official Annual Report page states the Annual Financial Statements for the
Year Ended 30 June 2025 can be viewed separately, and this annual-report-only item does not
substitute that standalone report; no rows ingested
```

The annual report is not scanned; its narrative and summary pages are text-native. Even if the
Financial summary figures were treated as a "council total", the brief forbids ingesting a council
total or narrative-only rows, and the summary has no printed statement-line slice or reconciling
subtotals.

## 5. Extracted entity rows (0, deferred)

No measure rows are emitted. The connector does not publish the narrative summary as a partial slice
and does not invent a council total or any cross-council row. If a future annual report actually
contains the audited GPFS section, the connector's page predicate will detect it and still defer
rather than partially parse it; a new verified adapter would be required.

## 6. Separate FY2024-25 Annual Financial Statements (recorded, out of scope)

The Annual Report page links to a separate Annual Financial Statements page:

- page: <https://www.cessnock.nsw.gov.au/Council/Forms-and-documents/Finance-and-budget/Annual-Financial-Statements>
- FY2024-25 PDF (year ended 30 June 2025):
  <https://www.cessnock.nsw.gov.au/files/assets/public/v/2/hptrim/website-finance-budget-documents-do-not-change/ccc-_-annual_financial_statements-2024-2025-final-with-audit-opinion.pdf>

This is the exact location of the audited statements, but this annual-report-only item did **not**
fetch, parse or ingest it. It is recorded so a future standalone-AFS item can be scoped, verified and
reconciled without re-discovery.

## 7. No-total / no-cross-council rule

- Cessnock City Council is one entity. No council total, no state/national total and no sum with
  another council, the `dubbo-council` budget/estimate rows, a government program, the PNFC benchmark
  or the OLG summary layer is created.
- The FY2024-25 annual report is the reporting boundary; no older standalone report and no newer
  FY2025-26 document is substituted.
- No rows are emitted at all.

## 8. How to verify

```bash
# Official page and exact FY2024-25 annual report (200 in this retrieval run).
curl -sL -o /dev/null -w '%{http_code}\n' \
  -A 'curl/8.5.0' \
  'https://www.cessnock.nsw.gov.au/Council/Forms-and-documents/Community-information/Annual-Report'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  -A 'curl/8.5.0' \
  'https://www.cessnock.nsw.gov.au/files/assets/public/v/1/hptrim/website-integrated-planning-reporting-documents-do-not-change/2025_annual-report-cessnock-city-council_2024-2025_spread.pdf'

# Focused connector tests.
TEST_MONGO_URL="mongodb://127.0.0.1:27118/ausspend_test_cessnockgpfs" \
  npx vitest run --project server server/test/cessnock-gpfs.test.ts
```

The focused suite covers annual-report discovery/latest selection (prior-year and future-year
rejection), the documented-pin fallback, the plain-UA header, the annual-report FS-section absence
with the exact page-level gap, the "GPFS-like pages still defer" guard, natural-key stability, and
additive-only 0-row ingestion that preserves existing rows and marks the source `degraded`.
