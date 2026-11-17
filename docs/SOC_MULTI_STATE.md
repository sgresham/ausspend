# Multi-state SOC inventory — VIC, QLD, WA, SA, TAS, ACT and NT

**Status: planning and research only. No ingestion, no extraction, no schema/API/DB writes, no
state connector, and no cross-state totals.** All checks below are read-only page/API probes made on
**2026-11-17** from the item worktree. The app database was **not** written to; it stays at
**515,449 measures and 105 NSW SOC rows**. The older brief figure of **515,413 is stale** and is not
used here. No 3001/5173 or production nginx change was made.

This document inventories the *entity-level* state-owned commercial sector in the seven
jurisdictions the owner asked about. It deliberately does **not** call every regime "NSW SOC".
"State-owned corporation" (SOC) is New South Wales legal shorthand. The other jurisdictions use
different legal classes, different regulators, different official lists and different annual-report
formats:

- **VIC** — State business corporations / State bodies under the *State Owned Enterprises Act 1992*,
  plus statutory water corporations under the *Water Act 1989* and other statutory authorities.
- **QLD** — Government Owned Corporations (GOCs) under the *Government Owned Corporations Act 1993*
  (Qld), plus two statutory bodies with commercial operations.
- **WA** — Government Trading Enterprises (GTEs) under the *Government Trading Enterprises Act 2023*
  (WA), with a second tranche not yet in the Act.
- **SA** — public corporations under the *Public Corporations Act 1993* (SA), plus statutory
  corporations under their own enabling Acts.
- **TAS** — Government Business Enterprises (GBEs) under the *Government Business Enterprises Act
  1995* (Tas), plus State-owned Companies.
- **ACT** — Territory-owned Corporations under the *Territory-owned Corporations Act 1990* (ACT), but
  the official budget classification uses the wider Public Trading Enterprise / Public Non-Financial
  Corporation (PTE/PNFC) class.
- **NT** — Government Owned Corporations (GOCs) under the *Government Owned Corporations Act 2001*
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
   controlled-entities *changes* list and a non-exhaustive statutory-corporations dataset. SA and NT
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

Counts below are the counts of the *named lists at the cited source*, not an estimate of the
"real" universe. Where a source is partial, the cell says so.

| State | Legal/reporting class | Official list found | Entities named at source | Latest annual reports | Entity-level extraction | Proposed rank |
| ----- | --------------------- | ------------------- | ------------------------ | --------------------- | ----------------------- | ------------- |
| **QLD** | Government Owned Corporations (GOCs) + 2 commercial statutory bodies | QLD Treasury GOC page, current | **11 GOCs + 2 statutory bodies** | GOC reports published; not individually verified | **High** — one current list, large entities, audited annual reports | **1** |
| **WA** | Government Trading Enterprises (GTEs) | WA Treasury GTE governance page, current | **12 in-scope GTEs + 4 second-tranche entities; Treasury says 27 "possible GTEs"** | GTE reports; Synergy annual-reports page verified | **High for the 12**; medium for tranche 2 | **2** |
| **VIC** | State business corporations / State bodies + statutory water corporations + other statutory authorities | DataVic controlled-entities *changes* list (CC BY 4.0); non-exhaustive statutory-corporations dataset; official water-corporation finder | **16 water corporations named on the finder page**; no single complete GBE list | Entity reports published; URLs not individually verified | **Medium** — large water entities are feasible; GBE list must be confirmed | **3** |
| **TAS** | Government Business Enterprises (GBEs) + State-owned Companies | Tas Treasury "Tasmanian Government Businesses" page | **6 GBEs + 8 State-owned Companies (14)** | Treasury links to reports; page last published 2018 | **Medium** — clear list but stale; several non-comparable entities | **4** |
| **ACT** | Territory-owned Corporations (legal) / PTE/PNFC (budget classification) | ACT Budget 2026-27 "Classification of ACT Entities" | **6 PTE/PNFC entities**; legal TOC list not separately consolidated | Entity reports published; URLs not individually verified | **Medium-low** — only Icon Water is a classic commercial utility; class mismatch | **5** |
| **SA** | Public corporations + statutory corporations | *Public Corporations Act 1993* (SA); no single consolidated public list found | **No reliable count**; 3 examples verified from enabling Acts | Entity reports published; no consolidated list | **Low-medium** — entity-by-entity; list must be confirmed first | **6** |
| **NT** | Government Owned Corporations (GOCs) + government business divisions | *Government Owned Corporations Act 2001* (NT); NTTC client-services table; entity disclosures | **No single consolidated list**; 3 GOCs confirmed (Power and Water, Territory Generation, Jacana Energy) | Jacana 2025-26 PDF verified; Power and Water/Territory Generation not opened | **Low-medium** — only 3 confirmed; Act declares per constituting Act | **7** |

**Unit and comparability finding.** No state publishes one unit across all of its state-owned
entities. Even within a state, an annual report may print `$'000` or `$m`, and some entities may
print whole dollars or use a different statement presentation. A state-wide or national unit
assumption would be wrong. Any future extraction must read the unit from each report, record the
evidence, and reconcile to a printed total before converting to integer cents. This is the same rule
the NSW SOC layer already applies.

## State-by-state detail

### 1. Queensland — GOCs (recommended first state)

**Legal/reporting class.** Queensland Government Owned Corporations under the *Government Owned
Corporations Act 1993* (Qld), also subject to the *Corporations Act 2001* (Cth). Queensland Treasury
states that GOCs are bound by "the *Queensland Government Owned Corporations Act 1993* and the
*Corporations Act 2001 (Cth)*". The same page lists two **statutory bodies with commercial
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
1. Energy Queensland Limited — largest energy network business; standard statements.
2. CS Energy Limited — generation; standard statements.
3. Stanwell Corporation Limited — generation; standard statements.
4. Powerlink Queensland — transmission; standard statements.
5. Sunwater Limited — water; standard statements.
6. Gladstone Ports Corporation Limited — large port; standard statements.
7. Port of Townsville Limited; North Queensland Bulk Ports; Ports North — port group.
8. CleanCo Queensland — smaller generation; later.
9. QIC Limited — last; flag as non-comparable.

### 2. Western Australia — GTEs

**Legal/reporting class.** Government Trading Enterprises under the *Government Trading Enterprises
Act 2023* (WA), which consolidates the governance requirements previously spread across the
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
1. Water Corporation — largest water utility; standard statements.
2. Synergy — electricity generation/retail; standard statements.
3. Western Power — electricity network; standard statements.
4. Horizon Power — regional electricity; standard statements.
5. DevelopmentWA — land development; different but audited.
6. Pilbara Ports Authority — large port; standard statements.
7. Fremantle Port Authority — port; standard statements.
8. Kimberley/Mid West/Southern Ports — later, smaller.
9. Aqwest/Busselton Water — later, smaller.
10. Second tranche (Forest Products Commission, Gold Corporation, Insurance Commission, WA Treasury
    Corporation) — later; flag non-comparable.

### 3. Victoria — GBEs, state-owned companies and statutory water corporations

**Legal/reporting class.** Victoria does not have one "SOC" class. The *State Owned Enterprises Act
1992* (Vic) provides for State business corporations and State bodies. Water corporations are
statutory corporations under the *Water Act 1989* (Vic), not GBEs under the SOE Act. Other statutory
authorities and controlled entities sit alongside them. The budget's controlled-entities note
consolidates significant entities for whole-of-state reporting, but that is an accounting boundary,
not a single commercial class.

**Regulator/act.** Department of Treasury and Finance (DTF) for financial management and the State
Budget; the *Financial Management Act 1994* (Vic) and the Standing Directions 2018; the *State Owned
Enterprises Act 1992*; the *Water Act 1989* for water corporations. The Essential Services
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

**Legal/reporting class.** Tasmanian Government Business Enterprises under the *Government Business
Enterprises Act 1995* (Tas), and State-owned Companies (companies owned by the State and subject to
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

**Legal/reporting class.** Territory-owned Corporations under the *Territory-owned Corporations Act
1990* (ACT). However, the ACT Budget's official "Classification of ACT Entities" uses the wider
**Public Trading Enterprises / Public Non-Financial Corporations (PTE/PNFC)** class. The two sets do
not fully coincide. The PTE/PNFC list includes Housing ACT and Transport Canberra Operations, which
are public-service delivery entities rather than classic TOCs.

**Regulator/act.** ACT Treasury (Chief Minister, Treasury and Economic Development Directorate);
the *Financial Management Act 1996* (ACT); the *Territory-owned Corporations Act 1990*; the
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
document. The *Territory-owned Corporations Act 1990* (ACT) is at
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

**Legal/reporting class.** Public corporations under the *Public Corporations Act 1993* (SA), plus
statutory corporations established by their own enabling Acts. The Act provides for the control of
public corporations, but it does **not** schedule the entities. A public corporation is defined by
reference to the Act's interpretation and declaration provisions; the entity list is distributed
across enabling Acts and annual reports.

**Regulator/act.** South Australian Department of Treasury and Finance; the *Public Corporations Act
1993*; the *Public Finance and Audit Act 1987*; portfolio ministers. ESCOSA regulates water and
energy prices for regulated activities. The DTF "Acts and legislation" page lists the *Public
Corporations Act 1993* among the legislation it administers:
<https://www.treasury.sa.gov.au/about/acts-and-legislation> (fetched 2026-11-17).

**Official entity list and source URL.** **No single consolidated public list was found on
treasury.sa.gov.au on 2026-11-17.** The official legal sources are:

- *Public Corporations Act 1993* (SA), current authorised version:
  <https://www.legislation.sa.gov.au/_legislation-documents/lz/c/a/public-corporations-act-1993/current/1993.36.auth.pdf>
  (listed in the SA Legislation search results; the Act's text does not schedule the corporations).
- The SA Legislation search page for the Act:
  <https://www.legislation.sa.gov.au/search?query=Public%20Corporations%20Act%201993> (fetched
  2026-11-17), which also returns enabling Acts.
- Verified examples of public corporations from their enabling Acts:
  - **South Australian Water Corporation (SA Water)** — *South Australian Water Corporation Act
    1994* (SA). The Act states the Corporation is a statutory corporation to which the Public
    Corporations Act 1993 applies.
  - **Urban Renewal Authority (Renewal SA)** — *Urban Renewal Act 1995* (SA). The Act establishes the
    Urban Renewal Authority and applies provisions of the Public Corporations Act 1993.
  - **TAFE SA** — *TAFE SA Act 2012* (SA). The Act states TAFE SA is a statutory corporation to which
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

**Legal/reporting class.** Government Owned Corporations under the *Government Owned Corporations
Act 2001* (NT). The Act's definition is decisive:

> "**Government owned corporation** means a statutory corporation that is declared to be a
> Government owned corporation by its constituting Act."

That means the GOC Act does **not** contain a schedule of GOCs. Each GOC is declared by its own
constituting Act. Government business divisions (for example, Land Development Corporation and NT
Home Ownership in the NTTC loan table) are a different class and are not GOCs.

**Regulator/act.** NT Department of Treasury and Finance; the *Government Owned Corporations Act
2001* (NT); the *Financial Management Act 1995* (NT); the Utilities Commission for regulated
utilities; shareholding and portfolio ministers.

**Official entity list and source URL.** **No single consolidated GOC list was found.** The official
sources are:

- *Government Owned Corporations Act 2001* (NT),
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

## Non-comparable or not feasible entities

These are the entities/classes that should **not** be put into a single comparable state-owned
enterprise layer without an explicit owner decision. "Not feasible" means not feasible *as part of a
comparable entity set*, not "no public report exists".

| State | Entity/class | Why it is non-comparable or not feasible |
| ----- | ------------ | ---------------------------------------- |
| QLD | Queensland Rail (Queensland Rail Transit Authority) | Statutory body, not a GOC; rail infrastructure/access economics differ from GOC trading businesses. |
| QLD | Seqwater (Queensland Bulk Water Supply Authority) | Statutory body, not a GOC; bulk water supply differs from Sunwater and the ports/energy GOCs. |
| QLD | QIC Limited | Investment manager; financial statements and revenue model are not comparable to a trading utility. |
| QLD | GOC subsidiaries/joint ventures | Consolidated into the parent; adding them would double count. |
| WA | Second tranche: Forest Products Commission; Gold Corporation; Insurance Commission of WA; WA Treasury Corporation | Not yet in the GTE Act framework; forest management, minting, insurance and central financing are different businesses. |
| WA | The other "possible GTEs" in Treasury's 27-entity universe | Treasury says they "might be considered possible GTEs"; they are not a published in-scope list. Do not invent names. |
| WA | Aqwest, Busselton Water | Small water utilities; comparable in kind but much smaller and potentially different statement presentation. Extract later, not first. |
| VIC | Statutory water corporations vs GBEs | Different legal class (Water Act 1989 vs State Owned Enterprises Act 1992); do not sum or label them as one "SOC" set. |
| VIC | VicGrid | New State Body (15 April 2025); ABS sector classification still being finalised in the 2025-26 Budget note. |
| VIC | Non-exhaustive statutory corporations | The DataVic dataset explicitly does not list all statutory corporations; it cannot be a complete extraction list. |
| SA | Public corporations without a consolidated list | No authoritative list found; entity-by-entity confirmation is required before any extraction. |
| SA | TAFE SA | Education statutory corporation, not a commercial trading enterprise. |
| SA | Renewal SA | Urban renewal/land entity; different economics from SA Water. |
| TAS | Motor Accidents Insurance Board (MAIB) | Insurance scheme, not a trading utility. |
| TAS | Tasmanian Public Finance Corporation (Tascorp) | Central financing authority, not a trading utility. |
| TAS | The Public Trustee | Trustee service, not a trading utility. |
| TAS | Port Arthur Historic Site Management Authority | Heritage site management; small and not comparable. |
| TAS | Tasracing | Racing industry body/regulator; not a trading utility. |
| TAS | TasWater | Not on the Treasury GBE/State-owned Company list; ownership/reporting class unconfirmed. Scope decision needed. |
| ACT | Housing ACT | Public housing provider, not a commercial trading enterprise. |
| ACT | Transport Canberra Operations | Public transport operator, not a commercial trading enterprise. |
| ACT | CIT Solutions | Discontinued per the 2026-27 Classification of ACT Entities. |
| ACT | City Renewal Authority; Suburban Land Agency | Land development/renewal entities; different economics from Icon Water. Include only if land development is in scope. |
| NT | Government business divisions: Land Development Corporation; NT Home Ownership | Not GOCs; different legal/reporting class. |
| NT | Any GOC not confirmed by its constituting Act | The GOC Act does not schedule entities; unconfirmed names must not be added. |

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

1. **VIC scope.** Does "VIC SOC" mean State business corporations/State bodies under the *State Owned
   Enterprises Act 1992*, all controlled entities, the 16 water corporations, or all statutory
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
6. **ACT scope.** Is the target the legal TOC list under the *Territory-owned Corporations Act 1990*
   or the budget PTE/PNFC list of six? Are Housing ACT, Transport Canberra Operations, the City
   Renewal Authority and the Suburban Land Agency in scope?
7. **SA list.** What is the authoritative list of SA public corporations? The *Public Corporations Act
   1993* does not schedule them. Is there a DTF/Treasurer's Annual Financial Report register?
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

| State | Source | URL | What it proves | Access |
| ----- | ------ | --- | -------------- | ------ |
| QLD | Queensland Treasury, Government-owned corporations | <https://www.treasury.qld.gov.au/policies-and-programs/economy/government-owned-corporations/> | Legal framework, 11 GOCs, 2 statutory bodies; last updated 16 April 2026 | Fetched |
| WA | WA Government, GTE governance | <https://www.wa.gov.au/organisation/department-of-treasury-and-finance/gte-governance> | 12 in-scope GTEs, 4 second-tranche entities, 27 possible GTEs; last updated 10 July 2023 | Fetched |
| WA | Government Trading Enterprises Act 2023 (WA) | <https://www.legislation.wa.gov.au/legislation/statutes.nsf/law_a147392.html> | Act No. 013 of 2023, assent 22 June 2023, current consolidation | Fetched |
| WA | Synergy annual reports | <https://www.synergy.net.au/About-us/News-and-announcements/Annual-reports> | Annual reports page exists in current site navigation | Fetched |
| VIC | State Owned Enterprises Act 1992 (Vic) | <https://www.legislation.vic.gov.au/in-force/acts/state-owned-enterprises-act-1992/023> | Legal basis for State business corporations and State bodies | Fetched |
| VIC | DataVic, State Budget 2025-26 — Controlled entities list | <https://discover.data.vic.gov.au/dataset/state-budget-2025-26-controlled-entities-list> | CC BY 4.0; DOCX controlled-entities changes list | Fetched |
| VIC | DataVic, List of statutory corporations | <https://discover.data.vic.gov.au/dataset/list-of-statutory-corporations-with-responsible-department-constituting-statute-and-crown-statu> | Dataset is explicitly non-exhaustive | Fetched |
| VIC | water.vic.gov.au, Find your water corporation | <https://www.water.vic.gov.au/for-households/find-your-water-corporation> | Names the 16 water corporations | Fetched |
| SA | SA DTF, Acts and legislation | <https://www.treasury.sa.gov.au/about/acts-and-legislation> | DTF administers the Public Corporations Act 1993 | Fetched |
| SA | SA Legislation, Public Corporations Act 1993 | <https://www.legislation.sa.gov.au/search?query=Public%20Corporations%20Act%201993> | Official Act and enabling-Act search results (SA Water, Urban Renewal, TAFE SA) | Fetched |
| SA | Public Corporations Act 1993 current authorised PDF | <https://www.legislation.sa.gov.au/_legislation-documents/lz/c/a/public-corporations-act-1993/current/1993.36.auth.pdf> | Current Act text; does not schedule the entities | Search result |
| TAS | Tas Treasury, Tasmanian Government Businesses | <https://www.treasury.tas.gov.au/regulation-site/Pages/Tasmanian-Government-Businesses.aspx> | 6 GBEs + 8 State-owned Companies; page last published 21 June 2018 | Fetched |
| ACT | ACT Budget 2026-27, Budget Papers and Statements | <https://www.treasury.act.gov.au/budget/budget-2026-27/budget-papers-and-statements> | Links the Classification of ACT Entities document | Fetched |
| ACT | 2026-27 Classification of ACT Entities (DOCX) | <https://www.treasury.act.gov.au/__data/assets/word_doc/0008/3080663/2026-27-Classification-of-ACT-Entities.docx> | 6 PTE/PNFC entities | Fetched |
| ACT | Territory-owned Corporations Act 1990 (ACT) | <https://www.legislation.act.gov.au/a/1990-53/> | Legal basis for TOCs; current version R25 | Fetched |
| NT | Government Owned Corporations Act 2001 (NT) | <https://legislation.nt.gov.au/en/Legislation/GOVERNMENT-OWNED-CORPORATIONS-ACT-2001> | GOC definition: declared by constituting Act; no schedule | Fetched |
| NT | NT Treasury, Client services (NTTC loans) | <https://treasury.nt.gov.au/dtf/nttc/client-services> | Names Power and Water and Territory Generation as GOCs for loan purposes | Fetched |
| NT | Jacana Energy, Who we are | <https://www.jacanaenergy.com.au/about/who-we-are> | Jacana is a GOC; 2025-26 annual report PDF | Fetched |

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

The owner should choose **one state** and **one entity** for a read-only pilot. The recommended first
pilot is **QLD, Energy Queensland Limited** (or CS Energy), using the existing PDF foundation and the
NSW SOC reconciliation discipline. No state connector should be built until the owner confirms the
state, the legal class, the entity list and the reporting unit. For a lower-risk first step, a single
entity's face statement (total revenue, total expenses, employee expenses, depreciation/amortisation,
net result) is enough to prove the approach without creating a cross-entity or cross-state total.
