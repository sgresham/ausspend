# Wagga Wagga City Council — General Purpose Financial Statements

- id: `wagga-wagga-gpfs`
- publisher: Wagga Wagga City Council
- source: <https://wagga.nsw.gov.au/the-council/planning-and-reporting/community-reporting/financial-statements>
- jurisdiction: local
- status: active
- licence: © Wagga Wagga City Council. Published council documents used here for public-interest research; not an open-data licence grant.

NSW council GPFS adapter: one council only (Wagga Wagga City Council), audited FY2025-26 General Purpose Financial Statements from the official standalone Annual Financial Statements PDF with the independent auditor's reports. The standalone audited FS is discovered from the official Financial Statements page, with the Cloudflare-clearing headless Chromium browser path and a documented official fallback pin; the exact bytes are SHA-256 archived outside the repo, and parsed only when the printed $'000 unit is explicit and the Income Statement, B1-1 Total functions and activities, Statement of Comprehensive Income, Statement of Financial Position, Statement of Changes in Equity and Statement of Cash Flows reconcile exactly. Wagga Wagga prints net loss from the disposal of assets as an expense component of the expenses-excluding-depreciation subtotal, so it is emitted as an expense line. Total expenses is the documented bridge of the printed expenses-excluding-depreciation line plus printed depreciation/amortisation/impairment, equal to the printed B1-1 expense total. B1-1 income includes grants and contributions, so B1-1 income equals the face total income, B1-1 operating result equals the net result, and B1-1 grants equal operating plus capital grants. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested.
