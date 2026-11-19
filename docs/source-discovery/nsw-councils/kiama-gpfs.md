# Kiama Municipal Council — Annual Report Financial Statements (FY2024-25)

Source id `kiama-gpfs` (NSW local government). One council only; entity-level rows, no council total
and no cross-council or state/federal addition.

**Status: registered but deferred with 0 rows.** The official FY2024-25 annual report is
annual-report-only for this item: it is a narrative report with an un-audited "Consolidated operating
results" summary and ends at the Authorisation and version control page, so it does **not** contain the
audited GPFS Income Statement, Statement of Comprehensive Income, Statement of Financial Position,
Statement of Cash Flows, notes or B1-1 section. The separate current-year FY2024-25 Financial
Statements PDF is recorded but was not substituted.

## 0. Stale-year check

The work-item title said FY2024-25. The official **Annual Reports and Financial Statements** page was
checked on 2026-11-20 and lists **Annual Report 2024-25** (PDF, 15MB) as the latest annual report. The
same page lists the separate current-year **Financial-Statements-2024-25** (PDF, 10MB). No FY2025-26
annual report was published. The current-year FS is not an older prior-year substitute, but it is out
of scope for this annual-report-only item; no FY2025-26 document was substituted either. A 404/JS-only
later-year link would be recorded as a gap, not a reason to fabricate.

## 1. Source and year

- Publisher: **Kiama Municipal Council**.
- Document: **Annual Report 2024-25** for the year ended 30 June 2025 — FY2024-25. The PDF is
  15,525,717 bytes and 92 pages.
- Official page:
  <https://www.kiama.nsw.gov.au/Council/Community-Reports/Annual-Reports-and-Financial-Statements>.
- Current exact document:
  <https://www.kiama.nsw.gov.au/files/sharedassets/public/v/2/council/council-plans-amp-reports/2024-25-annual-report-final.pdf>.
  The same URL is the documented official fallback pin. (The listing's `/v/1/` href redirects to this
  `/v/2/` URL and returns the same bytes.)

## 2. Access, discovery and fetch

The inventory listed the annual report as annual-report-only and not yet confirmed ingest-ready. In
this retrieval run (2026-11-20) **both the page and the PDF returned `200`** to `curl/8.5.0` (the PDF
as `application/pdf`, 15,525,717 bytes, `PDF document, version 1.4`). The connector uses the existing
plain fetch/archive path and a documented official pin fallback; no browser path or mirror was
introduced.

Discovery parses only the direct `.pdf` uploads labelled "Annual Report YYYY-YY". The separate
"Financial-Statements-2024-25" PDF is not an annual report label, and the 2022-23 "Addendum" is
excluded, so neither can be selected as the annual report.

## 3. Archive (outside the repo)

The exact downloaded bytes are archived outside the repository under the configured source-archive
root, with the relative archive path `kiama-gpfs/2024-25-annual-report-final.pdf`:

- URL: `https://www.kiama.nsw.gov.au/files/sharedassets/public/v/2/council/council-plans-amp-reports/2024-25-annual-report-final.pdf`
- retrieval date: 2026-11-20
- bytes: **15,525,717**
- SHA-256: `dd65cda214df712a9cd3f02f8fcb3c3cb17dd73c58584438d7ab15b01ebbb8ea`
- content type: `application/pdf`

No PDF is committed. The fixture and this note contain only the relative archive path.

## 4. Exact gap and deferral

The annual report is 92 pages. Its contents (page 3) list no financial-statements section; the only
finance content is the **Consolidated operating results 2024-2025** summary on page 19
(Actual/Budget/Variance $'000, income and expense components, net operating result `(7,309)`). That is
an un-audited narrative summary, not an audited GPFS primary statement, and it has no balance sheet,
comprehensive income, cash-flow or B1-1 presentation. The report ends at the **Authorisation and
version control** page (page 91). The parser therefore returns:

```
audited GPFS section not found in the FY2024-25 annual report; page 19 contains only the un-audited
Consolidated operating results summary; the report ends at the Authorisation and version control page
(page 91); no Income Statement/Statement of Comprehensive Income/Statement of Financial Position/
Statement of Cash Flows/B1-1 with printed subtotals was found; the official Reporting page publishes a
separate FY2024-25 Financial Statements PDF, and this annual-report-only item does not substitute that
standalone report; no rows ingested
```

The report is not scanned; its narrative and summary pages are text-native. Even if the consolidated
operating result were treated as a "council total", the brief forbids ingesting a council total or
narrative-only rows, and the summary has no audited statement slice or reconciling subtotals. The
contents page also names "Authorisation and version control"; the parser selects the real page by also
requiring "Owner/Responsible Officer", so the reported page number is 91, not 3.

## 5. Separate current-year FY2024-25 Financial Statements (recorded, out of scope)

The same official page publishes a separate current-year document:

- PDF:
  <https://www.kiama.nsw.gov.au/files/sharedassets/public/v/1/council/council-plans-amp-reports/financial-plans-and-annual-reports/kiama-municipal-council-financial-statements-2024-25.pdf>
- bytes: **10,095,862**
- SHA-256: `2230fb55dcd165f96f718fa0feaba5aeee72feccb4ed7405b8b818239eb980de`
- 93 pages; contains the audited GPFS and the independent auditor's report (Income Statement p4,
  Statement of Comprehensive Income p5, Statement of Financial Position p6, Statement of Cash Flows p8,
  B1-1 functions p13, independent auditor's report p57).

This is the correct source for a future standalone-AFS cure, but this annual-report-only item did
**not** fetch it into the connector, parse it or ingest it, and did not substitute it. It is recorded so
a cure item can be scoped and reconciled without re-discovery.

## 6. Extracted entity rows (0, deferred)

No measure rows are emitted. The connector does not publish the un-audited summary as a partial slice
and does not invent a council total or any cross-council row. If a future annual report actually
contains the audited GPFS section, the connector's page predicate will detect it and still defer rather
than partially parse it; a new verified adapter would be required.

## 7. No-total / no-cross-council rule

- Kiama Municipal Council is one entity. No council total, no state/national total and no sum with
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
  'https://www.kiama.nsw.gov.au/Council/Community-Reports/Annual-Reports-and-Financial-Statements'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  -A 'curl/8.5.0' \
  'https://www.kiama.nsw.gov.au/files/sharedassets/public/v/2/council/council-plans-amp-reports/2024-25-annual-report-final.pdf'

# Focused connector tests.
TEST_MONGO_URL="mongodb://127.0.0.1:27118/ausspend_test_kiamagpfs" \
  npx vitest run --project server server/test/kiama-gpfs.test.ts
```

The focused suite covers annual-report discovery/latest selection (excluding the separate FS and the
2022-23 addendum), prior-year and future-year rejection, the documented-pin fallback, the plain-UA
header, the annual-report FS-section absence with the exact page-level gap (including the
contents-page false positive), natural-key stability, and additive-only 0-row ingestion that preserves
existing rows and marks the source `degraded`. A live connector run against the real PDF returned
`LIVE_RECORDS 0` with the exact gap above.
