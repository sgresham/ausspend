# Council of the City of Ryde — General Purpose Financial Statements

- id: `ryde-gpfs`
- publisher: Council of the City of Ryde
- source: <https://www.ryde.nsw.gov.au/Council/Strategies-Plans-and-Publications/Integrated-Planning-and-Reporting/Financial-Reports-and-Statements>
- jurisdiction: local
- status: active
- licence: © Council of the City of Ryde. Published council documents used here for public-interest research; not an open-data licence grant.

Twenty-third NSW council GPFS adapter: one council only (the Council of the City of Ryde), audited FY2024-25 General Purpose Financial Statements published as the standalone 'Financial Statements (General and Special Purpose)' PDF for the year ended 30 June 2025 on the official Financial Reports and Statements page. The PDF includes the independent auditor's reports on the financial statements. The PDF is discovered from that official page (no hard-coded document URL); ryde.nsw.gov.au serves plain HTTP to Node's fetch in this pass, so no browser fallback is needed; the exact bytes are SHA-256 archived outside the repo, and parsed only when the printed $'000 unit is explicit and the income statement, B1-1 Total functions and activities and Statement of Comprehensive Income reconcile as printed. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested. Total expenses is the printed face-statement bridge (printed expenses excluding depreciation plus printed depreciation/impairment); the printed B1-1 expense total is $15 thousand lower and is recorded as reconciliation evidence only.
