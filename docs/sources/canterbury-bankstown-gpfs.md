# Canterbury-Bankstown Council — General Purpose Financial Statements

- id: `canterbury-bankstown-gpfs`
- publisher: Canterbury-Bankstown Council
- source: <https://haveyoursay.cbcity.nsw.gov.au/annual-financial-statements-2024-25>
- jurisdiction: local
- status: active
- licence: © Canterbury-Bankstown Council. Published council documents used here for public-interest research; not an open-data licence grant.

Sixth NSW council GPFS adapter: one council only (Canterbury-Bankstown Council), audited FY2024-25 General Purpose Financial Statements. The PDF is discovered from the official annual financial statements page (no hard-coded document URL), SHA-256 archived outside the repo, and parsed only when the printed $'000 unit is explicit and the income statement, B1-1 Total functions and activities and Statement of Comprehensive Income reconcile exactly. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested. Total expenses is the documented bridge of the printed expenses-excluding-depreciation line plus the printed depreciation line, reconciled against the printed B1-1 totals.
