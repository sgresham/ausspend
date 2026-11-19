# Port Stephens Council — General Purpose Financial Statements

- id: `port-stephens-gpfs`
- publisher: Port Stephens Council
- source: <https://www.portstephens.nsw.gov.au/council/plans-and-reporting/annual-report>
- jurisdiction: local
- status: active
- licence: © Port Stephens Council. Published council documents used here for public-interest research; not an open-data licence grant.

NSW council GPFS adapter: one council only (Port Stephens Council), audited FY2024-25 General Purpose Financial Statements from the separately published Annual Report Volume 2 — Financial Statement PDF with the independent auditor's reports (Volume 1 is the narrative/statutory-information annual report and has no GPFS section; that rejection path is retained). The standalone FS is discovered from the official Annual Report page, with the Cloudflare-clearing headless Chromium browser path and a documented official fallback pin; the exact bytes are SHA-256 archived outside the repo, and parsed only when the printed $'000 unit is explicit and the Income Statement, B1-1 Total functions and activities, Statement of Comprehensive Income, Statement of Financial Position, Statement of Changes in Equity and Statement of Cash Flows reconcile exactly. Port Stephens' B1-1 income includes grants and contributions, so B1-1 income equals the face total income and B1-1 operating result equals the net result; B1-1 grants equal operating plus capital grants. Total expenses is the documented bridge of the printed expenses-excluding-depreciation line plus printed depreciation/amortisation/impairment, equal to the printed B1-1 expense total. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested.
