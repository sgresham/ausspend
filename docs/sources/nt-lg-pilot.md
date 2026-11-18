# Northern Territory local government GPFS pilot (3 councils)

- id: `nt-lg-pilot`
- councils: City of Darwin, City of Palmerston, Alice Springs Town Council
- publisher: the three councils
- jurisdiction: local
- status: active (three-council pilot, not statewide)
- licence: © the three councils. Audited GPFS used for public-interest research; not an open-data licence grant.

The connector reads the FY2025-26 audited Statement of Comprehensive Income from each latest annual
report, requires an explicit `$'000` unit, and reconciles printed income and expense components to
the printed totals with zero tolerance. It emits 37 non-additive actual rows: 13 for Darwin
(including printed reimbursements) and 12 each for Palmerston and Alice Springs.

All rows carry `jurisdiction_level: "local"`, `jurisdiction: "NT"`,
`delivery_entity`/`location.lga_name` = council name, `location.state: "NT"`,
`measure_type: "actual"`, `data_quality_flag: "provisional"`,
`reconciliation_status: "printed_totals_reconciled"` and `human_spot_check: required`. COFOG is
blank. There is no cross-council or statewide total; the three councils are never added to
`nt-budget` or territory spending.

Archived PDFs (outside the repo):

- Darwin: 28,591,026 B SHA-256 `7291498d18748194e2eb8d5e4a8d1ff7d3eaee7f2f6583c4a55a76f456d0ef79`
- Palmerston: 7,910,758 B SHA-256 `57c33a4d90e682ffef0c86b5f3380aa9c814b9e183fe098b290cb5b9f3f271eb`
- Alice Springs: 11,640,642 B SHA-256 `68944b6d82f1ab443e3c5a235785767985dae061606c364699618016f535c48b`

Runner: `npm run ingest:local-gov` (QLD → WA → TAS → NT) or `--source=nt-lg-pilot`.
