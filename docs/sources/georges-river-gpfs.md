# Georges River Council — General Purpose Financial Statements

- id: `georges-river-gpfs`
- publisher: Georges River Council
- source: <https://www.georgesriver.nsw.gov.au/Council/Publications/Other-Corporate-Documents>
- jurisdiction: local
- status: active
- licence: © Georges River Council. Published council documents used here for public-interest research; not an open-data licence grant.

Twenty-seventh NSW council GPFS adapter: one council only (Georges River Council), audited FY2024-25 General Purpose Financial Statements published in the official 'Audited Financial Statement and Auditors Report for 1 July 2024 - 30 June 2025' PDF linked from the council's Other Corporate Documents page. The PDF includes the signed statements and the independent auditor's reports on the financial statements. The PDF is discovered from that official page (no hard-coded document URL), the exact bytes are SHA-256 archived outside the repo, and parsed only when the printed $'000 unit is explicit and the income statement, B1-1 Total functions and activities, Statement of Comprehensive Income and note B3-3 reconcile exactly. The auditor's Report on the Conduct of the Audit narrative prints a different rounded total-expenses figure; that internal printed difference is retained and flagged for a human spot check, never silently reconciled. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested. Total expenses is the printed B1-1 total, equal to the printed expenses-excluding-depreciation plus printed depreciation/amortisation/impairment bridge.
