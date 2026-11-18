# NSW Budget Papers 2026-27 — scoping and extraction proof

**Status:** research only. No connector, no `server/` or `scripts/` change, no database write, no
`spending_records` change, no PDF or raw table committed.
**Date:** 2026-11-19 (Australia/Sydney). **Scope:** NSW only. **Follows:**
`NSW_GRANULAR_SOURCES_INVESTIGATION.md`.
**Evidence:** `docs/source-discovery/nsw-budget-papers/access-log.json` and
`docs/source-discovery/nsw-budget-papers/extraction-proof.md`.

## 1. Executive verdict

**The 403 finding is corrected, but the granularity finding stands. Do not build a Budget Papers
service-group ingestion connector.**

- **Access is no longer blocked.** The current official copies on `www.nsw.gov.au` return **HTTP
  200**, `application/pdf`, and a usable text layer: BP1 179 pages (5,181,566 bytes), BP2 105 pages
  (4,104,268 bytes), BP3 177 pages (5,001,326 bytes). The previous phase's **HTTP 403** was against
  `www.parliament.nsw.gov.au/fileapi/parlfiles/getartifact?...` URLs, which today return Cloudflare
  `cf-mitigated: challenge`. Those are not the official download links. No authentication was
  bypassed; the official `nsw.gov.au` links were used.
- **The service-group dimension does not exist in the current papers.** A case-insensitive search of
  the extracted text of all **461 pages** finds **0** occurrences of "service group" and **0** of
  "cluster". BP1's expenditure tables are by **economic type** (Table 5.3) or **COFOG function**
  (Tables A.7/A.8). BP2 contains **no expense table** (0 occurrences of "expense"; its only `$m`
  table is an industry exploration-expenditure indicator). BP3 is **capital/infrastructure**:
  four-year capital by **agency group** (Table 1.3), single-year capital by **agency** (Table 4.1),
  and project lists.
- **The premise falsifier therefore fails.** Current BP1/BP2/BP3 do **not** contain accessible,
  extractable, multi-year **service-group** expenditure tables that materially improve on
  `nsw-budget` / `data-nsw-ckan`. The prior conclusion — **no clean current statewide
  internal-function expenditure dataset** — should be preserved.
- **Narrow additionality exists, but it is not service-group.** BP1 Table A.7/A.8 add a
  whole-of-government COFOG-function cut for `2024-25 Actual / 2025-26 Revised / 2026-27 Budget`;
  BP3 Table 1.3 adds four-year forward capital by agency group. Both are coarse and overlap existing
  sources. They are optional follow-ups only if that exact cut is wanted; they do not justify a
  service-group build.
- **Open data XLSX now exists, contrary to the prior phase's "no XLSX links" note.** The 2026-27
  open-data page exposes 12 `.xlsx` workbooks, but the sampled workbooks are aggregate sector
  statements and wellbeing indicators with **no agency, program or service-group dimension**.

**Recommendation:** **NO BUILD** for a NSW Budget Papers service-group / internal-function
connector. If a small follow-up is ever authorised, scope only BP1 Table A.7/A.8 (COFOG function,
three years) or BP3 Table 1.3 (agency-group capital, four years) — not BP2.

## 2. Access and provenance log

Observed 2026-11-18/19 UTC with `curl`, desktop-browser User-Agent, no auth. Full JSON log:
`docs/source-discovery/nsw-budget-papers/access-log.json`.

| Item | URL | HTTP | Type | Bytes | Pages | SHA-256 |
| --- | --- | --- | --- | ---: | ---: | --- |
| Budget landing | `https://www.budget.nsw.gov.au/` | 200 | HTML | — | — | redirects to `www.nsw.gov.au/business-and-economy/nsw-budget` |
| 2026-27 papers | `https://www.nsw.gov.au/business-and-economy/nsw-budget/2026-27-budget-papers` | 200 | HTML | 174,056 | — | — |
| Open data | `.../2026-27-budget-papers/open-data` | 200 | HTML | 139,143 | — | — |
| BP1 PDF | `https://www.nsw.gov.au/sites/default/files/noindex/2026-06/bp1-budget-statement-nsw-budget-2026-27.pdf` | 200 | `application/pdf` | 5,181,566 | 179 | `cb9ecdf0…4432b` |
| BP2 PDF | `https://www.nsw.gov.au/sites/default/files/noindex/2026-06/bp2-performance-and-wellbeing-statement-nsw-budget-2026-27.pdf` | 200 | `application/pdf` | 4,104,268 | 105 | `5a6e1efc…37212` |
| BP3 PDF | `https://www.nsw.gov.au/sites/default/files/noindex/2026-06/bp3-infrastructure-statement-nsw-budget-2026-27.pdf` | 200 | `application/pdf` | 5,001,326 | 177 | `77669470…dd298` |

Access notes:

- The three PDFs are served by CloudFront with `x-cache: Hit` and a real `application/pdf`
  content type. Page counts are from `pdfjs-dist` on the downloaded bytes, not from a header.
- The Parliament "getartifact" URLs still return **403**
  (`content-type: text/html`, `cf-mitigated: challenge`, `server: cloudflare`). That is a
  Cloudflare challenge on the Parliament file API, not a paywall on the Budget Papers.
- The open-data page's `.xlsx` links (e.g. `2026-27-budget-budgeted-financial-statements.xlsx`,
  90,829 bytes) also return 200. They were opened only to inspect sheet names and search for
  `agency` / `program` / `service group`; no workbook is committed.
- No unofficial mirror, Wayback copy or browser-session workaround was needed.

## 3. Paper inventory

Search counts are case-insensitive over the extracted text of each PDF. "Pages" are PDF pages.

### BP1 — Budget Statement (179 pages)

Structure: chapters 1–7 plus appendices A (Statement of finances), B (Measures statement), C (Tax
expenditures), D (Variation details). Spend-relevant tables:

| Table | Page (printed) | Rows / dimension | Columns and years | Unit | Extractable |
| --- | --- | --- | --- | --- | --- |
| 5.3 General government sector expenses | 5-10 | Expense type: Employee, Superannuation, Depreciation, Interest, Other operating, Grants/transfers, Total | `2025-26 Estimate`, `2026-27 Budget`, `2027-28`–`2029-30` Forward Estimates, average growth | `$m` | Yes; wrapped labels need y-grouping |
| A.7 General government sector expenses by function | A-12 | 10 COFOG functions + Total | `2024-25 Actual`, `2025-26 Revised`, `2026-27 Budget` | `$m` | Yes; proof below |
| A.8 General government sector purchases of non-financial assets by function | A-12 | 10 COFOG functions + Total | same three years | `$m` | Yes; proof below |
| 4.1 / 4.9 / 4.6 | 4-2 / 4-11 / 4-8 | Revenue, sale of goods and services, National Agreement payments | up to 6 years | `$m` | Yes, but revenue/transfers, not service-group expense |

No table has an agency column, a program column, a service-group column or a sub-service-group
column. "Agency" appears on only 8 pages, mostly prose. "Service group" and "Cluster" appear on
none.

### BP2 — Performance and Wellbeing Statement (105 pages)

- A wellbeing-indicator document: chapters `Healthy`, `Skilled`, `Prosperous`, `Housed`, `Secure`,
  `Community`, `Connected`, `Sustainable`, plus a Gender Equality Budget Statement.
- **No expenditure table.** "Expense" occurs on 0 pages. "Budget" occurs mostly as the paper title or
  in prose.
- The only `$m` table is **Table 4.1 Total exploration expenditure ($m) and number of exploration
  titles, NSW**, an industry indicator, not government service-group spend.
- It is **not** the old BP2 capital-allocation document. The 1,251 BP2 capital rows already in
  `data-nsw-ckan` are 2014-15 to 2016-17 only and have no current successor in this paper.

### BP3 — Infrastructure Statement (177 pages)

- Capital/infrastructure only. Chapters: overview, projects by portfolio, projects delivered,
  general government sector projects, PNFC projects and appendices.
- **Table 1.3 Non-financial public sector capital spending by Agency group** (printed 1-18):
  12 agency groups (Transport, Health, Education and Skills, Planning/Housing/Infrastructure,
  Communities and Justice, Climate Change/Energy/Environment/Water, Customer Service, Creative
  Industries/Tourism/Hospitality, Primary Industries and Regional Development, Treasury, Water
  Entities, Other), columns `2026-27 Budget`, `2027-28`–`2029-30 Forward Estimates`, four-year total,
  share. Unit `$m`. Extractable.
- **Table 4.1 Capital investment by general government sector entity** (printed 4-3 onwards):
  individual agencies, columns `2025-26 Budget`, `2025-26 Revised`, `2026-27 Budget`, `Variation`.
  Unit `$m`. Single budget year, no forward estimates. Agency names use dotted leaders and wrap;
  harder to parse than A.7.
- Tables 2.1–2.23 and 3.1–3.11 list projects (project name, estimated total cost, expenditure over
  four years, agency). Unit `$m`. Useful for project detail, not a service-group recurrent series.
- "Service group" 0 pages, "Cluster" 0 pages. "Agency" appears on 13 pages (capital tables/prose).

## 4. Unit and multi-year assessment

- **Unit:** `$m` is dominant in all three papers (BP1 390 page-mentions, BP3 34). There are **no
  `$'000` tables** in BP1/BP2/BP3. Prose also uses `$ billion` / `$b`. Any parser must still read the
  printed header per table and must **not** assume a global unit.
- **BP1 Table 5.3:** five years (one estimate, one budget, three forward estimates) but the row
  dimension is expense type, not service group.
- **BP1 Tables A.7/A.8:** three years (actual, revised, budget), no forward estimates, COFOG
  function.
- **BP3 Table 1.3:** four years (budget + three forward estimates), agency group, capital only.
- **BP3 Table 4.1:** one budget year plus revised/variation, agency, capital only.
- **No table combines a service-group (or sub-service-group) dimension with multiple years.** That
  is the decisive gap.

## 5. Taxonomic alignment

| Dimension | Old Budget Data Visualisation (FY13-17) | BP1 2026-27 | BP2 2026-27 | BP3 2026-27 | Existing `nsw-budget` / `data-nsw-ckan` |
| --- | --- | --- | --- | --- | --- |
| Cluster | Yes (3 labels) | **None** | **None** | **None** | `nsw-budget` capital `cluster`; `data-nsw-ckan` agency only |
| Agency | Yes (26) | None in tables | None | Yes, capital (4.1) | `nsw-budget` 803 capital projects; `data-nsw-ckan` schools/agencies |
| Service group | Yes (42) | **None** | **None** | **None** | **None current** (old BP2 capital allocations are 2014-15–16-17) |
| Sub-service group | Yes (8) | **None** | **None** | **None** | **None** |
| Function | None | COFOG (A.7/A.8) | None | None | `abs-gfs` actual COFOG benchmark; `nsw-budget` only 657 capital rows via agency map |
| Account type | Yes (4) | Expense type (5.3) | None | Capital | Statement line items |
| Years | FY13-14–FY16-17 | 3 or 5 | Indicators | 1 or 4 | Mixed; `nsw-budget` 2000-01–2028-29 |
| Unit | `$m` (two ambiguous columns) | `$m` | `$m`/indicator | `$m` | `$m`/`$'000`/`$b` per source |

The current papers have **abandoned the old Cluster/Service Group taxonomy**. BP2's wellbeing themes
are not service groups, and BP3's agency groups are portfolio groupings, not the 42 service groups
in the old visualisation. An automatic crosswalk would be invented, not published; COFOG should
remain a coarse function, not a service-group substitute.

## 6. Extraction complexity and proof

A representative table was extracted with `pdfjs-dist@6.5.438` on Node v24.14.1. Method, command and
full excerpt: `docs/source-discovery/nsw-budget-papers/extraction-proof.md`.

- The PDFs have a real text layer; no OCR is required.
- Table A.7 on PDF page 100 (printed A-12) is clean: each row is one y-line, labels at x ≈ 62,
  values at x ≈ 380/440/500. Ten function rows reconcile to the printed total within **±$1m**
  (published rounding).
- Table 5.3 needs wrapping (`Depreciation and` / `amortisation`) and a separate growth column.
- BP3 Table 4.1 needs dotted-leader cleanup and wrapped agency names; BP3 project tables span pages
  and carry footnotes.
- Effort for a selected table: **low**. Effort for a robust multi-paper parser: **high**. Value for
  the service-group question: **zero**, because the dimension is absent.

## 7. Recommendation

1. **No build** for Budget Papers service-group / internal-function ingestion. Preserve the prior
   finding: there is no clean current statewide multi-year service-group dataset.
2. **Do not treat BP2 as a spend source.** It is a wellbeing-indicator paper. Do not treat BP3 as a
   recurrent-expense source. BP1 is whole-of-government only.
3. **If a narrow follow-up is ever authorised**, use BP1 Table A.7/A.8 for a three-year COFOG
   function cut (budget/estimates, additive to the `abs-gfs` actual benchmark) or BP3 Table 1.3 for
   four-year agency-group capital. Neither is a service-group replacement, and both must be
   reconciled against existing `nsw-budget` / `abs-gfs` before ingestion.
4. **Do not ingest the open-data XLSX as a granular source.** The sampled workbooks are aggregate
   sector statements and indicators, not agency/program/service-group spend.
5. **Keep COFOG blank/provisional** for any future NSW service-group-like mapping, as the prior
   report already recommends.

## 8. Appendix — exact official links

- Papers landing:
  `https://www.nsw.gov.au/business-and-economy/nsw-budget/2026-27-budget-papers`
- Open data:
  `https://www.nsw.gov.au/business-and-economy/nsw-budget/2026-27-budget-papers/open-data`
- BP1:
  `https://www.nsw.gov.au/sites/default/files/noindex/2026-06/bp1-budget-statement-nsw-budget-2026-27.pdf`
- BP2:
  `https://www.nsw.gov.au/sites/default/files/noindex/2026-06/bp2-performance-and-wellbeing-statement-nsw-budget-2026-27.pdf`
- BP3:
  `https://www.nsw.gov.au/sites/default/files/noindex/2026-06/bp3-infrastructure-statement-nsw-budget-2026-27.pdf`
- BP4 (not assessed): linked from the papers landing page as
  `budget-paper-no04-agency-financial-statements`.
