# Northern Beaches Council — General Purpose Financial Statements

- id: `northern-beaches-gpfs`
- publisher: Northern Beaches Council
- source: <https://www.northernbeaches.nsw.gov.au/council/publications/annual-report>
- jurisdiction: local
- status: active
- licence: © Northern Beaches Council. Published council documents used here for public-interest research; not an open-data licence grant.

Fifth NSW council GPFS adapter: one council only (Northern Beaches Council), audited FY2024-25 General Purpose Financial Statements. The PDF is discovered from the official annual-report page (no hard-coded document URL), SHA-256 archived outside the repo, and parsed only when the printed $'000 unit is explicit and the income statement, B1-1 Total functions and activities and Statement of Comprehensive Income reconcile exactly. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested. Total expenses is the documented bridge of the printed expenses-excluding-depreciation line plus the printed depreciation line, reconciled against the printed B1-1 total and the equal disposal gross-up.
