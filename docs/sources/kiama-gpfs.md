# Kiama Municipal Council — General Purpose Financial Statements

- id: `kiama-gpfs`
- publisher: Kiama Municipal Council
- source: <https://www.kiama.nsw.gov.au/Council/Community-Reports/Annual-Reports-and-Financial-Statements>
- jurisdiction: local
- status: active
- licence: © Kiama Municipal Council. Published council documents used here for public-interest research; not an open-data licence grant.

NSW council GPFS adapter: one council only (Kiama Municipal Council), audited FY2024-25 General Purpose Financial Statements from the standalone Financial Statements 2024-25 PDF with the audit opinion (the FY2024-25 annual report itself is narrative-only and has no GPFS section; that rejection path is retained). The standalone FS is discovered from the official Annual Reports and Financial Statements page, with the WAF-aware browser path and a documented official fallback pin; the exact bytes are SHA-256 archived outside the repo, and parsed only when the printed $'000 unit is explicit and the Income Statement, B1-1 Total functions and activities, Statement of Comprehensive Income, Statement of Financial Position, Statement of Changes in Equity and Statement of Cash Flows reconcile exactly. FY2024-25 has a material discontinued operation: the printed continuing and discontinued result lines are both emitted so the statutory net result bridges explicitly. Total expenses is the printed B1-1 total, equal to the printed expenses-excluding-depreciation plus printed depreciation/amortisation/impairment bridge. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested.
