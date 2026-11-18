# Bayside Council — General Purpose Financial Statements

- id: `bayside-gpfs`
- publisher: Bayside Council
- source: <https://www.bayside.nsw.gov.au/your-council/corporate-planning-and-reporting>
- jurisdiction: local
- status: active
- licence: © Bayside Council. Published council documents used here for public-interest research; not an open-data licence grant.

Twenty-first NSW council GPFS adapter: one council only (Bayside Council), audited FY2024-25 General Purpose Financial Statements published as the standalone 'General Purpose Financial Statements & Special Schedules for the year ended 30 June 2025' PDF on the official Corporate planning and reporting page. The PDF includes the independent auditor's reports on the financial statements. The PDF is discovered from that official page (no hard-coded document URL); the exact bytes are SHA-256 archived outside the repo, and parsed only when the printed $'000 unit is explicit and the income statement, B1-1 Total functions and activities and Statement of Comprehensive Income reconcile exactly. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested. Total expenses is the printed B1-1 total, equal to the printed expenses-excluding-depreciation line plus the printed depreciation/impairment line.
