# Strathfield Council — General Purpose Financial Statements

- id: `strathfield-gpfs`
- publisher: Strathfield Council
- source: <https://www.strathfield.nsw.gov.au/Council/Reports-and-Registers>
- jurisdiction: local
- status: active
- licence: © Strathfield Council. Published council documents used here for public-interest research; not an open-data licence grant.

Thirty-second NSW council GPFS adapter: one council only (Strathfield Council), audited FY2024-25 General Purpose Financial Statements published as the standalone 'Financial Statements for the Year Ended 30 June 2025' PDF on the official Financial Reports page. The PDF includes the independent auditor's reports on the financial statements. The PDF is discovered from that official page (no hard-coded document URL), and the exact bytes are SHA-256 archived outside the repo and parsed only when the printed $'000 unit is explicit and the income statement, B1-1 Total functions and activities, Statement of Comprehensive Income and notes B2/B3 reconcile to their printed totals. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested. The printed $1 thousand B1-1/face rounding differences are recorded with human_spot_check: required; total expenses is the printed B1-1 total, never a component sum.
