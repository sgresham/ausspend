# Shoalhaven City Council — General Purpose Financial Statements

- id: `shoalhaven-gpfs`
- publisher: Shoalhaven City Council
- source: <https://www.shoalhaven.nsw.gov.au/Council/Reports/Financial-statements>
- jurisdiction: local
- status: active
- licence: © Shoalhaven City Council. Published council documents used here for public-interest research; not an open-data licence grant.

Sixteenth NSW council GPFS adapter: one council only (Shoalhaven City Council), audited FY2024-25 General Purpose Financial Statements. The PDF is discovered from the official 'Financial statements' page via its 'Financial Statements - Previous Years' CMS grid (no hard-coded document URL); the exact bytes are SHA-256 archived outside the repo, and parsed only when the printed $'000 unit is explicit and the income statement, B1-1 Total functions and activities and Statement of Comprehensive Income reconcile exactly. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested. Total expenses is the printed B1-1 total, equal to the printed expenses-excluding-depreciation line plus the printed depreciation/impairment line.
