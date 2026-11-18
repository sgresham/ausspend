# City of Canada Bay Council — General Purpose Financial Statements

- id: `canada-bay-gpfs`
- publisher: City of Canada Bay Council
- source: <https://www.canadabay.nsw.gov.au/council/about-council/our-reporting>
- jurisdiction: local
- status: active
- licence: © City of Canada Bay Council. Published council documents used here for public-interest research; not an open-data licence grant.

Twenty-fifth NSW council GPFS adapter: one council only (City of Canada Bay Council), audited FY2024-25 General Purpose Financial Statements published inside the official 'Annual Report 2024-2025' PDF linked from the council's Our Reporting page. The PDF includes the signed statements and the independent auditor's reports on the financial statements. The PDF is discovered from that official page (no hard-coded document URL), the exact bytes are SHA-256 archived outside the repo, and parsed only when the printed $'000 unit is explicit and the income statement, B1-1 Total functions and activities, Statement of Comprehensive Income and note B3-4 reconcile exactly. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested. Total expenses is the printed B1-1 total, equal to printed expenses excluding depreciation plus printed depreciation/amortisation/impairment.
