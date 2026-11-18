# Queensland local government comparative information — financial inputs and road data

- id: `qld-local-government`
- publisher: Queensland Department of Local Government, Water and Volunteers
- source: <https://www.data.qld.gov.au/dataset/queensland-local-government-comparative-information-report>
- jurisdiction: local
- status: active
- licence: Creative Commons Attribution 4.0 International (CC BY 4.0)

The existing `qld-local-government` source now ingests two CSVs from the CKAN package
`queensland-local-government-comparative-information-report`:

- **Financial Inputs** — 402 council-year rows, 77 councils, FY2010-11–FY2015-16, 30 printed
  `$'000` financial measures (income, expenses, interest, balance-sheet inputs).
- **Road Data** — 408 rows, 77 valid councils, FY2010-11–FY2015-16, the 10 printed `$'000`
  road capital/maintenance/bridge/culvert/depreciation expenditure columns.

Every row is council-level actual reported data in `$’000`, converted to integer cents at
×100,000. `jurisdiction_level` is `local`, `jurisdiction` is `QLD`, `delivery_entity` and
`location.lga_name` are the published council name, `location.state` is `QLD`, and
`aggregation_role` is `agency_detail`; `verified` is false and `data_quality_flag` is
`provisional`. COFOG is blank because the published comparative CSV is not COFOG-classified.

Road Data non-financial fields — linear kilometres, traffic-band kilometres, bridge counts,
decking area, culvert counts, floodway area, current replacement cost, written-down value and the
year last revalued — are **not** ingested. No count or physical measure is relabelled as spending.

The four original financial measure keys (`total_operating_expenses`, `employee_expenses`,
`depreciation_amortisation`, `interest_paid_borrowing_costs`) and their natural keys are unchanged.
Added financial and road measures use a stable `category` key; the four original keys also retain
`qld_lg_measure`. Components carry `qld_lg_component_of` but are never added to their printed total.
No cross-council, cross-year, cross-resource or cross-measure total is computed.

This source is separate from `qld-qgip` state-to-local grants/procurement: QGIP is never
duplicated here and these council rows are never summed with it.

The package exposes no Financial Inputs or Road Data years after FY2015-16 (CSV resources last
modified 2022-11-25); FY2016-17+ is a documented coverage gap and is not reconstructed.

Archive (outside the repo):

- `qld-local-government-financial-inputs.csv` — 82,305 B, SHA-256
  `6cc0ad90b34441992c3b4a9d75d6947436e306f7b41fa0d3379daa51cde75001`.
- `qld-local-government-road-data.csv` — 83,903 B, SHA-256
  `dc6225f2bb0bd6407a214ed60249aeffbf69cb70830622f689da43a94c9b1786`.

Runner: `npm run ingest:local-gov` (QLD only in this phase; extension point in
`scripts/ingest-local-gov.ts`).
