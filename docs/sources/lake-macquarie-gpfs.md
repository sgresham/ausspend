# Lake Macquarie City Council — General Purpose Financial Statements

- id: `lake-macquarie-gpfs`
- publisher: Lake Macquarie City Council
- source: <https://www.lakemac.com.au/Our-Council/City-strategies-plans-and-reporting/Annual-Report>
- jurisdiction: local
- status: active
- licence: © Lake Macquarie City Council. Published council documents used here for public-interest research; not an open-data licence grant.

Tenth NSW council GPFS adapter: one council only (Lake Macquarie City Council), audited FY2024-25 General Purpose Financial Statements. The PDF is discovered from the official Annual Report page (no hard-coded document URL) through the documented headless Chromium/Playwright path because Akamai returns HTTP 403 to direct HTTP; the exact bytes are SHA-256 archived outside the repo, and parsed only when the printed $'000 unit is explicit and the income statement, B1-1 Total functions and activities and Statement of Comprehensive Income reconcile exactly. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested. Total expenses is the documented bridge of the printed expenses-excluding-depreciation line plus the printed depreciation line, reconciled against the printed B1-1 totals.
