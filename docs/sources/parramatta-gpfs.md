# City of Parramatta — General Purpose Financial Statements

- id: `parramatta-gpfs`
- publisher: City of Parramatta
- source: <https://www.cityofparramatta.nsw.gov.au/council/performance-and-reporting/financial-statements>
- jurisdiction: local
- status: active
- licence: © City of Parramatta. Published council documents used here for public-interest research; not an open-data licence grant.

Fourth NSW council GPFS adapter: one council only (City of Parramatta), audited FY2024-25 General Purpose Financial Statements. The PDF is discovered from the official financial-statements page's dedicated FY2024-25 page (no hard-coded document URL), SHA-256 archived outside the repo, and parsed only when the printed $'000 unit is explicit and the income statement, B1-1 Total functions and activities and Statement of Comprehensive Income reconcile exactly. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested. Total expenses is the printed B1-1 total, never a component sum.
