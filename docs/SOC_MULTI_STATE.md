# Multi-state SOC inventory — VIC, QLD, WA, SA, TAS, ACT and NT

**Status: inventory plus eight implemented QLD pilots (Energy Queensland, CS Energy, Stanwell,
Powerlink Queensland, Sunwater Limited, Gladstone Ports Corporation Limited, Ports North and NQBP)
and the first six WA GTE pilots (Water Corporation, Synergy, Western Power, Horizon Power, Fremantle Ports and DevelopmentWA). No other state connector,
no cross-entity/state total, and no ingestion into government spending.** The inventory checks below
were read-only page/API probes made on **2026-11-17**. The QLD pilots added on **2026-11-19** are
entity-level adapters in the existing SOC framework; they do not create a QLD total and are never
added to government spending, the PNFC benchmark or each other. The local app database was **not**
written to by this documentation work; the documented baseline is **515,449 measures and 105 NSW
SOC rows**. The older brief figure of **515,413 is stale** and is not used here. No 3001/5173 or
production nginx change was made.

This document inventories the _entity-level_ state-owned commercial sector in the seven
jurisdictions the owner asked about. It deliberately does **not** call every regime "NSW SOC".
"State-owned corporation" (SOC) is New South Wales legal shorthand. The other jurisdictions use
different legal classes, different regulators, different official lists and different annual-report
formats:

- **VIC** — State business corporations / State bodies under the _State Owned Enterprises Act 1992_,
  plus statutory water corporations under the _Water Act 1989_ and other statutory authorities.
- **QLD** — Government Owned Corporations (GOCs) under the _Government Owned Corporations Act 1993_
  (Qld), plus two statutory bodies with commercial operations.
- **WA** — Government Trading Enterprises (GTEs) under the _Government Trading Enterprises Act 2023_
  (WA), with a second tranche not yet in the Act.
- **SA** — public corporations under the _Public Corporations Act 1993_ (SA), plus statutory
  corporations under their own enabling Acts.
- **TAS** — Government Business Enterprises (GBEs) under the _Government Business Enterprises Act
  1995_ (Tas), plus State-owned Companies.
- **ACT** — Territory-owned Corporations under the _Territory-owned Corporations Act 1990_ (ACT), but
  the official budget classification uses the wider Public Trading Enterprise / Public Non-Financial
  Corporation (PTE/PNFC) class.
- **NT** — Government Owned Corporations (GOCs) under the _Government Owned Corporations Act 2001_
  (NT); each GOC is declared by its own constituting Act, not by a schedule in the GOC Act.

The purpose is to let the owner choose a state and an entity, not to imply that a national,
comparable "SOC" dataset exists.

## Premise falsifier — states do not share one comparable SOC list

**The premise that every state has a single "SOC" list with comparable annual-report financials is
false.** The evidence is in the rest of this document, but the short form is:

1. **Different legal classes.** VIC has no single GBE list and treats water corporations as a
   separate statutory class; QLD has GOCs plus non-GOC statutory bodies; WA has 12 GTEs in the Act,
   4 more intended for the framework, and 27 entities Treasury says "might be considered possible
   GTEs"; SA's Act defines public corporations but does not schedule them; TAS lists GBEs and
   State-owned Companies on one page last published in 2018; ACT's legal TOC class and its budget
   PTE/PNFC class do not fully coincide; NT's GOC Act says a GOC is "a statutory corporation that is
   declared to be a Government owned corporation by its constituting Act".
2. **Different official-list quality.** QLD publishes a clean, current GOC list. WA publishes a
   current in-scope GTE list but also a second tranche and a 27-entity universe. VIC publishes a
   controlled-entities _changes_ list and a non-exhaustive statutory-corporations dataset. SA and NT
   do not appear to publish a single consolidated public list. TAS publishes a list but it is stale.
   ACT publishes a budget classification, not a consolidated TOC register.
3. **Different reporting units and statement formats.** The annual reports that exist are generally
   audited general-purpose financial statements, but the printed unit varies (`$'000` or `$m`), the
   statement faces differ, and some entities are insurers, financiers, trustees, land developers or
   transport operators rather than trading utilities. Some small entities may not publish a
   standalone audited statement at all.
4. **Different ownership boundaries.** Parent-only versus consolidated statements, subsidiaries,
   joint ventures and local-government involvement all differ. TAS's TasWater is a conspicuous
   example: it is **not** on the Treasury GBE/State-owned Company list, so its ownership and
   reporting class must be confirmed before it could be added to any Tasmanian set.
5. **Different reporting cycles and policy treatments.** Some reports are consolidated into a
   parent or a whole-of-state financial report; some entities are small statutory authorities with no
   comparable commercial statement. A report being available does not make it comparable.

**Therefore: entity-level only. Never sum across states, across legal classes, across entities, or
across a parent and its subsidiaries. Never present these as a national spending total. Do not
start extraction until the owner prioritises a state and the entity list is confirmed.**

## Summary table

Counts below are the counts of the _named lists at the cited source_, not an estimate of the
"real" universe. Where a source is partial, the cell says so.

| State   | Legal/reporting class                                                                                   | Official list found                                                                                                                      | Entities named at source                                                                                 | Latest annual reports                                                                                                                      | Entity-level extraction                                                          | Proposed rank |
| ------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- | ------------- |
| **QLD** | Government Owned Corporations (GOCs) + 2 commercial statutory bodies                                    | QLD Treasury GOC page, current                                                                                                           | **11 GOCs + 2 statutory bodies**                                                                         | **Energy Queensland, CS Energy, Stanwell, Powerlink Queensland, Sunwater Limited, Gladstone Ports Corporation Limited, Ports North and NQBP 2025-26 verified (pilots; NQBP via the official Parliament tabled copy); Port of Townsville FY2025-26 deferred (printed $1 rounding gap, no rows)**; other GOC reports not individually verified | **High** — one current list, large entities, audited annual reports              | **1**         |
| **WA**  | Government Trading Enterprises (GTEs)                                                                   | WA Treasury GTE governance page, current                                                                                                 | **12 in-scope GTEs + 4 second-tranche entities; Treasury says 27 "possible GTEs"**                       | GTE reports; Synergy annual-reports page verified; Water Corporation, Synergy, Western Power, Horizon Power, Fremantle Ports and DevelopmentWA 2025-26 verified (pilots)                                                                                          | **High for the 12**; medium for tranche 2                                        | **2**         |
| **VIC** | State business corporations / State bodies + statutory water corporations + other statutory authorities | DataVic controlled-entities _changes_ list (CC BY 4.0); non-exhaustive statutory-corporations dataset; official water-corporation finder | **16 water corporations named on the finder page**; no single complete GBE list                          | Entity reports published; URLs not individually verified                                                                                   | **Medium** — large water entities are feasible; GBE list must be confirmed       | **3**         |
| **TAS** | Government Business Enterprises (GBEs) + State-owned Companies                                          | Tas Treasury "Tasmanian Government Businesses" page                                                                                      | **6 GBEs + 8 State-owned Companies (14)**                                                                | Treasury links to reports; page last published 2018                                                                                        | **Medium** — clear list but stale; several non-comparable entities               | **4**         |
| **ACT** | Territory-owned Corporations (legal) / PTE/PNFC (budget classification)                                 | ACT Budget 2026-27 "Classification of ACT Entities"                                                                                      | **6 PTE/PNFC entities**; legal TOC list not separately consolidated                                      | Entity reports published; URLs not individually verified                                                                                   | **Medium-low** — only Icon Water is a classic commercial utility; class mismatch | **5**         |
| **SA**  | Public corporations + statutory corporations                                                            | _Public Corporations Act 1993_ (SA); no single consolidated public list found                                                            | **No reliable count**; 3 examples verified from enabling Acts                                            | Entity reports published; no consolidated list                                                                                             | **Low-medium** — entity-by-entity; list must be confirmed first                  | **6**         |
| **NT**  | Government Owned Corporations (GOCs) + government business divisions                                    | _Government Owned Corporations Act 2001_ (NT); NTTC client-services table; entity disclosures                                            | **No single consolidated list**; 3 GOCs confirmed (Power and Water, Territory Generation, Jacana Energy) | Jacana 2025-26 PDF verified; Power and Water/Territory Generation not opened                                                               | **Low-medium** — only 3 confirmed; Act declares per constituting Act             | **7**         |

**Unit and comparability finding.** No state publishes one unit across all of its state-owned
entities. Even within a state, an annual report may print `$'000` or `$m`, and some entities may
print whole dollars or use a different statement presentation. A state-wide or national unit
assumption would be wrong. Any future extraction must read the unit from each report, record the
evidence, and reconcile to a printed total before converting to integer cents. This is the same rule
the NSW SOC layer already applies.

## State-by-state detail

### 1. Queensland — GOCs (recommended first state)

**Legal/reporting class.** Queensland Government Owned Corporations under the _Government Owned
Corporations Act 1993_ (Qld), also subject to the _Corporations Act 2001_ (Cth). Queensland Treasury
states that GOCs are bound by "the _Queensland Government Owned Corporations Act 1993_ and the
_Corporations Act 2001 (Cth)_". The same page lists two **statutory bodies with commercial
operations** — Queensland Rail (Queensland Rail Transit Authority) and Seqwater (Queensland Bulk
Water Supply Authority). Those two are **not GOCs** and must not be mixed into a GOC total.

**Regulator/act.** Queensland Treasury monitors GOC performance, negotiates annual performance
contracts and five-yearly plans, assesses major investments and administers board appointments.
Shareholding and portfolio ministers are named per entity. The legal framework is the GOC Act 1993
(Qld) plus each GOC's constitution and the Corporations Act.

**Official entity list and source URL.** Queensland Treasury, "Government-owned corporations" page,
<https://www.treasury.qld.gov.au/policies-and-programs/economy/government-owned-corporations/>
(fetched 2026-11-17; page last updated 16 April 2026). The page lists:

- **Energy generation:** CS Energy Limited; Stanwell Corporation Limited; CleanCo Queensland Limited.
- **Energy transmission:** Queensland Electricity Transmission Corporation Limited (Powerlink
  Queensland).
- **Energy distribution:** Energy Queensland Limited.
- **Ports:** Far North Queensland Ports Corporation Limited (Ports North); Gladstone Ports
  Corporation Limited; North Queensland Bulk Ports Corporation Limited; Port of Townsville Limited.
- **Water:** Sunwater Limited.
- **Other:** QIC Limited.
- **Statutory bodies (not GOCs):** Queensland Rail Transit Authority (Queensland Rail); Queensland
  Bulk Water Supply Authority (Seqwater).

That is **11 GOCs and 2 commercial statutory bodies**. The source does not print a total count; the
count is a count of the named rows and must be rechecked whenever the page changes.

**Latest annual report availability.** GOCs publish annual reports through their own websites. The
2025-26 reporting cycle is the current cycle in November 2026, but this inventory did **not** open
each report or verify each URL. Extraction must open the entity's latest report, record the
financial year and publication date, and use that report's audited statements. Do not assume a
report exists on a fixed URL.

**Financial statement/unit.** Audited general-purpose financial statements. The printed unit varies
by report (`$'000` or `$m` is common). The unit must be read from the report face or note header and
stored as integer cents only after an explicit unit read and a reconciliation to a printed total,
following the NSW SOC rule.

**Entity-level extraction feasibility.** **High.** One current official list, 11 large commercial
entities, audited annual reports, and stable corporate websites. The statements are similar enough
within energy, ports and water to build a small adapter family, but each layout still needs its own
parser and reconciliation. QIC is the exception: it is an investment manager with a different
statement format and should be last or excluded.

**Licence/terms.** The Treasury page is © The State of Queensland; it is not an open-data licence
grant for the annual reports. Each GOC's annual report is © the corporation. Treat reports as
public-interest research material: archive URL, SHA-256 and retrieval date; quote figures with
attribution; do not redistribute the PDFs. Do not assume the CC BY 4.0 licence that applies to
data.qld budget datasets applies to GOC annual reports.

**Known gaps/ambiguities.**

- The two statutory bodies are on the same page but are a different legal class. If the owner wants
  "commercial state entities", they may be in scope; if the owner wants "GOCs", they are out.
- QIC is not a trading utility and its financial statements are not comparable to CS Energy or
  Sunwater.
- GOC subsidiaries and joint ventures are consolidated into the parent; do not add parent and
  subsidiary rows.
- Some GOCs receive community service obligation (CSO) or equity injections; these affect
  comparability of revenue and net result across entities and years.

**Priority entities (proposed).**

1. Energy Queensland Limited — largest energy network business; standard statements (implemented).
2. CS Energy Limited — generation; standard statements (implemented).
3. Stanwell Corporation Limited — generation; standard statements (implemented 2026-11-19).
4. Powerlink Queensland — transmission; standard statements (implemented 2026-11-19).
5. Sunwater Limited — water; standard statements (implemented 2026-11-19).
6. Gladstone Ports Corporation Limited — large port; standard statements (implemented 2026-11-19).
7. Ports North — port; standard statements (implemented 2026-11-19). NQBP (North Queensland Bulk Ports Corporation Limited) — port; standard statements (implemented 2026-11-19, official Parliament tabled copy). Port of Townsville Limited — deferred 2026-11-19 (printed $1 rounding gap, no rows).
8. CleanCo Queensland — smaller generation; later.
9. QIC Limited — last; flag as non-comparable.

### 2. Western Australia — GTEs

**Legal/reporting class.** Government Trading Enterprises under the _Government Trading Enterprises
Act 2023_ (WA), which consolidates the governance requirements previously spread across the
establishing Acts of the in-scope GTEs. The Act commenced 1 July 2023 (Royal Assent 22 June 2023).

**Regulator/act.** WA Department of Treasury and Finance, GTE Governance and Oversight Unit. The
portfolio/shareholding ministers and the Treasurer oversee the GTEs; the Economic Regulation
Authority regulates certain water, electricity and rail activities. The GTE Act 2023 and each
entity's establishing Act form the legal framework.

**Official entity list and source URL.** WA Government, "GTE governance",
<https://www.wa.gov.au/organisation/department-of-treasury-and-finance/gte-governance> (fetched
2026-11-17; last updated 10 July 2023). The page says:

> "In Western Australia there are 27 entities that might be considered possible GTEs, of which 12
> are included as in-scope GTEs under the GTE Act."

The **12 in-scope GTEs** named are:

- **Energy corporations:** Horizon Power; Synergy; Western Power.
- **Water corporations:** Aqwest; Busselton Water; Water Corporation.
- **Port authorities:** Fremantle Port Authority; Kimberley Ports Authority; Mid West Ports
  Authority; Pilbara Ports Authority; Southern Ports Authority.
- **Other:** DevelopmentWA.

The **second tranche** intended to transition into the GTE framework is: Forest Products Commission;
Gold Corporation; Insurance Commission of Western Australia; Western Australian Treasury Corporation.

That is **12 + 4 = 16 named entities**, against a Treasury statement of **27 possible GTEs**. The
difference is not a list of 11 missing names; it is a policy universe. Do not invent names to fill
the gap.

**Latest annual report availability.** GTEs publish annual reports. A verified example is Synergy's
annual-reports page, <https://www.synergy.net.au/About-us/News-and-announcements/Annual-reports>
(fetched 2026-11-17; the page exists in the site navigation and the site's news items run to November
2026). The 2025-26 cycle is current. Other GTE report URLs were not individually opened in this pass;
verify each before extraction.

**Financial statement/unit.** Audited general-purpose financial statements. Read the unit per
report; do not assume `$'000` or `$m` from the entity type. Store integer cents only after an
explicit unit read and reconciliation.

**Entity-level extraction feasibility.** **High for the 12 in-scope GTEs; medium for the second
tranche.** The 12 are a closed, current, official list; they are large commercial businesses with
audited statements. The second tranche includes a forest manager, a gold trading business, an
insurer and a central borrowing authority — different statement formats and different economics.
The 27-entity universe is **not** an extraction list.

**Licence/terms.** The WA.gov.au page is © Government of Western Australia. Each GTE annual report
is © the entity. Some data.wa datasets are CC BY or CC BY-SA, but that does not automatically cover
GTE annual reports. Archive metadata/hashes, quote with attribution, and do not redistribute PDFs.

**Known gaps/ambiguities.**

- **12 vs 16 vs 27** is the central ambiguity. The owner must choose between "in-scope GTEs under the
  Act" and "all entities Treasury considers possible GTEs". This document recommends the 12.
- The second tranche is "intended to be transitioned"; it is not yet in the GTE Act framework.
- Insurance Commission of WA and WA Treasury Corporation are financial-sector entities, not trading
  enterprises. Gold Corporation has a minting/bullion business. Forest Products Commission is a
  forest manager.
- Aqwest and Busselton Water are small water utilities; they are comparable in kind to Water
  Corporation but much smaller and may have different statement presentation.

**Priority entities (proposed).**

1. Water Corporation — largest water utility; standard statements (implemented 2026-11-19; first WA GTE pilot).
2. Synergy — electricity generation/retail; standard statements (implemented 2026-11-19; second WA GTE pilot).
3. Western Power — electricity network; standard statements (implemented 2026-11-19; third WA GTE pilot).
4. Horizon Power — regional electricity; standard statements (implemented 2026-11-19; fourth WA GTE pilot).
5. DevelopmentWA — land development; different but audited (implemented 2026-11-19; sixth WA GTE pilot).
6. Pilbara Ports Authority — large port; standard statements.
7. Fremantle Port Authority — port; standard statements (implemented 2026-11-19; fifth WA GTE pilot).
8. Kimberley/Mid West/Southern Ports — later, smaller.
9. Aqwest/Busselton Water — later, smaller.
10. Second tranche (Forest Products Commission, Gold Corporation, Insurance Commission, WA Treasury
    Corporation) — later; flag non-comparable.

### 3. Victoria — GBEs, state-owned companies and statutory water corporations

**Legal/reporting class.** Victoria does not have one "SOC" class. The _State Owned Enterprises Act
1992_ (Vic) provides for State business corporations and State bodies. Water corporations are
statutory corporations under the _Water Act 1989_ (Vic), not GBEs under the SOE Act. Other statutory
authorities and controlled entities sit alongside them. The budget's controlled-entities note
consolidates significant entities for whole-of-state reporting, but that is an accounting boundary,
not a single commercial class.

**Regulator/act.** Department of Treasury and Finance (DTF) for financial management and the State
Budget; the _Financial Management Act 1994_ (Vic) and the Standing Directions 2018; the _State Owned
Enterprises Act 1992_; the _Water Act 1989_ for water corporations. The Essential Services
Commission regulates water and energy prices. Portfolio ministers oversee individual entities.

**Official entity list and source URL.** There is **no single complete GBE list** on the pages
checked. The best official sources are:

- **State Budget 2025-26 — Controlled entities list** (DOCX, CC BY 4.0), dataset page
  <https://discover.data.vic.gov.au/dataset/state-budget-2025-26-controlled-entities-list>
  (fetched 2026-11-17). The document itself is titled "Controlled entities" and describes changes to
  entities consolidated from 1 July 2024. It names general-government entities and notes changes
  (for example, VicGrid was established as a State Body under the State Owned Enterprises Act 1992
  on 15 April 2025; VicForests ceased operations on 30 June 2024). It is a **changes** list, not a
  complete register.
- **List of statutory corporations with responsible department, constituting statute and Crown
  status**, DataVic dataset
  <https://discover.data.vic.gov.au/dataset/list-of-statutory-corporations-with-responsible-department-constituting-statute-and-crown-statu>
  (fetched 2026-11-17). The dataset description explicitly says it is a **non-exhaustive** list and
  "does not list all statutory corporations".
- **Find your water corporation**, water.vic.gov.au,
  <https://www.water.vic.gov.au/for-households/find-your-water-corporation> (fetched 2026-11-17).
  This page names the water corporations, including: Melbourne Water; Yarra Valley Water; South East
  Water; Greater Western Water; Barwon Water; Central Highlands Water; Coliban Water; East Gippsland
  Water; Goulburn-Murray Water; Goulburn Valley Water; Grampians Wimmera Mallee Water; Lower Murray
  Water; North East Water; South Gippsland Water; Wannon Water; Westernport Water. That is **16
  names on the page**; the page is a customer-facing finder, not a statutory register, so treat the
  count as "named at source" rather than a legal total.
- **State Owned Enterprises Act 1992** (Vic), authorised version,
  <https://www.legislation.vic.gov.au/in-force/acts/state-owned-enterprises-act-1992/023> (fetched
  2026-11-17). The Act is the legal basis for State business corporations and State bodies.

**Latest annual report availability.** Water corporations and GBEs/state-owned companies are
expected to publish annual reports; DTF also publishes the whole-of-state Financial Report and state
financial data sets. The 2025-26 cycle is current in November 2026, but this inventory did not open
each entity's report or verify each URL. Extraction must verify the entity's current annual-report
page and record the financial year.

**Financial statement/unit.** Audited general-purpose financial statements. The unit varies; read it
from the report. Do not assume that because NSW water SOCs use `$'000`, Victorian water corporations
do too.

**Entity-level extraction feasibility.** **Medium.** The 16 named water corporations are a coherent,
large group and the most feasible Victorian starting point. The GBE side is less feasible because
there is no single complete list; the controlled-entities document is a changes list and the
statutory-corporations dataset is non-exhaustive. Do not start GBE extraction until a human confirms
the list from the whole-of-state Financial Report note or a DTF register.

**Licence/terms.** The DataVic controlled-entities dataset is **CC BY 4.0** (verified on the dataset
page). The statutory-corporations dataset is a DataVic dataset; check its licence before
redistribution. Annual reports are © each corporation/government body and are public-interest
research material, not an open-data grant.

**Known gaps/ambiguities.**

- **What does "VIC SOC" mean?** State business corporations/State bodies under the SOE Act, all
  controlled entities, water corporations, or all statutory authorities? These are different sets.
- The controlled-entities DOCX is a **changes** list for 2025-26, not the full Note 9.8 list. The
  full list is in the 2023-24 Financial Report; that report was not opened in this pass.
- The statutory-corporations dataset says it is non-exhaustive. It cannot be used as a complete
  entity list.
- VicGrid is a new State Body (established 15 April 2025), and the 2025-26 Budget note says the ABS
  is still finalising its sector classification. It is not a comparable operating utility yet.
- Water corporations are a different legal class from GBEs. Do not sum them with GBEs or present
  them as the same "SOC" layer.

**Priority entities (proposed).**

1. Melbourne Water — largest metropolitan water utility; standard statements.
2. Yarra Valley Water — large metropolitan retailer.
3. South East Water — large metropolitan retailer.
4. Greater Western Water — large metropolitan retailer.
5. Barwon Water — large regional utility.
6. Remaining water corporations (Central Highlands, Coliban, East Gippsland, Goulburn-Murray,
   Goulburn Valley, Grampians Wimmera Mallee, Lower Murray, North East, South Gippsland, Wannon,
   Westernport) — later, smaller.
7. GBEs/state-owned companies — only after the authoritative list is confirmed.
8. VicGrid — last/flag; new entity, ABS classification pending.

### 4. Tasmania — GBEs and State-owned Companies

**Legal/reporting class.** Tasmanian Government Business Enterprises under the _Government Business
Enterprises Act 1995_ (Tas), and State-owned Companies (companies owned by the State and subject to
the Corporations Act 2001 (Cth)). The Treasury page presents both on one page but they are different
legal forms.

**Regulator/act.** Tasmanian Department of Treasury and Finance, Government Businesses group;
portfolio ministers; the Tasmanian Economic Regulator for regulated sectors. The GBE Act 1995 and the
Corporate Governance Framework for Government Businesses are the main framework documents.

**Official entity list and source URL.** Tasmanian Treasury, "Tasmanian Government Businesses",
<https://www.treasury.tas.gov.au/regulation-site/Pages/Tasmanian-Government-Businesses.aspx>
(fetched 2026-11-17; page last published **21 June 2018**). The page says it is "a list of Tasmanian
Government Business Enterprises and State-owned Companies." It names:

- **Government Business Enterprises (6):** Sustainable Timber Tasmania; Hydro Tasmania; Motor
  Accidents Insurance Board; Port Arthur Historic Site Management Authority; Tasmanian Public Finance
  Corporation; The Public Trustee.
- **State-owned Companies (8):** Aurora Energy Pty Ltd; Metro Tasmania Pty Ltd; Tasmanian Irrigation
  Pty Ltd; Tasmanian Networks Pty Ltd; Tasmanian Ports Corporation Pty Ltd; Tasmanian Railway Pty
  Ltd; Tasracing Pty Ltd; TT-Line Company Pty Ltd.

That is **14 entities**. The page is **stale** (last published 2018), so the list must be rechecked
against current entity websites and the Treasurer's annual financial report before extraction.

**Latest annual report availability.** The Treasury page says each business link goes to the entity's
website "for an overview of the business, including key company information and summary financial
data"; that is the Treasury's statement, not a fresh verification of every report. The 2025-26 cycle
is current in November 2026, but the Treasury page itself has not been updated since 2018, so verify
each entity's current report and do not rely on its links as current.

**Financial statement/unit.** Audited general-purpose financial statements. Unit varies; read per
report. Some entities (MAIB, Tascorp, Public Trustee) have insurance, financing or trustee
statements that are not comparable to a trading utility.

**Entity-level extraction feasibility.** **Medium.** The list is small and clear in structure, but
it is stale and several entities are not trading comparables. The operating businesses (Hydro
Tasmania, TasNetworks, TasPorts, TasRail, Tasmanian Irrigation, Aurora Energy, TT-Line, Sustainable
Timber Tasmania, Metro Tasmania) are feasible. The financial/insurance/trustee entities should be
flagged out of the comparable set.

**Licence/terms.** The Treasury page is © State of Tasmania. Each annual report is © the entity.
No open-data licence was found for the reports. Archive metadata/hashes and quote with attribution.

**Known gaps/ambiguities.**

- The list was last published in 2018. Is it still current? Entity names, ownership and even
  existence may have changed.
- **TasWater is not on the GBE/State-owned Company list.** Its ownership and reporting class must be
  confirmed from an official source. If the owner wants "state-owned water", TasWater may be in
  scope, but it cannot be added to the GBE list without a decision.
- MAIB is an insurance scheme; Tascorp is a central financing authority; the Public Trustee is a
  trustee service. These are not trading comparables.
- Port Arthur Historic Site Management Authority and Tasracing are small/regulatory/heritage
  entities; their financials are not comparable to Hydro Tasmania.
- GBEs and State-owned Companies have different legal bases; do not sum them into one "Tas SOC"
  figure.

**Priority entities (proposed).**

1. Hydro Tasmania — large generation business; standard statements.
2. Tasmanian Networks (TasNetworks) — electricity network; standard statements.
3. Tasmanian Ports Corporation (TasPorts) — ports; standard statements.
4. Tasmanian Railway (TasRail) — rail; standard statements.
5. Tasmanian Irrigation — irrigation; standard statements.
6. Aurora Energy — electricity retail; standard statements.
7. TT-Line — ferry; standard statements.
8. Sustainable Timber Tasmania — forestry; standard statements.
9. Metro Tasmania — public transport; later.
10. Flag/out: MAIB, Tascorp, Public Trustee, Port Arthur, Tasracing; TasWater pending a scope
    decision.

### 5. Australian Capital Territory — TOCs vs PTE/PNFC

**Legal/reporting class.** Territory-owned Corporations under the _Territory-owned Corporations Act
1990_ (ACT). However, the ACT Budget's official "Classification of ACT Entities" uses the wider
**Public Trading Enterprises / Public Non-Financial Corporations (PTE/PNFC)** class. The two sets do
not fully coincide. The PTE/PNFC list includes Housing ACT and Transport Canberra Operations, which
are public-service delivery entities rather than classic TOCs.

**Regulator/act.** ACT Treasury (Chief Minister, Treasury and Economic Development Directorate);
the _Financial Management Act 1996_ (ACT); the _Territory-owned Corporations Act 1990_; the
Independent Competition and Regulatory Commission (ICRC) for regulated utilities; the ACT
Auditor-General.

**Official entity list and source URL.** ACT Budget 2026-27, "Classification of ACT Entities"
(DOCX/PDF), from the Budget Papers and Statements page,
<https://www.treasury.act.gov.au/budget/budget-2026-27/budget-papers-and-statements> (fetched
2026-11-17). The DOCX at
<https://www.treasury.act.gov.au/__data/assets/word_doc/0008/3080663/2026-27-Classification-of-ACT-Entities.docx>
was opened and its text extracted. It lists under
**"PUBLIC TRADING ENTERPRISES/PUBLIC NON-FINANCIAL CORPORATIONS"**:

- CIT Solutions (discontinued)
- Housing ACT
- Transport Canberra Operations
- ICON Water Limited
- City Renewal Authority
- Suburban Land Agency

That is **6 PTE/PNFC entities**. The legal TOC register is not separately consolidated in this
document. The _Territory-owned Corporations Act 1990_ (ACT) is at
<https://www.legislation.act.gov.au/a/1990-53/> (fetched 2026-11-17).

**Latest annual report availability.** PTE/PNFC entities are expected to publish annual reports
(Icon Water, City Renewal Authority, Suburban Land Agency, Transport Canberra Operations, Housing
ACT); the ACT Government also publishes directorate annual reports. The 2025-26 cycle is current in
November 2026. This inventory did not verify every entity's annual-report URL; the Icon Water
annual-report page guessed in this pass returned 404, so use the entity's current site navigation
rather than a guessed path.

**Financial statement/unit.** Audited general-purpose financial statements. Unit varies; read per
report. Icon Water is a water utility and is the closest ACT analogue to a NSW SOC. Housing ACT is
public housing; Transport Canberra Operations is a public transport operator; City Renewal Authority
and Suburban Land Agency are land development/renewal entities.

**Entity-level extraction feasibility.** **Medium-low.** The set is small (6), but the class is
ambiguous and only Icon Water is a classic commercial utility. CIT Solutions is discontinued.
Housing ACT and Transport Canberra Operations are not comparable to a trading enterprise. The City
Renewal Authority and Suburban Land Agency are land-development entities with different statements.

**Licence/terms.** The Budget papers and the Classification document are © ACT Government. Each
entity's annual report is © the entity. No open-data licence was found for the reports. Archive
metadata/hashes and quote with attribution.

**Known gaps/ambiguities.**

- **TOC vs PTE/PNFC.** The legal TOC list under the 1990 Act is not the same as the budget PTE/PNFC
  list. Which one is the "ACT SOC" analogue? This must be decided by the owner.
- CIT Solutions is marked "(discontinued)". It should not be extracted as a current entity.
- Housing ACT is a public housing provider, not a commercial trading enterprise.
- Transport Canberra Operations is a public transport operator, not a commercial trading enterprise.
- City Renewal Authority and Suburban Land Agency are land development/renewal entities; their
  financials are not comparable to Icon Water.
- The ABS classification of some ACT entities can change; check the current Budget classification
  each year.

**Priority entities (proposed).**

1. ICON Water Limited — the clearest commercial utility and the closest TOC analogue.
2. City Renewal Authority — land renewal; only if land development is in scope.
3. Suburban Land Agency — land development; only if land development is in scope.
4. Flag/out: Housing ACT (public housing), Transport Canberra Operations (public transport), CIT
   Solutions (discontinued).

### 6. South Australia — public corporations (no consolidated list found)

**Legal/reporting class.** Public corporations under the _Public Corporations Act 1993_ (SA), plus
statutory corporations established by their own enabling Acts. The Act provides for the control of
public corporations, but it does **not** schedule the entities. A public corporation is defined by
reference to the Act's interpretation and declaration provisions; the entity list is distributed
across enabling Acts and annual reports.

**Regulator/act.** South Australian Department of Treasury and Finance; the _Public Corporations Act
1993_; the _Public Finance and Audit Act 1987_; portfolio ministers. ESCOSA regulates water and
energy prices for regulated activities. The DTF "Acts and legislation" page lists the _Public
Corporations Act 1993_ among the legislation it administers:
<https://www.treasury.sa.gov.au/about/acts-and-legislation> (fetched 2026-11-17).

**Official entity list and source URL.** **No single consolidated public list was found on
treasury.sa.gov.au on 2026-11-17.** The official legal sources are:

- _Public Corporations Act 1993_ (SA), current authorised version:
  <https://www.legislation.sa.gov.au/_legislation-documents/lz/c/a/public-corporations-act-1993/current/1993.36.auth.pdf>
  (listed in the SA Legislation search results; the Act's text does not schedule the corporations).
- The SA Legislation search page for the Act:
  <https://www.legislation.sa.gov.au/search?query=Public%20Corporations%20Act%201993> (fetched
  2026-11-17), which also returns enabling Acts.
- Verified examples of public corporations from their enabling Acts:
  - **South Australian Water Corporation (SA Water)** — _South Australian Water Corporation Act
    1994_ (SA). The Act states the Corporation is a statutory corporation to which the Public
    Corporations Act 1993 applies.
  - **Urban Renewal Authority (Renewal SA)** — _Urban Renewal Act 1995_ (SA). The Act establishes the
    Urban Renewal Authority and applies provisions of the Public Corporations Act 1993.
  - **TAFE SA** — _TAFE SA Act 2012_ (SA). The Act states TAFE SA is a statutory corporation to which
    the Public Corporations Act 1993 applies (other than section 35).

These are **examples, not a complete list**. Do not invent additional SA public corporations to fill
the gap. The owner must obtain or confirm the authoritative list (for example, from DTF or the
Treasurer's Annual Financial Report) before extraction.

**Latest annual report availability.** Public corporations publish annual reports, but there is no
single page that lists them all. The 2025-26 cycle is current in November 2026. This inventory did
not open each report or verify each URL; SA Water, Renewal SA and TAFE SA are the clearest examples
from the enabling Acts, not a claim that their current reports were opened.

**Financial statement/unit.** Audited general-purpose financial statements. Unit varies; read per
report. SA Water is a water utility; Renewal SA is an urban renewal/land entity; TAFE SA is an
education statutory corporation. Their statements are not comparable to each other.

**Entity-level extraction feasibility.** **Low-medium.** There is no consolidated official list, the
Act does not schedule the entities, and the entities are heterogeneous. SA Water is the most
feasible first entity; Renewal SA and TAFE SA are feasible but not comparable to SA Water. Do not
start a bulk SA extraction until the list is confirmed.

**Licence/terms.** SA Government website content is licensed CC BY 4.0 (per the site footer on
treasury.sa.gov.au and legislation.sa.gov.au), but annual reports may be Crown copyright or
entity-specific. Verify the licence on each report before redistribution. Archive metadata/hashes
and quote with attribution.

**Known gaps/ambiguities.**

- **No authoritative consolidated list.** This is the biggest blocker. The Act defines and controls
  public corporations but does not enumerate them.
- The entities are heterogeneous: water utility, urban renewal authority, education statutory
  corporation, and others. They are not a comparable "SOC" set.
- Some public corporations may be small, regulatory or financial in nature; some may be
  subsidiaries of other public corporations.
- The boundary between "public corporation", "statutory corporation" and "government business
  division" is not obvious from the Act alone and must be confirmed per entity.
- The SA Budget is PDF-only for current budget documents (see `STATE_SOURCES.md`), which makes
  automated discovery harder.

**Priority entities (proposed).**

1. SA Water — the clearest large water utility; start here after the list is confirmed.
2. Renewal SA — urban renewal/land; only if land development is in scope.
3. TAFE SA — education statutory corporation; only if the owner explicitly includes non-commercial
   public corporations.
4. Do not proceed to other SA entities until a human supplies or confirms the authoritative list.

### 7. Northern Territory — GOCs (no consolidated list)

**Legal/reporting class.** Government Owned Corporations under the _Government Owned Corporations
Act 2001_ (NT). The Act's definition is decisive:

> "**Government owned corporation** means a statutory corporation that is declared to be a
> Government owned corporation by its constituting Act."

That means the GOC Act does **not** contain a schedule of GOCs. Each GOC is declared by its own
constituting Act. Government business divisions (for example, Land Development Corporation and NT
Home Ownership in the NTTC loan table) are a different class and are not GOCs.

**Regulator/act.** NT Department of Treasury and Finance; the _Government Owned Corporations Act
2001_ (NT); the _Financial Management Act 1995_ (NT); the Utilities Commission for regulated
utilities; shareholding and portfolio ministers.

**Official entity list and source URL.** **No single consolidated GOC list was found.** The official
sources are:

- _Government Owned Corporations Act 2001_ (NT),
  <https://legislation.nt.gov.au/en/Legislation/GOVERNMENT-OWNED-CORPORATIONS-ACT-2001> (fetched
  2026-11-17). The Act defines a GOC by reference to its constituting Act; it does not schedule the
  entities.
- NT Treasury, "Client services" (NTTC loan portfolio, 30 June 2024),
  <https://treasury.nt.gov.au/dtf/nttc/client-services> (fetched 2026-11-17). Under "Government owned
  corporations" it names **Power and Water Corporation** and **Territory Generation**. This is a
  loan-client table, not a complete GOC register.
- Jacana Energy, "Who we are",
  <https://www.jacanaenergy.com.au/about/who-we-are> (fetched 2026-11-17). The page says: "Jacana
  Energy is a government-owned corporation and the Northern Territory's largest electricity
  retailer." It also links the **Jacana Energy Annual Report 2025-26** PDF:
  <https://www.jacanaenergy.com.au/sites/default/files/2026-10/Jacana%20Energy%20Annual%20Report%202025-2026.pdf>.

That gives **three confirmed GOCs** — Power and Water Corporation, Territory Generation and Jacana
Energy — but **not** an authoritative complete list. Other GOCs may exist; do not invent them. The
owner must confirm the current list from the constituting Acts or Treasury.

**Latest annual report availability.** Jacana Energy's **2025-26** annual report PDF is verified
(published October 2026). Power and Water Corporation and Territory Generation publish annual
reports; their current URLs were not individually fetched in this pass. The 2025-26 cycle is
current.

**Financial statement/unit.** Audited general-purpose financial statements. Unit varies; read per
report. Power and Water is a combined water/electricity utility; Territory Generation is a
generation business; Jacana Energy is an electricity retailer. Their statements are not identical in
structure.

**Entity-level extraction feasibility.** **Low-medium.** Only three GOCs are confirmed, and there is
no authoritative consolidated list. Jacana Energy is the best first target because its 2025-26 annual
report is verified and its site is current. Power and Water and Territory Generation are feasible
once the constituting Acts and reports are confirmed. Do not include government business divisions.

**Licence/terms.** The NT Government website and legislation are © Northern Territory Government.
Each annual report is © the entity. No open-data licence was found for the reports. Archive
metadata/hashes and quote with attribution.

**Known gaps/ambiguities.**

- **No consolidated GOC list.** The GOC Act declares GOCs by constituting Act, not by schedule. This
  is a structural gap, not a missing search result.
- The NTTC table is a loan-client list, not a GOC register. It names only two GOCs (Power and Water,
  Territory Generation) and does not mention Jacana Energy, which self-identifies as a GOC.
- Government business divisions (Land Development Corporation, NT Home Ownership) are not GOCs and
  must not be added to a GOC total.
- Some GOCs may have subsidiaries or joint ventures; use consolidated parent statements and do not
  add subsidiaries.
- Territory Generation and Jacana Energy were created through electricity restructures; confirm the
  current legal entity and constituting Act before extraction.

**Priority entities (proposed).**

1. Jacana Energy — verified 2025-26 annual report; electricity retailer.
2. Power and Water Corporation — water/electricity utility; confirm current report and constituting
   Act.
3. Territory Generation — electricity generation; confirm current report and constituting Act.
4. Do not include government business divisions. Do not add any other entity until its constituting
   Act is verified.

## QLD pilot — Energy Queensland Limited (implemented 2026-11-19)

The first read-only SOC pilot is **Energy Queensland Limited only**, a Queensland Government Owned
Corporation. It is not a QLD total; no other GOC, statutory body or state is added.

- **Source id / entity:** `qld-energy-queensland` / Energy Queensland.
- **Report:** Energy Queensland Limited Annual Report 2025-26, for the year ended 30 June 2026.
- **Discovery page:** <https://www.energyq.com.au/about-us/corporate-reports>. It returns HTTP 403
  with `cf-mitigated: challenge` to a plain curl fetch from the ingestion host. The official
  Queensland Parliament tabled-paper copy is the documented fallback:
  <https://www.parliament.qld.gov.au/Work-of-the-Assembly/Tabled-Papers/docs/5826T1808/5826t1808.pdf>
  (HTTP 200, `application/pdf`, 2,150,680 bytes, 128 pages).
- **Archive:** exact PDF archived outside the repo; SHA-256
  `f0a0286eb6edc7f6473daf071bed880dcfea72150e0ad203410066df0fc50721`.
- **Unit:** `$m` — the consolidated statement prints **"In millions of dollars"**. No OCR and no
  unit guess.
- **Rows:** five entity-level SOC statement lines from the consolidated statement of profit or loss:
  total revenue **6,698**; total expenses **6,800**; employee expenses **1,354**;
  depreciation, amortisation and impairments **1,325**; net result **a loss of 67** (`$m`).
- **Reconciliation (zero tolerance):** the nine printed expense lines sum to **6,800**, which equals
  the Directors' report printed total expenses; `6,698 − 6,800 = (102)` equals the printed loss
  before income tax equivalent benefit; `(102) + 35 = (67)` equals the printed loss after income tax
  equivalent benefit. The statement has no printed Total expenses subtotal, so the derived total is
  accepted only because both the Directors' report total and the profit bridges agree.
- **Implementation:** `server/src/connectors/soc/qld/energy-queensland.ts`, registered in the SOC
  source list, `/api/soc` and the SOC page. Tests:
  `server/test/qld-energy-queensland.test.ts`.
- **Caveat:** entity-level only. Never add Energy Queensland to government program spending, the
  PNFC sector benchmark, another QLD GOC, a QLD total, a national total, or another SOC line. The
  consolidated parent is the reporting boundary; subsidiaries are not added separately. Rows are
  provisional and unverified.

## QLD pilot — CS Energy Limited (implemented 2026-11-19)

The second QLD pilot is **CS Energy Limited only**, a Queensland Government Owned Corporation. It
is separate from Energy Queensland; neither is added to the other and no QLD total is created.

- **Source id / entity:** `qld-cs-energy` / CS Energy.
- **Report:** CS Energy Annual Report 2026, for the year ended 30 June 2026 (FY2025-26).
- **Discovery page:** <https://www.csenergy.com.au/who-we-are/reports-and-publications/annual-reports>
  (HTTP 200). The latest linked PDF is
  <https://www.csenergy.com.au/ArticleDocuments/276/CS%20ENERGY%20ANNUAL%20REPORT%202026.pdf.aspx>
  (HTTP 200, `application/pdf`, 2,712,680 bytes, 124 pages).
- **Archive:** exact PDF archived outside the repo at
  `~/ausspend-source-archive/qld-cs-energy/` with `SHA256SUMS` and `retrieval.json`; SHA-256
  `6fbf258f057820989a9e72096181c06c82b7d7c94c4102015b61d387c0bd12c3`.
- **Unit:** `$'000` — the consolidated statement prints `$'000` and the Basis of Preparation rounds
  to the nearest thousand dollars.
- **Rows:** five entity-level SOC statement lines:
  total revenue **2,113,619** (derived: Revenue 1,856,656 + Interest income 20,866 + Other income
  236,097); total expenses **2,124,195** (derived: all printed expense lines plus Loss on disposed
  assets); employee benefit expense **218,087**; depreciation and amortisation **120,268**; net
  result **a loss of 27,427** (`$'000`).
- **Reconciliation (zero tolerance):** total revenue − total expenses = **(10,576)**, the printed
  Loss before income tax expense; `(10,576) + (16,851) = (27,427)`, the printed Loss after income tax
  expense for the year. The statement has no printed Total revenue or Total expenses subtotal, so
  both totals are derived and accepted only because the printed bridges agree.
- **Implementation:** `server/src/connectors/soc/qld/cs-energy.ts`, registered in the SOC source
  list, `/api/soc`, the SOC page and the ingestion runner. Tests:
  `server/test/qld-cs-energy.test.ts`.
- **Caveat:** entity-level only. Never add CS Energy to government program spending, the PNFC
  benchmark, Energy Queensland, another QLD GOC, a QLD total, a national total, or another SOC line.
  Consolidated parent only; subsidiaries are not added separately. Rows are provisional and
  unverified.

## QLD pilot — Stanwell Corporation Limited (implemented 2026-11-19)

The third QLD pilot is **Stanwell Corporation Limited only**, a Queensland Government Owned
Corporation under the GOC Act 1993 (Qld). It is separate from Energy Queensland and CS Energy;
none is added to another and no QLD total is created.

- **Source id / entity:** `qld-stanwell` / Stanwell Corporation.
- **Report:** Stanwell Corporation Annual Report 2025-26, for the year ended 30 June 2026
  (FY2025-26).
- **Discovery page:** the canonical <https://www.stanwell.com/about-us/publications> page now
  returns **HTTP 404**. Discovery falls back to the live official pages that carry the same annual
  report link: <https://www.stanwell.com/about-us> and
  <https://www.stanwell.com/information-publication-scheme> (both HTTP 200). The latest linked PDF
  is
  <https://assets.ctfassets.net/g6959sqmk0wu/6tf7j1YqIxYVp19TAh4H5n/34c80c2ffcf28585b9786885a3cdb6d3/Stanwell-Corporation--Annual-Report-2025-26.pdf>
  (HTTP 200, `application/pdf`, 7,405,029 bytes, 146 pages).
- **Archive:** exact PDF archived outside the repo at
  `~/ausspend-source-archive/qld-stanwell/` with `SHA256SUMS` and `retrieval.json`; SHA-256
  `02b079d10fa451f19144dffd9caa9786d8d7ebc60347c97be5866ffefdf47db6`.
- **Unit:** `$’000` — the consolidated statement prints `$’000` for both the 2026 and 2025 columns.
- **Rows:** five entity-level SOC statement lines:
  total revenue **3,242,526** (derived: Revenue and other income 3,173,199 + Finance income 69,327);
  total expenses **3,845,281** (derived: all printed expense lines net of the printed Expected
  credit loss reversal 117,155 and the nil Impairment reversal); employee benefits expense
  **228,716**; depreciation and amortisation expense **270,134**; net result **a loss of 414,664**
  (`$’000`).
- **Reconciliation (zero tolerance):** total revenue − total expenses = **(602,755)**, the printed
  Profit/(loss) before income tax equivalent; `(602,755) + 188,091 = (414,664)`, the printed
  Profit/(loss) after income tax equivalent for the year. The statement has no printed Total revenue
  or Total expenses subtotal, so both totals are derived and accepted only because the printed
  bridges agree.
- **Implementation:** `server/src/connectors/soc/qld/stanwell.ts`, registered in the SOC source
  list, `/api/soc`, the SOC page and the ingestion runner. Tests:
  `server/test/qld-stanwell.test.ts`.
- **Caveat:** entity-level only. Never add Stanwell to government program spending, the PNFC
  benchmark, Energy Queensland, CS Energy, another QLD GOC, a QLD total, a national total, or
  another SOC line. Consolidated parent only; subsidiaries are not added separately. Rows are
  provisional and unverified.

## QLD pilot — Powerlink Queensland (implemented 2026-11-19)

The fourth QLD pilot is **Powerlink Queensland only** — Queensland Electricity Transmission
Corporation Limited, a Queensland Government Owned Corporation under the GOC Act 1993 (Qld), not a
statutory body. It is separate from Energy Queensland, CS Energy and Stanwell; none is added to
another and no QLD total is created.

- **Source id / entity:** `qld-powerlink` / Powerlink Queensland.
- **Report:** Powerlink Queensland Annual Report, Sustainability Report and Financial Statements
  2025-26, for the year ended 30 June 2026 (FY2025-26).
- **Discovery page:** the official reports page <https://www.powerlink.com.au/reports> lists the
  annual-report landing pages. Discovery follows the newest landing page
  (<https://www.powerlink.com.au/annual-report/annual-report-202526>) and reads its PDF link; no PDF
  URL is hard-coded. The exact PDF is
  <https://www.powerlink.com.au/sites/default/files/2026-10/Powerlink%20Queensland%20-%20Annual%20Report%20Sustainability%20Report%20and%20Financial%20Statements%202025-26.pdf>
  (HTTP 200, `application/pdf`, 5,355,423 bytes, 136 PDF pages).
- **Archive:** exact PDF archived outside the repo at `~/ausspend-source-archive/qld-powerlink/`
  with `SHA256SUMS` and `retrieval.json`; SHA-256
  `a4063d58b7c23169df1db3b9d38fb79aaa9e384a206ee7698df5b439d1c96e61`.
- **Unit:** `$'000` — both the face statement (PDF page 74, printed page 73) and Note 3 (PDF page
  85, printed page 84) print `$'000` for the 2026 and 2025 columns.
- **Rows:** five entity-level SOC statement lines:
  total revenue **1,227,832** (derived: Revenue 1,202,830 + Other gains/(losses) (997) + Finance
  income 25,999); total expenses **1,411,833** (derived: Expenses from continuing operations
  966,901 + Impairment losses 133,191 + Finance costs 311,741); employee benefit expense
  **264,426** (Note 3 memo included within total expenses); depreciation and amortisation
  **455,382** (Note 3 component); net result **a loss of 128,878** (`$'000`).
- **Reconciliation (zero tolerance):** Note 3's five components
  (52,640 + 212,218 + 185,427 + 61,234 + 455,382) = **966,901**, the printed TOTAL EXPENSES FROM
  CONTINUING OPERATIONS and the face statement's Expenses from continuing operations. Profit from
  continuing operations: 1,202,830 + (997) − 966,901 − 133,191 = **101,741** (printed). Net finance
  costs: 25,999 + (311,741) = **(285,742)** (printed). Profit before tax: 101,741 + (285,742) =
  **(184,001)** (printed). Total revenue − total expenses = 1,227,832 − 1,411,833 = **(184,001)**.
  Net result: (184,001) + 55,123 = **(128,878)** (printed).
- **Implementation:** `server/src/connectors/soc/qld/powerlink.ts`, registered in the SOC source
  list, `/api/soc`, the SOC page and the ingestion runner. Tests:
  `server/test/qld-powerlink.test.ts`.
- **Caveat:** entity-level only. Never add Powerlink Queensland to government program spending, the
  PNFC benchmark, Energy Queensland, CS Energy, Stanwell, another QLD GOC, a QLD total, a national
  total, or another SOC line. Consolidated parent only; subsidiaries are not added separately. Rows
  are provisional and unverified.

## QLD pilot — Sunwater Limited (implemented 2026-11-19)

The fifth QLD pilot is **Sunwater Limited only** — a Queensland Government Owned Corporation (GOC),
not a statutory body. It is separate from Energy Queensland, CS Energy, Stanwell and Powerlink
Queensland; none is added to another and no QLD total is created.

- **Source id / entity:** `qld-sunwater` / Sunwater Limited.
- **Report:** Sunwater Annual Report 2025-26, for the year ended 30 June 2026 (FY2025-26).
- **Discovery page:** the official publications page <https://www.sunwater.com.au/about/publications>
  lists the annual-report PDFs. Discovery reads the newest annual-report link; no PDF URL is
  hard-coded. The exact PDF is
  <https://www.sunwater.com.au/wp-content/uploads/Home/About/Publications/Sunwater_2025-26_Annual_Report.pdf>
  (HTTP 200, `application/pdf`, 3,667,807 bytes, 141 PDF pages).
- **Archive:** exact PDF archived outside the repo at `~/ausspend-source-archive/qld-sunwater/`
  with `SHA256SUMS` and `retrieval.json`; SHA-256
  `09ab5654a76e33437b63011a5e3b53762f96d6936696f0946fb3eb46da67145e`.
- **Unit:** `$’000` — the face statement (PDF page 53, printed page 50) and Note 3B (PDF page 63,
  printed page 60) both print `$’000` for the 2026 and 2025 columns.
- **Rows:** five entity-level SOC statement lines:
  total revenue **417,834** (printed Total revenue and other income = Revenue from contracts with
  customers 397,160 + Other income 20,674); total expenses **466,953** (derived: Operating
  expenditure 152,458 + Employee benefits 94,136 + Depreciation and amortisation 48,176 + Impairment
  of assets 172,098 + Loss on disposal of assets 85); employee benefits **94,136** (face line,
  reconciled to Note 3B Total employee benefits); depreciation and amortisation **48,176** (face
  line, Notes 10–12); net result **a loss of 67,916** (`$’000`).
- **Reconciliation (zero tolerance):** 417,834 − 466,953 = **(49,119)**, the printed Operating
  profit; (49,119) + (18,797) = **(67,916)**, the printed Profit before income tax; (67,916) + 0 =
  **(67,916)**, the printed Profit for the year. Note 3B's printed Total employee benefits 94,136
  equals the face Employee benefits line. The statement prints no Total expenses subtotal, so both
  expense and result bridges are required before any row is emitted.
- **Implementation:** `server/src/connectors/soc/qld/sunwater.ts`, registered in the SOC source
  list, `/api/soc`, the SOC page and the ingestion runner. Tests:
  `server/test/qld-sunwater.test.ts`.
- **Caveat:** entity-level only. Never add Sunwater Limited to government program spending, the
  PNFC benchmark, Energy Queensland, CS Energy, Stanwell, Powerlink Queensland, another QLD GOC, a
  QLD total, a national total, or another SOC line. Consolidated parent only; subsidiaries are not
  added separately. Rows are provisional and unverified.

## QLD pilot — Gladstone Ports Corporation Limited (implemented 2026-11-19)

The sixth QLD pilot is **Gladstone Ports Corporation Limited only** — a Queensland Government Owned
Corporation (GOC), not a statutory body. It is separate from Energy Queensland, CS Energy, Stanwell,
Powerlink Queensland and Sunwater Limited; none is added to another and no QLD total is created.

- **Source id / entity:** `qld-gladstone-ports` / Gladstone Ports Corporation Limited.
- **Report:** Gladstone Ports Corporation Limited Annual Report 2025-26, for the year ended 30 June
  2026 (FY2025-26).
- **Discovery page:** the official reports page
  <https://gpcl.com.au/who-we-are/corporate-governance/reports/> lists the annual-report PDFs.
  Discovery reads the newest annual-report link; no PDF URL is hard-coded. The exact PDF is
  <https://gpcl.com.au/wp-content/uploads/2026/09/Gladstone-Ports-Corporation-Annual-Report-2025-26.pdf>
  (HTTP 200, `application/pdf`, 29,631,105 bytes, 131 PDF pages).
- **Archive:** exact PDF archived outside the repo at `~/ausspend-source-archive/qld-gladstone-ports/`
  with `SHA256SUMS` and `retrieval.json`; SHA-256
  `ff36d4681acbda7e472be06ac79b1d5f3f39409f4ce570e1049b00b19569ce87`.
- **Unit:** `$’000` — the face statement (PDF page 56, printed page 13) and Note 6(d) (PDF page 66,
  printed page 23) both print `$’000` for the 2026 and 2025 columns.
- **Rows:** five entity-level SOC statement lines:
  total revenue **674,168** (printed Total revenue and other income = Revenue from contracts with
  customers 605,164 + Other income 69,004); total expenses **481,152** (derived: Employee benefits
  expenses 178,914 + Operational expenses 158,697 + Depreciation/amortisation expenses 107,741 +
  Finance costs 34,563 + Impairment 326 + Net loss on disposal of non-current assets 911); employee
  benefits **178,914** (face line, reconciled to Note 6(d) Total); depreciation and amortisation
  **107,741** (face line); net result **a profit of 143,025** (`$’000`).
- **Reconciliation (zero tolerance):** 674,168 − 481,152 + 216 (Reversal of prior impairment) +
  2,791 (Fair value revaluation of PP&E) + 8,291 (Revaluation of investment properties) = **204,314**,
  the printed Profit before income tax; 204,314 + (61,289) = **143,025**, the printed Profit for the
  year. Note 6(d)'s printed Total employee benefits 178,914 equals the face Employee benefits
  expenses line. The statement prints no Total expenses subtotal, so the derived total is accepted
  only when both printed result bridges agree.
- **Implementation:** `server/src/connectors/soc/qld/gladstone-ports.ts`, registered in the SOC
  source list, `/api/soc`, the SOC page and the ingestion runner. Tests:
  `server/test/qld-gladstone-ports.test.ts`.
- **Caveat:** entity-level only. Never add Gladstone Ports Corporation Limited to government program
  spending, the PNFC benchmark, Energy Queensland, CS Energy, Stanwell, Powerlink Queensland,
  Sunwater Limited, another QLD GOC, a QLD total, a national total, or another SOC line. Consolidated
  parent only; the 100%-owned Gladstone Marine Pilot Services Pty Ltd is consolidated, not added as
  a separate row. Rows are provisional and unverified.

## QLD pilot — Port of Townsville Limited (deferred 2026-11-19)

The seventh QLD entity attempted is **Port of Townsville Limited only** — a Queensland Government
Owned Corporation (GOC), not a statutory body. It is separate from Energy Queensland, CS Energy,
Stanwell, Powerlink Queensland, Sunwater Limited and Gladstone Ports Corporation Limited; none is
added to another and no QLD total is created.

- **Source id / entity:** `qld-port-of-townsville` / Port of Townsville Limited.
- **Report:** Port of Townsville Limited Annual Report 2025-26, for the year ended 30 June 2026
  (FY2025-26).
- **Discovery page:** the official annual-reports page
  <https://www.townsville-port.com.au/media-publications/publications/annual-reports/> lists the
  annual-report PDFs (absolute and protocol-relative S3 links). Discovery reads the newest
  annual-report link; no PDF URL is hard-coded.
- **Archive:** exact PDF archived outside the repo at
  `~/ausspend-source-archive/qld-port-of-townsville/` with `SHA256SUMS` and `retrieval.json`;
  SHA-256 `5f15e1ed55235a2e796da8f8dfc32002bf3e39a4f41973c93f9b372bb455b839` (3,372,376 bytes,
  84 pages).
- **Unit:** `$` — the face statement (PDF page 48) prints whole dollars for both columns, not
  `$’000`.
- **Premise falsified — no rows.** The printed subtotals and bridges are not internally consistent
  at zero tolerance:
  revenue components 99,855,300 + 838,874 + 2,151,403 + 5,218,195 = **108,063,772** against a
  printed Total Revenue of **108,063,771**; expense components 31,851,679 + 30,623,273 +
  15,172,521 + 4,147,923 + 3,679,258 = **85,474,654** against a printed Total Expenses of
  **85,474,655**; and 22,589,116 + (6,792,073) = **15,797,043** against a printed Operating Result
  for the year of **15,797,044**. The adapter therefore defers the document with phase
  `reconciliation` and emits **0 rows**. Nothing was rounded or fabricated.
- **Implementation:** `server/src/connectors/soc/qld/port-of-townsville.ts`, registered in the SOC
  source list, `/api/soc`, the SOC page and the ingestion runner. Tests:
  `server/test/qld-port-of-townsville.test.ts` (real-shaped deferral plus a reconciled fixture that
  proves the row path). The ingestion runner records a deferred document and no measures.
- **Caveat:** entity-level only. Never add Port of Townsville Limited to government program
  spending, the PNFC benchmark, Energy Queensland, CS Energy, Stanwell, Powerlink Queensland,
  Sunwater Limited, Gladstone Ports Corporation Limited, another QLD GOC, a QLD total, a national
  total, or another SOC line.

## QLD pilot — Ports North (implemented 2026-11-19)

The seventh implemented QLD pilot is **Ports North only** — Far North Queensland Ports Corporation
Limited, a Queensland Government Owned Corporation (GOC), not a statutory body. It is separate from
Energy Queensland, CS Energy, Stanwell, Powerlink Queensland, Sunwater Limited, Gladstone Ports
Corporation Limited and Port of Townsville Limited; none is added to another and no QLD total is
created.

- **Source id / entity:** `qld-ports-north` / Ports North.
- **Report:** Ports North Annual Report 2025-26, for the year ended 30 June 2026 (FY2025-26).
- **Discovery page:** the official annual-reports page
  <https://www.portsnorth.com.au/news-publications/annual-reports/> lists the annual-report PDFs as
  protocol-relative S3 links. Discovery reads the newest annual-report link; no PDF URL is
  hard-coded. Filenames use full spans, `fy` prefixes or a single year-ended year; all are handled.
  The exact PDF is
  <https://os-data-2.s3-ap-southeast-2.amazonaws.com/portsnorth-com-au/bundle1/port_north_annual_report_2026_final.pdf>
  (HTTP 200, `application/pdf`, 2,456,133 bytes, 68 PDF pages).
- **Archive:** exact PDF archived outside the repo at `~/ausspend-source-archive/qld-ports-north/`
  with `SHA256SUMS` and `retrieval.json`; SHA-256
  `d61326bf72795da8ea16582715638ab5ed38b0f32dfaf405e39763d48c0d3b94`.
- **Unit:** `$’000` — the Statement of Comprehensive Income (PDF page 30, printed page 30) prints
  `$’000` for the 2026 and 2025 columns.
- **Rows:** five entity-level SOC statement lines:
  total revenue **96,667** (printed Total Income = User charges 76,925 + Interest revenue 2,068 +
  Other revenue nil + Gain on sale 21 + Increase in Fair Value of Investment property 17,653);
  total expenses **83,441** (printed Total Expenses = Supplies and services 42,629 + Employee
  expenses 19,442 + Finance Costs 52 + Depreciation 7,507 + Write off of work in progress 37 +
  Revaluation decrement 13,774); employee expenses **19,442**; depreciation **7,507**; net result
  **a profit of 9,142** (`$’000`).
- **Reconciliation (zero tolerance):** 96,667 − 83,441 = **13,226** (printed Operating Result before
  income tax); 13,226 − 4,084 = **9,142** (printed Operating Result for the year). OCI:
  (11,638) + 3,549 = **(8,089)** (printed); total comprehensive income: 9,142 + (8,089) = **1,053**
  (printed). Every printed subtotal and bridge agrees exactly.
- **Implementation:** `server/src/connectors/soc/qld/ports-north.ts`, registered in the SOC source
  list, `/api/soc`, the SOC page and the ingestion runner. Tests:
  `server/test/qld-ports-north.test.ts`.
- **Caveat:** entity-level only. Never add Ports North to government program spending, the PNFC
  benchmark, Energy Queensland, CS Energy, Stanwell, Powerlink Queensland, Sunwater Limited,
  Gladstone Ports Corporation Limited, Port of Townsville Limited, another QLD GOC, a QLD total, a
  national total, or another SOC line. Consolidated parent only; subsidiaries are not added
  separately. Rows are provisional and unverified.

## QLD pilot — North Queensland Bulk Ports (implemented 2026-11-19)

The eighth implemented QLD pilot is **North Queensland Bulk Ports Corporation Limited (NQBP) only** —
a Queensland Government Owned Corporation (GOC), not a statutory body. It is separate from Energy
Queensland, CS Energy, Stanwell, Powerlink Queensland, Sunwater Limited, Gladstone Ports Corporation
Limited, Port of Townsville Limited and Ports North; none is added to another and no QLD total is
created.

- **Source id / entity:** `qld-nqbp` / North Queensland Bulk Ports Corporation Limited (NQBP).
- **Report:** NQBP Annual Report 2025-26, for the year ended 30 June 2026 (FY2025-26).
- **Discovery / fallback:** the official publications page
  <https://nqbp.com.au/about-us/publications> returns **HTTP 403** to the ingestion host
  (Cloudflare/bot challenge). The connector tries it first and then uses the documented official
  Queensland Parliament tabled-paper copy of the same report,
  <https://www.parliament.qld.gov.au/Work-of-the-Assembly/Tabled-Papers/docs/5826T1741/5826t1741.pdf>
  (HTTP 200, `application/pdf`, 5,530,354 bytes, 96 PDF pages). The fallback pin is documented and
  must be updated when a newer report is tabled.
- **Archive:** exact PDF archived outside the repo at `~/ausspend-source-archive/qld-nqbp/` with
  `SHA256SUMS` and `retrieval.json` (including the 403 official-page status and fallback URL);
  SHA-256 `a52868953f69c6c512f66d4ae8fe68d41d4853df6e29159e4d7803465a8d3ebe`.
- **Unit:** `$’000` — the Consolidated Statement of Comprehensive Income (PDF page 53, printed page
  53) prints `$’000` for the Consolidated 2026/2025 and Parent 2026/2025 columns.
- **Rows:** five entity-level SOC statement lines, from the **Consolidated 2026** column only:
  total revenue **153,109** (printed Income from operations = Revenue from contracts with customers
  109,092 + Other income 44,017); total expenses **96,172** (printed Expenses from operations =
  Employee benefits expenses 32,271 + Supplies and services 43,469 + Depreciation and amortisation
  14,312 + Impairment losses/fair value adjustments 275 + Other expenses 5,845); employee expenses
  **32,271**; depreciation and amortisation **14,312**; net result **a profit of 37,676** (`$’000`).
- **Reconciliation (zero tolerance):** 153,109 − 96,172 = **56,937** (printed Operating result);
  net finance costs 4,103 − 8,340 − 218 = **(4,455)**; 56,937 − 4,455 = **52,482** (printed
  Profit/(Loss) before income tax); 52,482 − 14,806 = **37,676** (printed Profit/(Loss) after income
  tax); OCI 46,640 − 13,334 = **33,306** (printed); total comprehensive income 37,676 + 33,306 =
  **70,982** (printed). The Parent column and subsidiaries are never added.
- **Implementation:** `server/src/connectors/soc/qld/nqbp.ts`, registered in the SOC source list,
  `/api/soc`, the SOC page and the ingestion runner. Tests: `server/test/qld-nqbp.test.ts`.
- **Caveat:** entity-level only. Never add NQBP to government program spending, the PNFC benchmark,
  Energy Queensland, CS Energy, Stanwell, Powerlink Queensland, Sunwater Limited, Gladstone Ports
  Corporation Limited, Port of Townsville Limited, Ports North, another QLD GOC, a QLD total, a
  national total, or another SOC line. Rows are provisional and unverified.

## WA pilot — Water Corporation (implemented 2026-11-19)

The first WA Government Trading Enterprise pilot is **Water Corporation only** — a WA GTE under the
Government Trading Enterprises Act 2023 (WA), not a QLD GOC or an NSW SOC. It is separate from every
QLD/NSW SOC and from every other WA GTE; no WA total is created.

- **Source id / entity:** `wa-water-corporation` / Water Corporation.
- **Report:** Water Corporation Annual Report 2025-26, for the year ended 30 June 2026 (FY2025-26).
- **Discovery page:** the official annual report page
  <https://www.watercorporation.com.au/about-us/our-performance/annual-report> lists the annual
  reports. Discovery reads the newest annual-report link; no PDF URL is hard-coded. The exact PDF is
  the 2026 annual report on the Water Corporation CDN
  (HTTP 200, `application/pdf`, 19,632,537 bytes, 70 PDF pages).
- **Archive:** exact PDF archived outside the repo at
  `~/ausspend-source-archive/wa-water-corporation/` with `SHA256SUMS` and `retrieval.json`; SHA-256
  `7e928be840af3096496f7bb38fc83fc15d9ef7b95836bb1e9565637538a69a9b`.
- **Unit:** `$M` — the Statement of Comprehensive Income (PDF page 46, printed page 90) prints `$M`
  for the Group 2026/2025 and Corporation 2026/2025 columns.
- **Rows:** five entity-level SOC statement lines, from the **Group 2026** column only:
  total revenue **3,964** (printed Total revenue = Annual service charges 1,654 + Volume charges
  1,012 + Operating subsidies 668 + Developers’ contributions 419 + Other revenue 211); total
  expenses **2,144** (printed Total expenses = Depreciation and amortisation 590 + Employee benefits
  expense 533 + Hired and contracted services 340 + Energy expenses 195 + Other expenses 486);
  employee expenses **533**; depreciation and amortisation **590**; net result **a profit of 1,158**
  (`$M`).
- **Reconciliation (zero tolerance):** 3,964 − 2,144 = **1,820** (printed Results from operating
  activities); 1,820 − 128 = **1,692** (printed Profit before income tax equivalent); 1,692 − 534 =
  **1,158** (printed Profit for the year); other comprehensive income **1**; total comprehensive
  income 1,158 + 1 = **1,159** (printed). The Corporation column and the consolidated subsidiary are
  never added.
- **Implementation:** `server/src/connectors/soc/wa/water-corporation.ts`, registered in the SOC
  source list, `/api/soc`, the SOC page and the ingestion runner. Tests:
  `server/test/wa-water-corporation.test.ts`.
- **Caveat:** entity-level only. Never add Water Corporation to government program spending, the
  PNFC benchmark, another WA GTE, a QLD/NSW SOC, a WA total, a national total, or another SOC line.
  Rows are provisional and unverified.

## WA pilot — Synergy (implemented 2026-11-19)

The second WA Government Trading Enterprise pilot is **Synergy only** — a WA GTE (a corporation under
the Electricity Corporations Act 2005 (WA)), not a QLD GOC or an NSW SOC. It is separate from Water
Corporation and every other WA GTE and QLD/NSW SOC; no WA total is created.

- **Source id / entity:** `wa-synergy` / Synergy.
- **Report:** Synergy Annual Report 2025-26, for the year ended 30 June 2026 (FY2025-26).
- **Discovery page:** the official annual-reports page
  <https://www.synergy.net.au/About-us/News-and-announcements/Annual-reports> lists annual-report
  landing pages. Discovery follows the newest landing page
  (`/Annual-reports/Synergy-2026-annual-report`) and reads its PDF link; no PDF URL is hard-coded.
  The exact PDF is <https://www.synergy.net.au/-/media/Documents/Reports/Synergy-Annual-Report-2026.pdf>
  (HTTP 200, `application/pdf`, 12,603,580 bytes, 87 PDF pages).
- **Archive:** exact PDF archived outside the repo at `~/ausspend-source-archive/wa-synergy/` with
  `SHA256SUMS` and `retrieval.json`; SHA-256
  `af9dede0f0ea729775df5a2acbf70e5cf67d7e780bc2850691586a0711e00707`.
- **Unit:** `$'000` — the Statement of profit or loss (PDF page 55, printed page 108) prints `$'000`
  for the Group 2026/2025 and Corporation 2026/2025 columns.
- **Rows:** five entity-level SOC statement lines, from the **Group 2026** column only:
  total revenue **3,908,157** (printed Total revenue = Sales revenue 3,523,507 + Other revenue
  384,650); total expenses **4,201,674** (printed Total expenses = Fuel, networks and other direct
  costs 3,362,040 + Materials and services 111,891 + Employee expenses 220,605 + Other expenses
  257,100 + Depreciation and amortisation 165,236 + Other impairment expenses 84,802); employee
  expenses **220,605**; depreciation and amortisation **165,236**; net result **a loss of 382,597**
  (`$'000`).
- **Reconciliation (zero tolerance):** 3,908,157 − 4,201,674 + 12,211 (Other operating income) −
  101,533 (Net finance costs) + 0 (share of joint ventures) + 408 (share of associates) = **(382,431)**
  (printed Loss before tax); (382,431) − 166 = **(382,597)** (printed Loss for the year). The
  Corporation column and subsidiaries are never added.
- **Implementation:** `server/src/connectors/soc/wa/synergy.ts`, registered in the SOC source list,
  `/api/soc`, the SOC page and the ingestion runner. Tests: `server/test/wa-synergy.test.ts`.
- **Caveat:** entity-level only. Never add Synergy to government program spending, the PNFC
  benchmark, Water Corporation, another WA GTE, a QLD/NSW SOC, a WA total, a national total, or
  another SOC line. Rows are provisional and unverified.

## WA pilot — Western Power (implemented 2026-11-19)

The third WA Government Trading Enterprise pilot is **Western Power only** — Electricity Networks
Corporation trading as Western Power, a WA GTE under the Electricity Corporations Act 2005 (WA), not
a QLD GOC or an NSW SOC. It is separate from Water Corporation, Synergy and every other WA GTE and
QLD/NSW SOC; no WA total is created.

- **Source id / entity:** `wa-western-power` / Western Power.
- **Report:** Western Power Annual Report 2025-26, for the year ended 30 June 2026 (FY2025-26).
- **Discovery page:** the official annual-report page
  <https://www.westernpower.com.au/about/reports-publications/annual-report/> embeds the report PDF
  URLs in page JSON (`"url":"/4a8589/…"`). Discovery reads both anchors and the embedded `url`
  fields; no PDF URL is hard-coded. The exact PDF is
  <https://www.westernpower.com.au/4a8589/siteassets/documents/reports/annual-report/2026-annual-report.pdf>
  (HTTP 200, `application/pdf`, 65,292,260 bytes, 132 PDF pages).
- **Archive:** exact PDF archived outside the repo at `~/ausspend-source-archive/wa-western-power/`
  with `SHA256SUMS` and `retrieval.json`; SHA-256
  `fbded32ee826244c0fc54f11cbca48d848e45089d28e47a078d879c1142fd11e`.
- **Unit:** `$M` — the Statement of comprehensive income (PDF page 76, printed page 76) prints `$M`
  for the 2025/26 and 2024/25 (restated) columns.
- **Rows:** five entity-level SOC statement lines, from the current **2025/26** column only:
  total revenue **2,560** (printed Total income = Revenue from rendering of services 2,548 + Other
  income 12); total expenses **1,539** (printed Total expense = Materials and services 361 +
  Employee related expenses 290 + Depreciation and amortisation expenses 592 + Other expenses 296);
  employee expenses **290**; depreciation and amortisation **592**; net result **a profit of 487**
  (`$M`).
- **Reconciliation (zero tolerance):** 2,560 − 1,539 − 338 (Net finance costs) = **683** (printed
  Profit before income tax equivalent expense); 683 − 196 = **487** (printed Profit for the reporting
  year). The prior-year column is never added.
- **Implementation:** `server/src/connectors/soc/wa/western-power.ts`, registered in the SOC source
  list, `/api/soc`, the SOC page and the ingestion runner. Tests:
  `server/test/wa-western-power.test.ts`.
- **Caveat:** entity-level only. Never add Western Power to government program spending, the PNFC
  benchmark, Water Corporation, Synergy, another WA GTE, a QLD/NSW SOC, a WA total, a national total,
  or another SOC line. Rows are provisional and unverified.

## WA pilot — Horizon Power (implemented 2026-11-19)

The fourth WA Government Trading Enterprise pilot is **Horizon Power only** — Regional Power
Corporation trading as Horizon Power, a WA GTE under the Government Trading Enterprises Act 2023
(WA), not a QLD GOC or an NSW SOC. It is separate from Water Corporation, Synergy, Western Power and
every other WA GTE and QLD/NSW SOC; no WA total is created.

- **Source id / entity:** `wa-horizon-power` / Horizon Power.
- **Report:** Horizon Power Annual Report 2025-26, for the year ended 30 June 2026 (FY2025-26).
- **Discovery / fallback:** Horizon Power's publications pages return **HTTP 403** to the ingestion
  host (Cloudflare/bot challenge). The connector tries the official page first and then uses the
  documented official FY2025-26 annual-report PDF on Horizon Power's own globalassets CDN,
  <https://www.horizonpower.com.au/globalassets/media/documents/annual-reports/20252026/horizon-power-annual-report-2026.pdf>
  (HTTP 200, `application/pdf`, 11,000,133 bytes, 160 PDF pages). The fallback pin is documented and
  must be updated when a newer report is published.
- **Archive:** exact PDF archived outside the repo at `~/ausspend-source-archive/wa-horizon-power/`
  with `SHA256SUMS` and `retrieval.json` (including the 403 page status);
  SHA-256 `7c24e07cc04e442803c9b88705382e57382d9837079c89cb7d430fb26faa6447`.
- **Unit:** `$’000` — the Statement of comprehensive income (PDF page 105, printed page 105) prints
  `$’000` for the 30 June 2026 and 30 June 2025 columns.
- **Rows:** five entity-level SOC statement lines, from the 30 June 2026 column only:
  total revenue **753,354** (printed Total income = Revenue 498,907 + Other income 254,447); total
  expenses **729,802** (derived: Electricity and fuel purchases 279,767 + Employee benefits expense
  105,578 + Materials and services 112,848 + Depreciation and amortisation expense 131,448 + Other
  expenses 43,169 + Finance costs 56,992 — the statement prints no Total expenses subtotal);
  employee expenses **105,578**; depreciation and amortisation **131,448**; net result **a profit of
  16,892** (`$’000`).
- **Reconciliation (zero tolerance):** 753,354 − 729,802 = **23,552** (printed Profit before income
  tax equivalent expense); 23,552 − 6,660 = **16,892** (printed Profit for the year). The prior-date
  column is never added.
- **Implementation:** `server/src/connectors/soc/wa/horizon-power.ts`, registered in the SOC source
  list, `/api/soc`, the SOC page and the ingestion runner. Tests:
  `server/test/wa-horizon-power.test.ts`.
- **Caveat:** entity-level only. Never add Horizon Power to government program spending, the PNFC
  benchmark, Water Corporation, Synergy, Western Power, another WA GTE, a QLD/NSW SOC, a WA total, a
  national total, or another SOC line. Rows are provisional and unverified.

## WA pilot — Fremantle Ports (implemented 2026-11-19)

The fifth WA Government Trading Enterprise pilot is **Fremantle Ports only** — the Fremantle Port
Authority, a WA GTE under the Government Trading Enterprises Act 2023 (WA) and the Port Authorities
Act 1999 (WA), not a QLD GOC or an NSW SOC. It is separate from Water Corporation, Synergy, Western
Power, Horizon Power and every other WA GTE and QLD/NSW SOC; no WA total is created.

- **Source id / entity:** `wa-fremantle-ports` / Fremantle Ports.
- **Report:** Fremantle Ports Annual Report 2025-26, for the year ended 30 June 2026 (FY2025-26).
- **Discovery page:** the official publications page
  <https://www.fremantleports.com.au/publications> lists the annual reports. Discovery reads the
  newest annual-report link (de-duplicating `?sfvrsn` variants and rejecting spreads versions); no
  PDF URL is hard-coded. The exact PDF is
  <https://www.fremantleports.com.au/docs/default-source/annual-reports/244491-frepor-annual-report-2026-web---interactive.pdf>
  (HTTP 200, `application/pdf`, 19,999,051 bytes, 83 PDF pages).
- **Archive:** exact PDF archived outside the repo at `~/ausspend-source-archive/wa-fremantle-ports/`
  with `SHA256SUMS` and `retrieval.json`; SHA-256
  `0ee59985460ad5d80adccd0c53ada8cc7d985f50f253f5855afa69a3bb942f04`.
- **Unit:** `$’000` — the Statement of Comprehensive Income (PDF page 40, printed pages 76–77) prints
  `$’000` for the 2026 and 2025 columns.
- **Rows:** five entity-level SOC statement lines, from the 2026 column only:
  total revenue **322,345** (derived: Revenue 315,544 + Interest income 6,801); total expenses
  **234,961** (derived: Employee benefits 70,538 + Service and maintenance 48,227 + Contracts and
  consultants 35,316 + Government charges 10,782 + Utilities 7,914 + Insurance 5,893 + Other
  expenses 21,431 + Depreciation and amortisation 26,868 + Finance costs 7,992); employee benefits
  **70,538**; depreciation and amortisation **26,868**; net result **a profit of 61,021** (`$’000`).
  The face statement prints neither a Total income nor a Total expenses subtotal.
- **Reconciliation (zero tolerance):** 322,345 − 234,961 = **87,384** (printed Profit before income
  tax); 87,384 − 26,363 = **61,021** (printed Profit after income tax for the year). The prior-year
  column is never added.
- **Implementation:** `server/src/connectors/soc/wa/fremantle-ports.ts`, registered in the SOC source
  list, `/api/soc`, the SOC page and the ingestion runner. Tests:
  `server/test/wa-fremantle-ports.test.ts`.
- **Caveat:** entity-level only. Never add Fremantle Ports to government program spending, the PNFC
  benchmark, Water Corporation, Synergy, Western Power, Horizon Power, another WA GTE, a QLD/NSW
  SOC, a WA total, a national total, or another SOC line. Rows are provisional and unverified.

## WA pilot — DevelopmentWA (implemented 2026-11-19)

The sixth WA Government Trading Enterprise pilot is **DevelopmentWA only** — the Western Australian
Land Authority (WALA), a WA GTE under the Government Trading Enterprises Act 2023 (WA), not a QLD GOC
or an NSW SOC. It is separate from Water Corporation, Synergy, Western Power, Horizon Power,
Fremantle Ports and every other WA GTE and QLD/NSW SOC; no WA total is created. The WALA statements
are used; the separate Metropolitan Redevelopment Authority (MRA) statements in the same report are
not added.

- **Source id / entity:** `wa-developmentwa` / DevelopmentWA.
- **Report:** DevelopmentWA Annual and Sustainability Report 2025-26, for the year ended 30 June 2026
  (FY2025-26).
- **Discovery page:** the official publications page
  <https://www.developmentwa.com.au/publications> lists the reports as edocman download links.
  Discovery reads the newest DevelopmentWA/WALA annual-report link (de-duplicating `viewdocument`
  variants and rejecting MRA/Landcorp, sustainability-only, strategic-plan and SCI links); no PDF URL
  is hard-coded. The exact PDF is
  <https://www.developmentwa.com.au/component/edocman/2257-2025-2026-annual-and-sustainability-report-developmentwa/download>
  (HTTP 200, `application/pdf`, 8,881,306 bytes, 174 PDF pages).
- **Archive:** exact PDF archived outside the repo at `~/ausspend-source-archive/wa-developmentwa/`
  with `SHA256SUMS` and `retrieval.json`; SHA-256
  `e01d0c8fc12a21a16a862d49993b49e779a10489b27308b8271896c0e0691ca7`.
- **Unit:** `$’000` — the WALA Statement of profit or loss and other comprehensive income (PDF page
  95, printed page 95) and Note 2(b) (PDF page 103) print `$’000` for the 2026 and 2025 columns.
- **Rows:** five entity-level SOC statement lines, from the 2026 column only:
  total revenue **1,128,416** (derived: Operating revenue 1,103,122 + Other revenue 19,258 + Finance
  income 6,036); total expenses **939,518** (derived: Operating expenses 770,535 + Estate holding
  expenses 55,492 + Employee benefits expense 42,999 + Consultant expenses 5,130 + Advertising/PR/
  sponsorship 8,019 + Other expenses 56,244 + Finance costs 1,099); employee benefits **42,999**;
  depreciation and amortisation **19,049** (the Note 2(b) component within Other expenses); net
  result **a profit of 132,282** (`$’000`). The face statement prints neither a Total revenue nor a
  Total expenses subtotal.
- **Reconciliation (zero tolerance):** 1,128,416 − 939,518 + 71 (Impairment reversal) = **188,969**
  (printed Profit before income tax); 188,969 − 56,687 = **132,282** (printed Profit for the year);
  Note 2(b) Total other expenses 56,244 equals the face Other expenses line and its depreciation
  component 19,049 is within it. The prior-year column is never added.
- **Implementation:** `server/src/connectors/soc/wa/developmentwa.ts`, registered in the SOC source
  list, `/api/soc`, the SOC page and the ingestion runner. Tests:
  `server/test/wa-developmentwa.test.ts`.
- **Caveat:** entity-level only. Never add DevelopmentWA to government program spending, the PNFC
  benchmark, Water Corporation, Synergy, Western Power, Horizon Power, Fremantle Ports, another WA
  GTE, a QLD/NSW SOC, a WA total, a national total, or another SOC line. Rows are provisional and
  unverified.

## Non-comparable or not feasible entities

These are the entities/classes that should **not** be put into a single comparable state-owned
enterprise layer without an explicit owner decision. "Not feasible" means not feasible _as part of a
comparable entity set_, not "no public report exists".

| State | Entity/class                                                                                                      | Why it is non-comparable or not feasible                                                                                               |
| ----- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| QLD   | Queensland Rail (Queensland Rail Transit Authority)                                                               | Statutory body, not a GOC; rail infrastructure/access economics differ from GOC trading businesses.                                    |
| QLD   | Seqwater (Queensland Bulk Water Supply Authority)                                                                 | Statutory body, not a GOC; bulk water supply differs from Sunwater and the ports/energy GOCs.                                          |
| QLD   | QIC Limited                                                                                                       | Investment manager; financial statements and revenue model are not comparable to a trading utility.                                    |
| QLD   | GOC subsidiaries/joint ventures                                                                                   | Consolidated into the parent; adding them would double count.                                                                          |
| WA    | Second tranche: Forest Products Commission; Gold Corporation; Insurance Commission of WA; WA Treasury Corporation | Not yet in the GTE Act framework; forest management, minting, insurance and central financing are different businesses.                |
| WA    | The other "possible GTEs" in Treasury's 27-entity universe                                                        | Treasury says they "might be considered possible GTEs"; they are not a published in-scope list. Do not invent names.                   |
| WA    | Aqwest, Busselton Water                                                                                           | Small water utilities; comparable in kind but much smaller and potentially different statement presentation. Extract later, not first. |
| VIC   | Statutory water corporations vs GBEs                                                                              | Different legal class (Water Act 1989 vs State Owned Enterprises Act 1992); do not sum or label them as one "SOC" set.                 |
| VIC   | VicGrid                                                                                                           | New State Body (15 April 2025); ABS sector classification still being finalised in the 2025-26 Budget note.                            |
| VIC   | Non-exhaustive statutory corporations                                                                             | The DataVic dataset explicitly does not list all statutory corporations; it cannot be a complete extraction list.                      |
| SA    | Public corporations without a consolidated list                                                                   | No authoritative list found; entity-by-entity confirmation is required before any extraction.                                          |
| SA    | TAFE SA                                                                                                           | Education statutory corporation, not a commercial trading enterprise.                                                                  |
| SA    | Renewal SA                                                                                                        | Urban renewal/land entity; different economics from SA Water.                                                                          |
| TAS   | Motor Accidents Insurance Board (MAIB)                                                                            | Insurance scheme, not a trading utility.                                                                                               |
| TAS   | Tasmanian Public Finance Corporation (Tascorp)                                                                    | Central financing authority, not a trading utility.                                                                                    |
| TAS   | The Public Trustee                                                                                                | Trustee service, not a trading utility.                                                                                                |
| TAS   | Port Arthur Historic Site Management Authority                                                                    | Heritage site management; small and not comparable.                                                                                    |
| TAS   | Tasracing                                                                                                         | Racing industry body/regulator; not a trading utility.                                                                                 |
| TAS   | TasWater                                                                                                          | Not on the Treasury GBE/State-owned Company list; ownership/reporting class unconfirmed. Scope decision needed.                        |
| ACT   | Housing ACT                                                                                                       | Public housing provider, not a commercial trading enterprise.                                                                          |
| ACT   | Transport Canberra Operations                                                                                     | Public transport operator, not a commercial trading enterprise.                                                                        |
| ACT   | CIT Solutions                                                                                                     | Discontinued per the 2026-27 Classification of ACT Entities.                                                                           |
| ACT   | City Renewal Authority; Suburban Land Agency                                                                      | Land development/renewal entities; different economics from Icon Water. Include only if land development is in scope.                  |
| NT    | Government business divisions: Land Development Corporation; NT Home Ownership                                    | Not GOCs; different legal/reporting class.                                                                                             |
| NT    | Any GOC not confirmed by its constituting Act                                                                     | The GOC Act does not schedule entities; unconfirmed names must not be added.                                                           |

## Proposed state order and entity priority

**State order: QLD → WA → VIC → TAS → ACT → SA → NT.**

Rationale:

1. **QLD** — one current official list of 11 GOCs; large, audited, comparable-within-sector entities;
   the cleanest first state.
2. **WA** — one current official list of 12 in-scope GTEs; large entities; the 12/16/27 ambiguity is
   manageable if the scope is fixed to the 12.
3. **VIC** — 16 named water corporations are a coherent large group, but the GBE list is not
   consolidated and the water/GBE class split must be respected. Medium effort.
4. **TAS** — a clear 14-entity structure, but the official page is stale and several entities are not
   trading comparables. Medium effort, smaller entities.
5. **ACT** — only 6 PTE/PNFC entities, and only Icon Water is a classic commercial utility; the
   TOC/PTE mismatch needs a decision.
6. **SA** — no consolidated list; heterogeneous entities; entity-by-entity confirmation is the
   blocker.
7. **NT** — no consolidated list; the GOC Act declares entities per constituting Act; only three GOCs
   are confirmed. Highest ambiguity.

**Entity priority within the first state (QLD):**

1. Energy Queensland Limited
2. CS Energy Limited
3. Stanwell Corporation Limited
4. Powerlink Queensland
5. Sunwater Limited
6. Gladstone Ports Corporation Limited
7. Port of Townsville Limited
8. North Queensland Bulk Ports Corporation Limited
9. Far North Queensland Ports Corporation Limited (Ports North)
10. CleanCo Queensland Limited
11. QIC Limited (last; flag non-comparable)

Do not add Queensland Rail or Seqwater to a GOC total.

## No-sum and modelling rules for any future extraction

These rules follow the existing NSW SOC discipline in `SOC_INGESTION.md` and
`docs/DATA_GRANULARITY.md`. They apply before any code is written.

- **Entity-level only.** Every row is an entity statement line, not a project, program, LGA, SA2,
  postcode or coordinate. There is no published program/LGA dollar breakdown in these audited
  statements.
- **Never sum across states.** A QLD GOC total and a WA GTE total are different legal populations.
  There is no national "SOC" total.
- **Never sum across entities.** Each entity is a separate source. A state total is not the sum of
  its entities.
- **Never sum across legal classes.** GOCs, statutory bodies, GBEs, State-owned Companies, public
  corporations, TOCs, PTE/PNFCs and government business divisions are not one class.
- **Never add parent and subsidiary.** Use consolidated parent statements; do not add subsidiary
  rows.
- **Never add components to totals.** If a future item extracts note components, mark them
  `soc_component_of`/`soc_note` and never add them to the printed total. Never add revenue and
  expense.
- **Never add an entity total to government spending, ABS GFS/PNFC, ACNC, budget, project or
  contract data.** Use the existing `aggregation_role: "agency_detail"` semantics; do not present
  it as a spending total.
- **Never infer the unit.** Read the printed unit (`$'000`, `$m`, whole dollars) from the report and
  record the evidence. Convert to integer cents only after reconciliation to a printed total.
- **Never mix years.** Record the financial year on every row. Do not sum across years unless the
  item explicitly builds a time series.
- **Never treat budget/estimate columns as actuals.** Do not label a budget column "spent".
- **Preserve provenance.** Record the entity's legal name, trading name, state, legal class,
  regulator, report title, financial year, page/table, URL, SHA-256 and retrieval date.

The existing DB baseline must stay at **515,449 measures / 105 NSW SOC rows**. This document adds
zero rows.

## Ambiguities and questions for the owner

1. **VIC scope.** Does "VIC SOC" mean State business corporations/State bodies under the _State Owned
   Enterprises Act 1992_, all controlled entities, the 16 water corporations, or all statutory
   authorities? These are different sets and must not be merged.
2. **VIC list.** Is there a current, complete DTF register of State business corporations/State
   bodies? The controlled-entities DOCX is a changes list; the statutory-corporations dataset is
   non-exhaustive.
3. **QLD scope.** Are the two commercial statutory bodies (Queensland Rail, Seqwater) in scope, or
   only the 11 GOCs?
4. **WA scope.** Is the target the 12 in-scope GTEs, the 16 including the second tranche, or the 27
   "possible GTEs"? This document recommends the 12.
5. **TAS currency.** The Treasury GBE/State-owned Company list was last published in 2018. Is it
   still current? Is TasWater in scope even though it is not on the list?
6. **ACT scope.** Is the target the legal TOC list under the _Territory-owned Corporations Act 1990_
   or the budget PTE/PNFC list of six? Are Housing ACT, Transport Canberra Operations, the City
   Renewal Authority and the Suburban Land Agency in scope?
7. **SA list.** What is the authoritative list of SA public corporations? The _Public Corporations Act
   1993_ does not schedule them. Is there a DTF/Treasurer's Annual Financial Report register?
8. **NT list.** Which GOCs are currently declared by their constituting Acts? Is Jacana Energy a GOC
   (its site says yes)? Are there other GOCs beyond Power and Water, Territory Generation and Jacana?
9. **Subsidiaries.** Should the layer use consolidated parent statements only, or also extract
   material subsidiaries? This document recommends parent-only; otherwise double counting is likely.
10. **Non-commercial entities.** Should the layer include public housing, public transport, TAFE,
    insurance, trustee and central-financing entities? This document flags them as non-comparable and
    recommends excluding them unless the owner explicitly wants a wider "state-owned entities" view.

## Sources and verification log

All URLs below were accessed on **2026-11-17**. "Fetched" means the page/document content was read in
this pass. "Search result" means the official search engine returned the document and its URL, but
the full document was not parsed. A URL returning 200 is not a licence grant and is not a promise
that the page will be stable.

| State | Source                                                   | URL                                                                                                                                        | What it proves                                                                           | Access        |
| ----- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- | ------------- |
| QLD   | Queensland Treasury, Government-owned corporations       | <https://www.treasury.qld.gov.au/policies-and-programs/economy/government-owned-corporations/>                                             | Legal framework, 11 GOCs, 2 statutory bodies; last updated 16 April 2026                 | Fetched       |
| WA    | WA Government, GTE governance                            | <https://www.wa.gov.au/organisation/department-of-treasury-and-finance/gte-governance>                                                     | 12 in-scope GTEs, 4 second-tranche entities, 27 possible GTEs; last updated 10 July 2023 | Fetched       |
| WA    | Government Trading Enterprises Act 2023 (WA)             | <https://www.legislation.wa.gov.au/legislation/statutes.nsf/law_a147392.html>                                                              | Act No. 013 of 2023, assent 22 June 2023, current consolidation                          | Fetched       |
| WA    | Synergy annual reports                                   | <https://www.synergy.net.au/About-us/News-and-announcements/Annual-reports>                                                                | Annual reports page exists in current site navigation                                    | Fetched       |
| VIC   | State Owned Enterprises Act 1992 (Vic)                   | <https://www.legislation.vic.gov.au/in-force/acts/state-owned-enterprises-act-1992/023>                                                    | Legal basis for State business corporations and State bodies                             | Fetched       |
| VIC   | DataVic, State Budget 2025-26 — Controlled entities list | <https://discover.data.vic.gov.au/dataset/state-budget-2025-26-controlled-entities-list>                                                   | CC BY 4.0; DOCX controlled-entities changes list                                         | Fetched       |
| VIC   | DataVic, List of statutory corporations                  | <https://discover.data.vic.gov.au/dataset/list-of-statutory-corporations-with-responsible-department-constituting-statute-and-crown-statu> | Dataset is explicitly non-exhaustive                                                     | Fetched       |
| VIC   | water.vic.gov.au, Find your water corporation            | <https://www.water.vic.gov.au/for-households/find-your-water-corporation>                                                                  | Names the 16 water corporations                                                          | Fetched       |
| SA    | SA DTF, Acts and legislation                             | <https://www.treasury.sa.gov.au/about/acts-and-legislation>                                                                                | DTF administers the Public Corporations Act 1993                                         | Fetched       |
| SA    | SA Legislation, Public Corporations Act 1993             | <https://www.legislation.sa.gov.au/search?query=Public%20Corporations%20Act%201993>                                                        | Official Act and enabling-Act search results (SA Water, Urban Renewal, TAFE SA)          | Fetched       |
| SA    | Public Corporations Act 1993 current authorised PDF      | <https://www.legislation.sa.gov.au/_legislation-documents/lz/c/a/public-corporations-act-1993/current/1993.36.auth.pdf>                    | Current Act text; does not schedule the entities                                         | Search result |
| TAS   | Tas Treasury, Tasmanian Government Businesses            | <https://www.treasury.tas.gov.au/regulation-site/Pages/Tasmanian-Government-Businesses.aspx>                                               | 6 GBEs + 8 State-owned Companies; page last published 21 June 2018                       | Fetched       |
| ACT   | ACT Budget 2026-27, Budget Papers and Statements         | <https://www.treasury.act.gov.au/budget/budget-2026-27/budget-papers-and-statements>                                                       | Links the Classification of ACT Entities document                                        | Fetched       |
| ACT   | 2026-27 Classification of ACT Entities (DOCX)            | <https://www.treasury.act.gov.au/__data/assets/word_doc/0008/3080663/2026-27-Classification-of-ACT-Entities.docx>                          | 6 PTE/PNFC entities                                                                      | Fetched       |
| ACT   | Territory-owned Corporations Act 1990 (ACT)              | <https://www.legislation.act.gov.au/a/1990-53/>                                                                                            | Legal basis for TOCs; current version R25                                                | Fetched       |
| NT    | Government Owned Corporations Act 2001 (NT)              | <https://legislation.nt.gov.au/en/Legislation/GOVERNMENT-OWNED-CORPORATIONS-ACT-2001>                                                      | GOC definition: declared by constituting Act; no schedule                                | Fetched       |
| NT    | NT Treasury, Client services (NTTC loans)                | <https://treasury.nt.gov.au/dtf/nttc/client-services>                                                                                      | Names Power and Water and Territory Generation as GOCs for loan purposes                 | Fetched       |
| NT    | Jacana Energy, Who we are                                | <https://www.jacanaenergy.com.au/about/who-we-are>                                                                                         | Jacana is a GOC; 2025-26 annual report PDF                                               | Fetched       |

## What this document does not do

- It does not ingest a row, start a state connector, write a schema, change an API, or touch the
  database.
- It does not extract financial figures from any state annual report.
- It does not create a state-by-state total, a national total, or a "SOC spending" figure.
- It does not declare any unconfirmed entity "in scope". Where the list is partial, the gap is
  stated.
- It does not change 3001/5173 or production nginx. The DB remains at **515,449 measures / 105 NSW
  SOC rows**; the older 515,413 figure is stale.

## Recommended next action

The QLD Energy Queensland, CS Energy, Stanwell, Powerlink Queensland, Sunwater Limited,
Gladstone Ports Corporation Limited, Ports North and NQBP pilots described above are implemented
and verified against their 2025-26 audited annual reports (NQBP from the official Queensland
Parliament tabled copy because its corporate site is bot-blocked). The first three WA GTE pilots, Water Corporation,
Synergy and Western Power, are also implemented and verified against their 2025-26 audited annual
reports. Port of
Townsville remains deferred, not merged data. They remain single-entity,
read-only proofs: do not add another QLD GOC, a QLD total or another state until the owner confirms
the legal class, the entity list and the intended use. Any next entity needs its own unit read and
reconciliation; its rows must never be summed with Energy Queensland, CS Energy, Stanwell, Powerlink
Queensland, Sunwater Limited, Gladstone Ports Corporation Limited, Ports North, NQBP, Water
Corporation, Synergy, Western Power, Horizon Power, Fremantle Ports, DevelopmentWA or government
spending.
