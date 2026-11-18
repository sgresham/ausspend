# Waverley Council — General Purpose Financial Statements

- id: `waverley-gpfs`
- publisher: Waverley Council
- source: <https://www.waverley.nsw.gov.au/council/policies_plans_strategies_and_reports/annual_statement_of_accounts>
- jurisdiction: local
- status: active
- licence: © Waverley Council. Published council documents used here for public-interest research; not an open-data licence grant.

Eighteenth NSW council GPFS adapter: one council only (Waverley Council), audited FY2024-25 General Purpose Financial Statements published as the official 'Annual Statement of Accounts 2024-2025'. Plain HTTP is rejected with a Cloudflare challenge, so the PDF is discovered from the official 'Annual Statement of Accounts' page via the documented headless Chromium path (no hard-coded document URL); the exact bytes are SHA-256 archived outside the repo, and parsed only when the printed $'000 unit is explicit and the income statement, B1-1 Total functions and activities and Statement of Comprehensive Income reconcile exactly. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested. Total expenses is the printed B1-1 total, equal to the printed expenses-excluding-depreciation line plus the printed depreciation/impairment line.
