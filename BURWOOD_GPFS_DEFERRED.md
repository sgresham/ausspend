# Burwood Council GPFS — DEFERRED

Item: `w-mwleet0n-czhk`. Decision: **defer, do not ingest or invent rows**,
per the brief's premise falsifier.

## What was checked (2026-11-18)

- Official site: <https://www.burwood.nsw.gov.au/> and the Reports page
  <https://www.burwood.nsw.gov.au/Our-Council/Policies-Plans-and-Reports/Reports>.
- The site sitemap and Reports page expose only:
  - Annual Report 2023-2024
  - Annual Report 2024-2025
  - State of Our City 2021-2024
- No separate **General Purpose Financial Statements** or audited financial
  statements PDF/page was found. Candidate
  `/files/assets/public/v/1/*financial-statements*.pdf` URLs return 404.
- The 2024-25 Annual Report PDF (38 pages) is at
  <https://www.burwood.nsw.gov.au/files/assets/public/v/1/burwood-council-annual-report-2025.pdf>,
  SHA-256 `66a268845ccf33cea9567c878ce3aa65f69aead32970a7ff122fb55d6bec176b`,
  5,879,866 bytes. It contains a “Financial performance” summary, not audited
  GPFS: no independent auditor’s report, Statement of Comprehensive Income,
  income statement, balance sheet or cash-flow statements.

## Why defer rather than ingest the summary

The summary prints `$‘000s` totals (total operating revenue 78,885; total
operating expenses 65,236; operating result 13,619), but it is not audited GPFS
and does not reconcile internally:

- revenue components sum to 78,855, which is 30 short of the printed 78,885;
- 78,885 − 65,236 = 13,649, not the printed operating result 13,619;
- the expense components do sum to 65,236.

Deriving or adjusting a total to force reconciliation would invent data. The
brief requires an audited GPFS PDF with explicit unit and printed total revenue
and total expenses; none is published. The brief therefore directs documenting
and deferring rather than inventing or deriving totals.

## What was not changed

- No `burwood-gpfs` connector or rows were added.
- No existing source, measure or data-source record was modified or deleted.
- The live DB was not touched; it remains at **693,075** rows.

## If this is revisited

A future item must supply a specific Burwood Council audited GPFS PDF (or an
audited financial-statements PDF) with an explicit unit and reconciling printed
totals. Do not use the annual-report summary as a substitute GPFS.
