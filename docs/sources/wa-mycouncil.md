# Western Australia MyCouncil — local government actuals

- id: `wa-mycouncil`
- publisher: Government of Western Australia — MyCouncil
- source: <https://mycouncil.wa.gov.au/>
- service: <https://prod-mycouncil-services.azurewebsites.net/data.svc/>
- metadata: <https://prod-mycouncil-services.azurewebsites.net/data.svc/$metadata>
- jurisdiction: local
- status: active
- licence: © Government of Western Australia — MyCouncil. Public financial snapshot; not an open-data licence grant for third-party reuse.

The connector validates the OData `$metadata`, then pages two actual entity sets with
`$select`/`$orderby`/`$top`/`$skip`:

- **vw_LG_Expenditure** — council actual expenditure by program and financial year,
  FY2010-11–FY2024-25. The live snapshot has 24,196 rows, 139 councils and 12 printed program
  lines (11 programs plus a council-level `Total Expenditure`). 24,007 valid non-additive rows
  are ingested.
- **vw_LG_FinanceActuals** — controlled financial snapshot. Only `TotalRevenue` and
  `EmployeeCost` are ingested, and only where the published value is positive (3,554 rows).
  Zeros are treated as unavailable snapshot values, not published zero-dollar actuals.

`vw_LG_FinanceBudget` and `vw_LG_GrantData` are **not queried**. WA Budget remains the separate
`wa-budget` source and is never summed with MyCouncil council actuals or state-to-local grants.

Values are whole Australian dollars; the live Swan FY2024/25 total expenditure
**$284,214,363** (OData `284214363`) matches the MyCouncil council view exactly and converts to
`28,421,436,300` cents. Every row is `jurisdiction_level: "local"`, `jurisdiction: "WA"`,
`delivery_entity` and `location.lga_name` = council name, `location.state: "WA"`,
`measure_type: "actual"`, `aggregation_role: "agency_detail"`, `verified: false` and
`data_quality_flag: "provisional"`. COFOG is blank: MyCouncil program labels are not COFOG.

Natural keys include the source, MyCouncil `LGId`, financial year and program/line. No row is a
cross-council or statewide total; the `Total Expenditure` line is per council. The source is a
controlled public financial snapshot, not audited general-purpose financial statements.

Archive (outside the repo):

- `metadata.xml` — 45,290 B, SHA-256
  `1432ce5a437298a62d3277e92fb230a3636cea4b155457e6dc527cfc1a15e210`.
- `records.json` — SHA-256
  `3ad0bc966797938a3131b73c6f9391aec714c2177d9bc870487f0997cfd10dbe`.

Runner: `npm run ingest:local-gov` runs QLD → WA; use
`npm run ingest:local-gov -- --source=wa-mycouncil` for WA only.
