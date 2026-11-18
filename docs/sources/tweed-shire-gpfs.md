# Tweed Shire Council — General Purpose Financial Statements

- id: `tweed-shire-gpfs`
- publisher: Tweed Shire Council
- source: <https://www.tweed.nsw.gov.au/council/policies-plans-reports/annual-financial-reports>
- jurisdiction: local
- status: active
- licence: © Tweed Shire Council. Published council documents used here for public-interest research; not an open-data licence grant.

Fifteenth NSW council GPFS adapter: one council only (Tweed Shire Council), audited FY2024-25 General Purpose Financial Statements. The PDF is discovered from the official 'Annual and financial reports' page (no hard-coded document URL); the exact bytes are SHA-256 archived outside the repo, and parsed only when the printed $'000 unit is explicit and the income statement, B1-1 Total functions and activities and Statement of Comprehensive Income reconcile exactly. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested. Total expenses is the printed B1-1 total, equal to the printed expenses-excluding-depreciation line plus the printed depreciation/impairment line.
