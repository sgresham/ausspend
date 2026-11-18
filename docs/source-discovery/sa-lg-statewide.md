# SA statewide local-government datasets — non-financial scope / deferral

- package: `api-statewide-local-government-datasets`
- portal: <https://data.sa.gov.au/data/dataset/api-statewide-local-government-datasets>
- metadata modified: 2021-07-15
- status: **non-financial / no SA local spending connector**

## Premise falsifier

**FALSE for financial data.** The package is a governance/services Metabase for the LGA of South
Australia’s My Local Services App: Elected Members (Mayors and Councillors), Events, Libraries,
Parks and Councils. It contains no council expenses, revenue, rates, capital works, assets,
liabilities or financial statements.

## Resources (3 only)

| resource                                | URL                  | observed                                                                                                                            |
| --------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Statewide Local Government datasets API | `https://parse.com`  | generic Parse entry, not a dataset; HTTP 200 marketing page                                                                         |
| Parse API Instruction Document          | data.sa PDF download | 9 pages; downloaded **641,914 B**, SHA-256 `21450189c5c5b39c4c4907990edaa9fefa6b22ba5ba66ac467f2ef8142173114` (CKAN lists 73,986 B) |
| Local Council Names                     | data.sa CSV download | **1,807 B**, 67 council names; SHA-256 `2e5eecfdb4a55a3715a278165bfa5a26b065a1a54c02ecb95f1db90572fb1b2e`                           |

Archived outside the repo at `/home/steve/ausspend-source-archive/sa-lg-statewide/` (PDF, CSV,
SHA256SUMS).

## Parse classes in the instruction PDF

- `contact` — elected members, mayors, councillors, position, ward, contact details
- `contentItem` — Events, Libraries, Parks and Points of Interest
- `council` — name, contact email/phone, logo/payment URLs, website, state
- `custom_event`, `custom_library`, `custom_park`, `custom_pointOfInterest` — rendered content

No class or field carries a council financial amount. The only money-adjacent strings are
`paymentText`/`paymentUrl` on `council`.

## Access status

- Documented Parse server `http://parse.lga.sa.gov.au:5338/parse/` — **DNS does not resolve**
  (checked 2026-11-18).
- Legacy `https://api.parse.com/1/classes/...` — HTTP **410**.
- No reachable Parse class or API endpoint provides council financial data.

## Decision

- **Do not create `sa-lg-statewide`**, a stub or a spending mapper.
- Do not map council names, elected members, libraries or parks as spending.
- SA local financial coverage is **not available from this statewide dataset**.
- Council-by-council SA GPFS is deferred under the user non-goal.
- `sa-budget-gfs` remains the separate SA state GFS source; it is not duplicated.
