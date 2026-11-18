# Cumberland City Council — General Purpose Financial Statements

- id: `cumberland-gpfs`
- publisher: Cumberland City Council
- source: <https://www.cumberland.nsw.gov.au/key-council-reports>
- jurisdiction: local
- status: active
- licence: © Cumberland City Council. Published council documents used here for public-interest research; not an open-data licence grant.

Twenty-sixth NSW council GPFS adapter: one council only (Cumberland City Council), audited FY2024-25 General Purpose Financial Statements published in the official 'Annual Financial Statements 2024-2025' PDF linked from the council's Key council reports page. The PDF includes the signed statements and the independent auditor's reports on the financial statements. The PDF is discovered from that official page (no hard-coded document URL), the exact bytes are SHA-256 archived outside the repo, and parsed only when the printed $'000 unit is explicit and the income statement, B1-1 Total functions and activities, Statement of Comprehensive Income and note B3-3 reconcile within the published $1k rounding. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested. Total expenses is the printed face-statement expenses-excluding-depreciation plus printed depreciation/amortisation/impairment bridge.
