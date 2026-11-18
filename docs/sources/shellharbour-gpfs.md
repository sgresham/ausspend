# Shellharbour City Council — General Purpose Financial Statements

- id: `shellharbour-gpfs`
- publisher: Shellharbour City Council
- source: <https://www.shellharbour.nsw.gov.au/council/news-and-publications/annual-reports>
- jurisdiction: local
- status: active
- licence: © Shellharbour City Council. Published council documents used here for public-interest research; not an open-data licence grant.

Seventeenth NSW council GPFS adapter: one council only (Shellharbour City Council), audited FY2024-25 General Purpose Financial Statements published inside the official Annual Report 2024 - 2025. The PDF is discovered from the official 'Annual reports' page via the FY2024-25 annual-report page (no hard-coded document URL); the exact bytes are SHA-256 archived outside the repo, and parsed only when the printed $'000 unit is explicit and the income statement, B1-1 Total functions and activities and Statement of Comprehensive Income reconcile exactly. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested. Total expenses is the printed B1-1 total, equal to the printed expenses-excluding-depreciation line plus the printed depreciation/impairment line.
