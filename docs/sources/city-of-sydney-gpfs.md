# City of Sydney — General Purpose Financial Statements

- id: `city-of-sydney-gpfs`
- publisher: City of Sydney
- source: <https://www.cityofsydney.nsw.gov.au/research-reports/annual-report>
- jurisdiction: local
- status: active
- licence: © City of Sydney. Published council documents used here for public-interest research; not an open-data licence grant.

Second NSW council GPFS adapter: one council only (City of Sydney), audited FY2024-25 General Purpose Financial Statements. The PDF is discovered from the official annual-report page (no hard-coded document URL), SHA-256 archived outside the repo, and parsed only when the printed $'000 unit is explicit and the income statement, B1-1 Total functions and activities and Statement of Comprehensive Income reconcile exactly. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested. Total expenses is the printed B1-1 total, never a component sum.
