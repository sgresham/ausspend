# Albury City Council — Annual Report Financial Statements (FY2024-25)

Source id `albury-gpfs` (NSW local government). One council only; entity-level rows, no council
total and no cross-council or state/federal addition.

**Status: registered but deferred with 0 rows.** The official FY2024-25 annual report is
annual-report-only for this item: it contains a narrative Financial Snapshot summary and states that
the full audited financial statements can be viewed on the council website, but it does **not**
contain the audited GPFS Income Statement, Statement of Comprehensive Income or B1-1 section. No
standalone report was substituted.

## 0. Stale-year check

The work-item title said FY2024-25. The official **Annual Reports** page was checked on 2026-11-19
and lists **Annual Report - 2024-2025** as the newest annual report. No FY2025-26 annual report was
published yet. The FY2024-25 annual report therefore remains the latest official annual-report
source; no later document was substituted. A 404/JS-only later-year link would be recorded as a gap,
not a reason to fabricate.

## 1. Source and year

- Publisher: **Albury City Council**.
- Document: **Annual Report - 2024-2025** for the year ended 30 June 2025 — FY2024-25. The
  132-page PDF (18,452,240 bytes) contains the annual report and a Regulatory Report.
- Official page:
  <https://www.alburycity.nsw.gov.au/council/publications-and-updates/reports/annual-reports>.
- Current exact document:
  <https://eservice.alburycity.nsw.gov.au/ACCPublicDocs/RecordURI?URI=5168648>.
  The server returns `application/octet-stream`, but the bytes are a real PDF (`PDF document,
  version 1.6`). The same URL is the documented official fallback pin.

## 2. Access, discovery and fetch

The inventory listed the annual report as annual-report-only and not yet confirmed ingest-ready. In
this retrieval run (2026-11-19) **both the Annual Reports page and the document returned `200`** to
`curl/8.5.0` (the document as `application/octet-stream`, 18,452,240 bytes, and `file` identifies a
real PDF). The brief left the existing fetch path in place (no `scripts/*-gpfs-browser.ts` area), so
the connector uses that plain fetch/archive path and a documented official pin fallback. No browser
path or mirror was introduced.

The annual report is a 132-page PDF. Its table of contents lists "Audited Financial Statements 94",
but page 94 is the "Our Accountability" page. It states:

> "Audited Financial Statements for the Year Ended 30 June 2025 — AlburyCity's audited financial
> statements and the auditor's report for the year to 30 June 2025 can be viewed on our website."

Page 32 contains only a narrative **Financial Snapshot 2024-2025** with summary totals and component
amounts (Operating Income 197,575; Operating Expenditure 179,413; rates, user charges, grants,
employee, materials, depreciation, etc.). It is not an audited GPFS primary statement: there is no
Income Statement, Statement of Comprehensive Income, or B1-1 "Functions or activities" page with
printed subtotals and comparatives.

## 3. Archive (outside the repo)

The exact downloaded bytes are archived outside the repository under the configured source-archive
root, with the relative archive path `albury-gpfs/albury-annual-report-2024-25.pdf`:

- URL: `https://eservice.alburycity.nsw.gov.au/ACCPublicDocs/RecordURI?URI=5168648`
- retrieval date: 2026-11-19
- bytes: **18,452,240**
- SHA-256: `40bd0a9efb04e6f78ae1e288140d282ef8fb918ffd6beb22ce603e04f5c7156f`
- content type: `application/octet-stream` (real PDF bytes)

No PDF is committed. The fixture and this note contain only the relative archive path.

## 4. Exact gap and deferral

The parser searched the annual report for the audited GPFS statement pages and found none. The exact
rejection is:

```
audited GPFS section not found in the FY2024-25 annual report; page 32 contains only the narrative
Financial Snapshot summary; page 94 says the full audited financial statements can be viewed on the
website; no Income Statement/Statement of Comprehensive Income/B1-1 with printed subtotals was found;
no standalone GPFS was substituted; no rows ingested
```

The annual report is not scanned; its narrative and snapshot pages are text-native. Even if the
Financial Snapshot totals were treated as a "council total", the brief forbids ingesting a council
total or narrative-only rows, and the snapshot does not include the printed statement-line slice or
the reconciling subtotals required at zero tolerance.

## 5. Extracted entity rows (0, deferred)

No measure rows are emitted. The connector does not publish a partial snapshot/face slice and does
not invent a council total or any cross-council row. If a future annual report actually contains the
audited GPFS section, the connector's page predicate will detect it and still defer rather than
partially parse it; a new verified adapter would be required.

## 6. No-total / no-cross-council rule

- Albury City Council is one entity. No council total, no state/national total and no sum with
  another council, the `dubbo-council` budget/estimate rows, a government program, the PNFC
  benchmark or the OLG summary layer is created.
- The FY2024-25 annual report is the reporting boundary; no older standalone report is substituted.
- No rows are emitted at all.

## 7. Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`)

Targeted ingest of **only `albury-gpfs`** against the shared dev DB `ausspend_dev`:

- total GPFS `data_sources` **106 → 107**; the new Albury source is `degraded`;
- active GPFS `data_sources` stayed at **105** (Albury is degraded, not active);
- GPFS measures stayed at **1953**; total measures stayed at **999,471**; Albury rows **0**;
- SOC rows (`jurisdiction_level: "soc"`) stayed at **205**; every other per-source count unchanged;
- **0** Albury rows, so there is no council-total/aggregate row and no region/LGA allocation;
- `data_sources` records `status: "degraded"`, `records_ingested: 0` for `albury-gpfs`;
- the latest `ingestion_logs` entry is `status: "partial"`, `records_fetched: 0`,
  `records_upserted: 0`, with the exact annual-report gap in `errors`.

The exact annual report is archived outside the repo at the relative path
`albury-gpfs/albury-annual-report-2024-25.pdf` with the SHA-256 above; no PDF is committed.

## 8. How to verify

```bash
# Official page and exact FY2024-25 annual report (200 in this retrieval run).
curl -sL -o /dev/null -w '%{http_code}\n' \
  -A 'curl/8.5.0' \
  'https://www.alburycity.nsw.gov.au/council/publications-and-updates/reports/annual-reports'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  -A 'curl/8.5.0' \
  'https://eservice.alburycity.nsw.gov.au/ACCPublicDocs/RecordURI?URI=5168648'

# Focused connector tests (11).
TEST_MONGO_URL="mongodb://localhost:27017/ausspend_test_alburygpfs" \
  npx vitest run --project server server/test/albury-gpfs.test.ts
```

The focused suite covers annual-report discovery/latest selection (prior-year and future-year
rejection), the documented-pin WAF fallback, the plain-UA header, the annual-report FS-section
absence with the exact page-level gap, natural-key stability, and additive-only 0-row ingestion that
preserves existing rows and marks the source degraded.
