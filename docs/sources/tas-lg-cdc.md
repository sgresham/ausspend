# Tasmanian local government Consolidated Data Collection (CDC)

- id: `tas-lg-cdc`
- publisher: Local Government Association of Tasmania / LIST
- source: <https://listdata.thelist.tas.gov.au/opendata/>
- jurisdiction: local
- status: active
- licence: © Tasmanian Local Government Association / LIST. Public CDC data used for public-interest research; not an open-data licence grant.

The LIST Open Data page links two statewide CDC ZIP repositories. The connector discovers and
archives the latest `LGA_CDC_Data_Repository_2015-2025.zip` (13,432,951 B; SHA-256
`007679502515e36e0f72783020ad59f7873416e42c2f231c15adb5242a4fe69f`), extracts its MASTER XLSX,
and ingests the `Financial Data` sheet for the three most recent complete years:

- FY2022-23, FY2023-24, FY2024-25
- all 29 Tasmanian councils in each year
- 684 non-additive actual rows

Measures: total operating revenue, total operating expenses, capital expenditure on existing
assets, capital expenditure on new assets, total assets, total liabilities, net assets and working
capital. Values are whole Australian dollars, detected from the total-asset magnitude; the
connector rejects an ambiguous unit rather than assuming `$'000`. Printed revenue−expense and
asset−liability−net-asset reconciliations are enforced within $1.50.

Every row is `jurisdiction_level: "local"`, `jurisdiction: "TAS"`,
`delivery_entity`/`location.lga_name` = council name, `location.state: "TAS"`,
`measure_type: "actual"`, `aggregation_role: "agency_detail"`, `verified: false` and
`data_quality_flag: "provisional"`. COFOG is blank; no cross-council/year total is produced.

The older `LGA_CDC_Data_Repository_2000-2015.zip` and the other CDC sheets/resources are archived
or documented but not ingested in this phase. `tas-budget` remains the separate TAS state budget
and is never summed with CDC council actuals.

Archive: `/home/steve/ausspend-source-archive/tas-lg-cdc/` (both ZIPs + SHA256SUMS). Runner:
`npm run ingest:local-gov` (QLD → WA → TAS), or `--source=tas-lg-cdc`.
