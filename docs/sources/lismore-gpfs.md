# Lismore City Council — General Purpose Financial Statements

- id: `lismore-gpfs`
- publisher: Lismore City Council
- source: <https://www.lismore.nsw.gov.au/Council/Corporate-information/Annual-and-financial-reports>
- jurisdiction: local
- status: active
- licence: © Lismore City Council. Published council documents used here for public-interest research; not an open-data licence grant.

NSW council GPFS adapter: one council only (Lismore City Council), audited FY2024-25 General Purpose Financial Statements from the signed standalone Financial reports 2024/25 PDF with the audit opinion (the FY2024-25 annual report itself is narrative/statutory-information only and has no GPFS section; that rejection path is retained). The FS is discovered from the official Annual and Financial Reports page, with the WAF-aware browser path and a documented official fallback pin; the exact bytes are SHA-256 archived outside the repo, and parsed only when the printed $'000 unit is explicit and the Income Statement, B1-1 Total functions and activities, Statement of Comprehensive Income, Statement of Financial Position, Statement of Changes in Equity and Statement of Cash Flows reconcile exactly. Lismore's B1-1 prints own-source income separately from grants and contributions; the connector reconciles B1-1 income + grants to the face total income and B1-1 operating result + grants to the net result. Total expenses is the documented bridge of the printed expenses-excluding-depreciation line plus printed depreciation, equal to the printed B1-1 expense total. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested.
