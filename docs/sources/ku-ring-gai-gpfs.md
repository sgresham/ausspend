# Ku-ring-gai Council — General Purpose Financial Statements

- id: `ku-ring-gai-gpfs`
- publisher: Ku-ring-gai Council
- source: <https://www.krg.nsw.gov.au/Council/Strategic-plans-finance-reports-and-publications/Finance>
- jurisdiction: local
- status: active
- licence: © Ku-ring-gai Council. Published council documents used here for public-interest research; not an open-data licence grant.

Thirtieth NSW council GPFS adapter: one council only (Ku-ring-gai Council), audited FY2024-25 General Purpose Financial Statements published in the official Annual Financial Statements PDF linked from the council Finance page. The site returns HTTP 403 to non-browser clients, so the documented headless Chromium path loads it; the connector discovers the PDF from the cleared HTML (no hard-coded document URL), the exact bytes are SHA-256 archived outside the repo, and parsing happens only when the printed $'000 unit is explicit and the income statement, B1-1 Total functions and activities, Statement of Comprehensive Income and note B3-4 reconcile exactly. The auditor's Report on the Conduct of the Audit narrative is checked for printed differences; the narrative's own table/text/graph 2025 operating-result discrepancy (21.9 vs 21.99 vs 21,997) is retained and flagged for a human spot check, never silently reconciled. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested. Total expenses is the printed B1-1 total, equal to the printed expenses-excluding-depreciation plus printed depreciation/amortisation/impairment bridge.
