# Burwood Council — General Purpose Financial Statements

- id: `burwood-gpfs`
- publisher: Burwood Council
- source: <https://participate.burwood.nsw.gov.au/annual-financial-statement-year-ended-30-june-2026>
- jurisdiction: local
- status: active
- licence: © Burwood Council. Published council documents used here for public-interest research; not an open-data licence grant.

NSW council GPFS adapter: one council only (Burwood Council), FY2025-26 General Purpose Financial Statements (year ended 30 June 2026) from the official audited Annual Financial Statements PDF published on the council's official consultation/exhibition host. The council's main site is Akamai/WAF-blocked to plain clients, so the exact official upload is fetched through headless Chromium and the connector archives and SHA-256 verifies those bytes. The PDF embeds the independent Auditor-General report (PDF page 68) with an unmodified opinion and was presented to the 27 October 2026 Council meeting. The newest combined annual report on the council site is still FY2024-25 and is summary-only, so no narrative annual report is substituted. Parsed only when the printed $'000 unit is explicit and the Income Statement, B1-1 Total functions and activities, Statement of Comprehensive Income, Statement of Financial Position, Statement of Changes in Equity and Statement of Cash Flows reconcile exactly. Burwood prints a nil net gain from the disposal of assets as a revenue component and a net loss from the disposal of assets as an expense component; total expenses is the documented bridge of the printed expenses-excluding-depreciation line plus printed depreciation/amortisation/impairment, equal to the printed B1-1 expense total; other comprehensive income is the single IPPE revaluation gain. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested.
