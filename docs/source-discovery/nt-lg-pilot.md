# NT local government GPFS pilot — discovery

- scope: **City of Darwin, City of Palmerston, Alice Springs Town Council only**
- generated: 2026-11-18
- status: buildable; 3 of 3 councils retrieved

## Documents (latest audited FY2025-26)

| council                    | official URL                                                                                                                            |      bytes | SHA-256                                                            |                               GPFS page |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------: | ------------------------------------------------------------------ | --------------------------------------: |
| City of Darwin             | `https://www.darwin.nt.gov.au/sites/default/files/2026-11/109572%20City%20of%20Darwin%20Annual%20Report%202025%20-%2026_FA%20Pages.pdf` | 28,591,026 | `7291498d18748194e2eb8d5e4a8d1ff7d3eaee7f2f6583c4a55a76f456d0ef79` | Statement of Comprehensive Income p.122 |
| City of Palmerston         | `https://palmerston.nt.gov.au/sites/default/files/uploads/files/2026/COP_Annual%20Report%202025-26_WEB%20-%20Final.pdf`                 |  7,910,758 | `57c33a4d90e682ffef0c86b5f3380aa9c814b9e183fe098b290cb5b9f3f271eb` |  Statement of Comprehensive Income p.81 |
| Alice Springs Town Council | `https://www.alicesprings.nt.gov.au/documents/1041/annual-report-2025-2026`                                                             | 11,640,642 | `68944b6d82f1ab443e3c5a235785767985dae061606c364699618016f535c48b` |  Statement of Comprehensive Income p.51 |

All three print explicit `$'000` and audited GPFS. Archived outside the repo at
`~/ausspend-source-archive/nt-lg-pilot/`.

## Printed anchors ($'000)

- Darwin: total income 148,681; total expenses 161,642.
- Palmerston: total income 46,613; total expenses 56,027.
- Alice Springs: total income 51,532; total expenses 56,301.

Income and expense components reconcile exactly in every case. No council gap; pilot is complete
for these three councils. Not full NT coverage and not a statewide dataset.
