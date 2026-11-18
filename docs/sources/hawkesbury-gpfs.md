# Hawkesbury City Council — General Purpose Financial Statements

- id: `hawkesbury-gpfs`
- publisher: Hawkesbury City Council
- source: <https://www.hawkesbury.nsw.gov.au/your-council/corporate-publications/financial-statement>
- jurisdiction: local
- status: active
- licence: © Hawkesbury City Council. Published council documents used here for public-interest research; not an open-data licence grant.

Thirty-second NSW council GPFS adapter: one council only (Hawkesbury City Council), audited FY2024-25 General Purpose Financial Statements published as the official standalone Financial Statements PDF linked from the council Financial Statement page. The site returns HTTP 403 to non-browser clients, so the documented headless Chromium path loads it; the connector discovers the PDF from the page's own self.location redirect (no hard-coded document URL), the exact bytes are SHA-256 archived outside the repo, and parsing happens only when the printed $'000 unit is explicit and the income statement, B1-1 Total functions and activities, Statement of Comprehensive Income and note B3-4 reconcile exactly. FY2024-25 has a material discontinued operation (sewer business): total revenue and total expenses are the printed continuing-operations totals, and the printed continuing and discontinued result lines are both emitted so the statutory net result bridges explicitly. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested. Total expenses is the printed B1-1 total, equal to the printed expenses-excluding-depreciation plus printed depreciation/amortisation/impairment bridge.
