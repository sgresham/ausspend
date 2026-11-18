# Camden Council — General Purpose Financial Statements

- id: `camden-gpfs`
- publisher: Camden Council
- source: <https://www.camden.nsw.gov.au/council/integrated-planning/annual-report-and-financial-statement>
- jurisdiction: local
- status: active
- licence: © Camden Council. Published council documents used here for public-interest research; not an open-data licence grant.

NSW council GPFS adapter: one council only (Camden Council), audited FY2024-25 General Purpose Financial Statements published as the official 'Annual Financial Statements 2024-2025' PDF linked from the Annual Report and Financial Statement page. The connector discovers the PDF from the page's own link (no hard-coded document URL), the exact bytes are SHA-256 archived outside the repo, and parsing happens only when the printed $'000 unit is explicit and the income statement, B1-1 Total functions and activities, Statement of Comprehensive Income and note B3-4 reconcile exactly. The income statement has no discontinued operation: total revenue $342,825k, total expenses $199,379k (printed B1-1 total = expenses excluding depreciation $158,004k + depreciation/amortisation/impairment $41,375k) and net result $143,446k. The printed B1-1 function expense split is emitted as a separate service cut of the same total, never added to the nature-of-expense cut. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested.
