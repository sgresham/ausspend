# TAS local government CDC — source discovery

- source id: `tas-lg-cdc`
- generated: 2026-11-18
- status: **buildable** — actual bulk ZIP repositories discovered and ingested for the latest three complete years
- discovery page: <https://listdata.thelist.tas.gov.au/opendata/>

## Premise falsifier

**TRUE.** LIST exposes two actual statewide ZIP repositories, each containing one CDC MASTER XLSX.
The 2015-2025 workbook has all 29 Tasmanian councils for 10 financial years, whole-dollar values, and
reconcilable revenue/expense and asset/liability totals.

## Files

| file                                    |      bytes | SHA-256                                                            | contents                                                                               |
| --------------------------------------- | ---------: | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| `LGA_CDC_Data_Repository_2000-2015.zip` | 16,835,015 | `91a1418941150169a3155a3ff171b1977aa3dc2de1362316c3dfa374b6f7a641` | one `Data Repository - MASTER - 2000-2015.XLSX`; FY2000-01–FY2014-15                   |
| `LGA_CDC_Data_Repository_2015-2025.zip` | 13,432,951 | `007679502515e36e0f72783020ad59f7873416e42c2f231c15adb5242a4fe69f` | one `LISTData Repository - MASTER - 2015-2025.xlsx`; 29 councils × FY2015-16–FY2024-25 |

Direct base: `https://listdata.thelist.tas.gov.au/opendata/data/`
Archived outside the repo at `/home/steve/ausspend-source-archive/tas-lg-cdc/`.

## Coverage and decisions

- Ingested from the latest ZIP: **Financial Data** sheet, FY2022-23, FY2023-24 and FY2024-25
  (the three most recent complete years), **29 councils each**.
- Eight printed measures: total operating revenue, total operating expenses, capital expenditure on
  existing assets, capital expenditure on new assets, total assets, total liabilities, net assets,
  working capital.
- Whole AUD detected from total-asset magnitude; the `$'000` assumption is rejected. Printed
  revenue−expense and asset−liability−net-asset reconciliations are enforced within $1.50.
- 684 non-additive actual rows (225/230/229; blank cells are not emitted).
- Older FY2015-16–FY2021-22, the 2000-2015 repository, and the other CDC sheets/resources are
  documented as future work; they are not ingested in this phase.
- No cross-council/year total, no `tas-budget` duplication, no state grant mixing.
