# Lane Cove Council — General Purpose Financial Statements

- id: `lane-cove-gpfs`
- publisher: Lane Cove Council
- source: <https://www.lanecove.nsw.gov.au/Council/Plans-and-Publications/Community-Strategic-Plan>
- jurisdiction: local
- status: active
- licence: © Lane Cove Council. Published council documents used here for public-interest research; not an open-data licence grant.

Thirty-first NSW council GPFS adapter: one council only (Lane Cove Council), audited FY2024-25 General Purpose Financial Statements published as Section 3 of the official Annual Report 2024-25 PDF linked from the council Community Strategic Plan page. The council's TRIM document link resolves through a JavaScript redirect; the connector discovers the document link from the page HTML (no hard-coded document URL), resolves the exact PDF URL, SHA-256 archives the exact bytes outside the repo, and parses only when the printed $'000 unit is explicit and the income statement, B1-1 Total functions and activities column, Statement of Comprehensive Income and note B3-3 reconcile exactly. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested. Total expenses is the printed B1-1 total, equal to the printed expenses-excluding-depreciation plus printed depreciation/amortisation/impairment bridge.
