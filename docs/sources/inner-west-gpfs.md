# Inner West Council — General Purpose Financial Statements

- id: `inner-west-gpfs`
- publisher: Inner West Council
- source: <https://www.innerwest.nsw.gov.au/annual-report>
- jurisdiction: local
- status: active
- licence: © Inner West Council. Published council documents used here for public-interest research; not an open-data licence grant.

Twentieth NSW council GPFS adapter: one council only (Inner West Council), audited FY2024-25 General Purpose Financial Statements published inside the official 'Annual Report 2024-25'. The council's Annual Report page states the report includes Council's financial report audited by the NSW Audit Office, and the PDF includes the independent auditor's report on the general purpose financial statements. The PDF is discovered from that official page (no hard-coded document URL); the exact bytes are SHA-256 archived outside the repo, and parsed only when the printed $'000 unit is explicit and the income statement, B1-1 Total functions and activities and Statement of Comprehensive Income reconcile exactly. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested. Total expenses is the printed B1-1 total, equal to the printed expenses-excluding-depreciation line plus the printed depreciation/impairment line.
