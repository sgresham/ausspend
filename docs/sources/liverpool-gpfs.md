# Liverpool City Council — General Purpose Financial Statements

- id: `liverpool-gpfs`
- publisher: Liverpool City Council
- source: <https://www.liverpool.nsw.gov.au/council/corporate-information/finance-reports>
- jurisdiction: local
- status: active
- licence: © Liverpool City Council. Published council documents used here for public-interest research; not an open-data licence grant.

Twenty-ninth NSW council GPFS adapter: one council only (Liverpool City Council), audited FY2024-25 General Purpose Financial Statements published in the official audited financial statements PDF linked from the council's Finance Reports page. The site enforces a Cloudflare managed challenge, so the documented headless Chromium path clears it; the connector discovers the PDF from the cleared HTML (no hard-coded document URL), the exact bytes are SHA-256 archived outside the repo, and parsing happens only when the printed $'000 unit is explicit and the income statement, B1-1 Total functions and activities, Statement of Comprehensive Income and note B3-4 reconcile exactly. The auditor's Report on the Conduct of the Audit narrative is checked for printed differences; its internal label/percentage inconsistencies are retained and flagged for a human spot check, never silently reconciled. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested. Total expenses is the printed B1-1 total, equal to the printed expenses-excluding-depreciation plus printed depreciation/amortisation/impairment bridge.
