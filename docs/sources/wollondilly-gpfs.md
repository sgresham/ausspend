# Wollondilly Shire Council — General Purpose Financial Statements

- id: `wollondilly-gpfs`
- publisher: Wollondilly Shire Council
- source: <https://www.wollondilly.nsw.gov.au/council/corporate-planning-and-reporting/councils-financial-statements>
- jurisdiction: local
- status: active
- licence: © Wollondilly Shire Council. Published council documents used here for public-interest research; not an open-data licence grant.

Thirty-seventh NSW council GPFS adapter: one council only (Wollondilly Shire Council), audited FY2024-25 General Purpose Financial Statements published as the official standalone audited Financial Statements PDF linked from the council Financial Statements page. The connector discovers the PDF from the page's own links (no hard-coded document URL), the exact bytes are SHA-256 archived outside the repo, and parsing happens only when the printed $'000 unit is explicit and the income statement, B1-1 Total functions and activities, Statement of Comprehensive Income and note B3-4 reconcile exactly. FY2024-25 has no discontinued operation: the printed continuing operating result equals the statutory net result. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested. Total expenses is the printed B1-1 total, equal to the printed expenses-excluding-depreciation plus printed depreciation/amortisation/impairment bridge.
