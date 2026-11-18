# Fairfield City Council — General Purpose Financial Statements

- id: `fairfield-gpfs`
- publisher: Fairfield City Council
- source: <https://www.fairfieldcity.nsw.gov.au/Your-Council/Integrated-Planning-and-Reporting/Corporate-Reports>
- jurisdiction: local
- status: active
- licence: © Fairfield City Council. Published council documents used here for public-interest research; not an open-data licence grant.

Twenty-eighth NSW council GPFS adapter: one council only (Fairfield City Council), audited FY2024-25 General Purpose Financial Statements published in the official '2024-2025 Financial Statements' PDF linked from the council's Corporate Reports page. The PDF includes the signed statements and the independent auditor's reports. The PDF is discovered from that official page (no hard-coded document URL), the exact bytes are SHA-256 archived outside the repo, and parsed only when the printed $'000 unit is explicit and the income statement, B1-1 Total functions and activities, Statement of Comprehensive Income and note B3-3 reconcile exactly. The auditor's Report on the Conduct of the Audit narrative is checked for a printed difference beyond the one-decimal-million rounding tolerance; any such difference is retained and flagged for a human spot check, never silently reconciled. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested. Total expenses is the printed B1-1 total, equal to the printed expenses-excluding-depreciation plus printed depreciation/amortisation/impairment bridge.
