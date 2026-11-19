# Hay Shire Council — General Purpose Financial Statements

- id: `hay-gpfs`
- publisher: Hay Shire Council
- source: <https://www.hay.nsw.gov.au/Inside-Hay-Shire-Council/Council-Meetings-and-Reports>
- jurisdiction: local
- status: active
- licence: © Hay Shire Council. Published council documents used here for public-interest research; not an open-data licence grant.

NSW council GPFS adapter: one council only (Hay Shire Council), FY2025-26 General Purpose Financial Statements (year ended 30 June 2026) from the official standalone Annual Financial Statements PDF found in the official Council Meetings and Reports feed. The FY2025-26 GPFS PDF carries placeholder pages for the section 417 independent auditor reports (the signed opinion is published separately and is not embedded); the prior FY2024-25 FS in the same feed embeds the signed Auditor-General opinion. The FY2025-26 PDF is discovered live with a documented official fallback pin; the exact bytes are SHA-256 archived outside the repo, and parsed only when the printed $'000 unit is explicit and the Income Statement, B1-1 Total functions and activities, Statement of Comprehensive Income, Statement of Financial Position, Statement of Changes in Equity and Statement of Cash Flows reconcile exactly. Hay prints the net loss from the disposal of assets as an expense component. Total expenses is the documented bridge of the printed expenses-excluding-depreciation line plus printed depreciation/amortisation/impairment, equal to the printed B1-1 expense total. B1-1 income includes grants and contributions, so B1-1 income equals the face total income, B1-1 operating result equals the net result, and B1-1 grants equal operating plus capital grants. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested.
