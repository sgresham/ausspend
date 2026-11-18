# Coffs Harbour City Council — General Purpose Financial Statements

- id: `coffs-harbour-gpfs`
- publisher: Coffs Harbour City Council
- source: <https://www.coffsharbour.nsw.gov.au/Your-Council/Our-responsibilities/Corporate-planning-and-reporting/Annual-Report>
- jurisdiction: local
- status: active
- licence: © Coffs Harbour City Council. Published council documents used here for public-interest research; not an open-data licence grant.

Twelfth NSW council GPFS adapter: one council only (Coffs Harbour City Council), audited FY2024-25 General Purpose Financial Statements. The PDF is discovered from the official Annual Report page (no hard-coded document URL) through the documented headless Chromium/Playwright path because Akamai returns HTTP 403 to direct HTTP; the exact bytes are SHA-256 archived outside the repo, and parsed only when the printed $'000 unit is explicit and the income statement, B1-1 Total functions and activities and Statement of Comprehensive Income reconcile exactly. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested. Total expenses is the printed B1-1 total, equal to the printed expenses-excluding-depreciation line plus the printed depreciation line.
