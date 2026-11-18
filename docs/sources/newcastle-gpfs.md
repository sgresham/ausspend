# Newcastle City Council — General Purpose Financial Statements

- id: `newcastle-gpfs`
- publisher: Newcastle City Council
- source: <https://newcastle.nsw.gov.au/your-council/governance-and-transparency/planning-service-delivery-and-reporting>
- jurisdiction: local
- status: active
- licence: © Newcastle City Council. Published council documents used here for public-interest research; not an open-data licence grant.

Ninth NSW council GPFS adapter: one council only (Newcastle City Council), audited FY2024-25 General Purpose Financial Statements. The PDF is discovered from the official General Purpose Financial Statements page (no hard-coded document URL) over plain HTTP (which succeeds, HTTP 200); the exact bytes are SHA-256 archived outside the repo, and parsed only when the printed $'000 unit is explicit and the income statement, B1-1 Total functions and activities and Statement of Comprehensive Income reconcile exactly. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested. Total expenses is the documented bridge of the printed expenses-excluding-depreciation line plus the printed depreciation line, reconciled against the printed B1-1 totals.
