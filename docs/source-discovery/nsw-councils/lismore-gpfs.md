# Lismore City Council — Annual Report Financial Statements (FY2024-25)

Source id `lismore-gpfs` (NSW local government). One council only; entity-level rows, no council total
and no cross-council or state/federal addition.

**Status: registered but deferred with 0 rows.** The official FY2024-25 annual report is
annual-report-only for this item: it is a 74-page narrative and statutory-information report whose
contents end at Statutory Information and which has no GPFS primary statements. A separate current-year
FY2024-25 Financial reports PDF is published on the same official page and is recorded for a future
cure, but was not substituted or ingested.

## 0. Stale-year check

The work-item title said FY2024-25. The official **Annual and Financial Reports** page was checked on
2026-11-20 and lists **Annual Report 2024/25** (PDF, 10MB) as the latest annual report, plus the
separate current-year **Financial reports 2024/25** (PDF, 3MB). No FY2025-26 annual report was
published. The current-year FS is not an older prior-year substitute, but it is out of scope for this
annual-report-only item; no FY2025-26 document was substituted either. A 404/JS-only later-year link
would be recorded as a gap, not a reason to fabricate.

## 1. Source and year

- Publisher: **Lismore City Council**.
- Document: **Annual Report 2024/25** for the year ended 30 June 2025 — FY2024-25. The PDF is
  10,228,662 bytes and 74 pages.
- Official page:
  <https://www.lismore.nsw.gov.au/Council/Corporate-information/Annual-and-financial-reports>.
- Current exact document:
  <https://www.lismore.nsw.gov.au/files/assets/public/v/1/5.-council/6.-corporate-information/lcc-annual-report-2024-25-a4.pdf>.
  The same URL is the documented official fallback pin; the listing's
  `/5.-council/7.-about-council/...` href serves the same 10,228,662 bytes.

## 2. Access, discovery and fetch

The inventory listed the annual report as annual-report-only and not yet confirmed ingest-ready. In
this retrieval run (2026-11-20) **both the page and the PDF returned `200`** to `curl/8.5.0` (the PDF as
`application/pdf`, 10,228,662 bytes). The connector uses the existing plain fetch/archive path and a
documented official pin fallback; no browser path or mirror was introduced.

Discovery parses only the direct `.pdf` uploads labelled "Annual Report YYYY/YY". The separate
"Financial reports 2024/25" PDF, the signed attestation appendix, the State of our City report and the
Long Term Financial Plan are excluded, so none can be selected as the annual report.

## 3. Archive (outside the repo)

The exact downloaded bytes are archived outside the repository under the configured source-archive
root, with the relative archive path `lismore-gpfs/lcc-annual-report-2024-25-a4.pdf`:

- URL: `https://www.lismore.nsw.gov.au/files/assets/public/v/1/5.-council/6.-corporate-information/lcc-annual-report-2024-25-a4.pdf`
- retrieval date: 2026-11-20
- bytes: **10,228,662**
- SHA-256: `a6ff496fa5bfa9468088923e7ce880f86bf2132d55076934632da7927ee64a86`
- content type: `application/pdf`

No PDF is committed. The fixture and this note contain only the relative archive path.

## 4. Exact gap and deferral

The annual report is 74 pages. Its contents (page 3) list no financial-statements section: the last
listed section is **Statutory Information**, and the report ends at the back cover (page 74). Page 5
says the Annual Report "must also contain Statutory Reporting Information and Financial Statements",
but the published PDF does not embed them. The report is text-native; no page contains an Income
Statement, Statement of Comprehensive Income, Statement of Financial Position, Statement of Cash Flows
or B1-1 with printed subtotals. The parser therefore returns:

```
audited GPFS section not found in the FY2024-25 annual report; page 3 is the contents, whose last
listed section is Statutory Information and which has no financial-statements section; page 5 says the
annual report must contain financial statements, but the 74-page PDF contains no Income
Statement/Statement of Comprehensive Income/Statement of Financial Position/Statement of Cash
Flows/B1-1 with printed subtotals; the official reporting page publishes a separate FY2024-25 Financial
reports PDF, and this annual-report-only item does not substitute that standalone report; no rows
ingested
```

## 5. Separate current-year FY2024-25 Financial reports (recorded, out of scope)

The same official page publishes a separate current-year document:

- PDF:
  <https://www.lismore.nsw.gov.au/files/assets/public/v/1/5.-council/7.-about-council/6.-corporate-information/annual_financial_statements-2025-signed-27-nov-25.pdf>
- bytes: **3,269,117**
- SHA-256: `e4816b7149d268099bbb931fcf0a3b34b03ab0e4b28663aba18039cdf0da9797`
- 104 pages; contains the audited GPFS (Income Statement p5, Statement of Comprehensive Income p6,
  Statement of Financial Position p7, Statement of Cash Flows p9, B1-1 functions p15, "End of the
  audited financial statements" p73), followed by special purpose statements and special schedules.

This is the correct source for a future standalone-FS cure, but this annual-report-only item did **not**
fetch it into the connector, parse it or ingest it, and did not substitute it. It is recorded so a cure
item can be scoped and reconciled without re-discovery.

## 6. Extracted entity rows (0, deferred)

No measure rows are emitted. The connector does not publish a partial or narrative slice and does not
invent a council total or any cross-council row. If a future annual report actually contains the
audited GPFS section, the connector's page predicate will detect it and still defer rather than
partially parse it; a new verified adapter (or a cure item using the separate FS) would be required.

## 7. No-total / no-cross-council rule

- Lismore City Council is one entity. No council total, no state/national total and no sum with another
  council, the `dubbo-council` budget/estimate rows, a government program, the PNFC benchmark or the OLG
  summary layer is created.
- The FY2024-25 annual report is the reporting boundary; no older standalone report and no newer
  FY2025-26 document is substituted.
- No rows are emitted at all.

## 8. How to verify

```bash
# Official page and exact FY2024-25 annual report (200 in this retrieval run).
curl -sL -o /dev/null -w '%{http_code}\n' \
  -A 'curl/8.5.0' \
  'https://www.lismore.nsw.gov.au/Council/Corporate-information/Annual-and-financial-reports'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  -A 'curl/8.5.0' \
  'https://www.lismore.nsw.gov.au/files/assets/public/v/1/5.-council/6.-corporate-information/lcc-annual-report-2024-25-a4.pdf'

# Focused connector tests.
TEST_MONGO_URL="mongodb://127.0.0.1:27118/ausspend_test_lismoregpfs" \
  npx vitest run --project server server/test/lismore-gpfs.test.ts
```

The focused suite covers annual-report discovery/latest selection (excluding the separate FS, the
signed attestation appendix, the State of our City report and the Long Term Financial Plan), the
recorded separate FY2024-25 Financial reports link, prior-year and future-year rejection, the
documented-pin fallback, the plain-UA header, the annual-report FS-section absence with the exact
page-level gap, natural-key stability, and additive-only 0-row ingestion that preserves existing rows
and marks the source `degraded`. A live connector run against the real PDF returned `LIVE_RECORDS 0`
with the exact gap above.
