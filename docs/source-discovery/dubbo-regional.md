# Dubbo Regional Council — source discovery

- council: **Dubbo Regional Council** (`dubbo-regional`), NSW local government
- generated: 2026-11-18T03:18:52Z
- reporting page: <https://www.dubbo.nsw.gov.au/About-Council/Our-Responsibilities/reporting> (HTTP 200)
- secondary page: <https://www.dubbo.nsw.gov.au/About-Council/Our-Responsibilities/Integrated-Planning-and-Reporting> (HTTP 200)
- archive root: `~/ausspend-source-archive/dubbo-regional` (outside the repo)
- checksums: `~/ausspend-source-archive/dubbo-regional/SHA256SUMS` (25/25 re-hashed and matched)
- scope: source discovery only — no connector, DB or `measures` write, no total derived when the unit or printed total is absent.

## 1. Premise falsifier

**Result: the multi-source premise is TRUE for Dubbo Regional Council.**

The reporting page lists audited GPFS for FY2016-17 through FY2025-26 (10 years), plus FY2015-16 statements for the former Dubbo City and former Wellington councils, annual reports and IP&R/budget documents. Multiple current and historical GPFS therefore exist; the premise is true.

The page lists standalone audited GPFS for every year FY2016-17 to FY2025-26, two former-council FY2015-16 statements, annual reports for FY2017-18 to FY2025-26, and (on the Integrated Planning and Reporting page) budget/forward forecasts and IP&R plans. This is not a one-PDF source.

The three current/recent GPFS checked in depth (FY2023-24, FY2024-25, FY2025-26) each carry an explicit printed `$'000` header and printed total income and total expenses, so none is rejected by the falsifier. The historical series FY2015-16 to FY2022-23 is deep-verified in §10: seven standalone Dubbo Regional Council GPFS (FY2016-17..FY2022-23) plus two former-council predecessor statements (FY2015-16), each with an explicit printed unit and printed totals. Older years and non-GPFS documents are marked below with their status and reason; none is used to derive a total.

## 2. Method and archive

- Every listed document was fetched with redirects followed; the exact response bytes were written to the durable archive outside the repo under `~/ausspend-source-archive/dubbo-regional/<year>/`.
- `sha256`, byte length, page count, HTTP status, final URL, content type, `Last-Modified` and `ETag` are recorded in the JSON packet. The separate `SHA256SUMS` file was re-read and every entry re-hashed (25/25 matched).
- Unit and totals are read from the printed PDF text (`pdfjs-dist` extraction, no OCR). Where the first 20 pages do not print a unit, the document is recorded as `not assessed` rather than inferred.
- No cross-council sum and no GPFS + budget sum is computed anywhere in this packet.

## 3. Inventory

### 3.1 Audited General Purpose Financial Statements (accepted)

| source_id      | FY      |     bytes | pages | HTTP | printed unit | status   | parser feasibility                                                                                                                                                                                                                                               |
| -------------- | ------- | --------: | ----: | ---: | ------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gpfs-2016-17` | 2016-17 | 2,404,714 |   136 |  200 | $'000        | accepted | deferred: older format; covers 13 May 2016 to 30 June 2017 (post-amalgamation partial period) with amalgamation gain/transfer lines, so it needs a dedicated layout review before any builder.                                                                   |
| `gpfs-2017-18` | 2017-18 | 3,036,559 |   141 |  200 | $'000        | accepted | deferred: older format; layout not deep-verified and needs a dedicated review before any builder.                                                                                                                                                                |
| `gpfs-2018-19` | 2018-19 | 5,224,896 |   129 |  200 | $'000        | accepted | deferred: layout not deep-verified; per-year parser review required before builder.                                                                                                                                                                              |
| `gpfs-2019-20` | 2019-20 | 6,841,185 |   125 |  200 | $'000        | accepted | deferred: layout not deep-verified; per-year parser review required before builder.                                                                                                                                                                              |
| `gpfs-2020-21` | 2020-21 | 2,637,455 |   120 |  200 | $'000        | accepted | deferred: layout not deep-verified; per-year parser review required before builder.                                                                                                                                                                              |
| `gpfs-2021-22` | 2021-22 | 3,891,387 |   120 |  200 | $'000        | accepted | deferred: layout not deep-verified; per-year parser review required before builder.                                                                                                                                                                              |
| `gpfs-2022-23` | 2022-23 | 3,665,534 |   120 |  200 | $'000        | accepted | deferred: layout not deep-verified; per-year parser review required before builder.                                                                                                                                                                              |
| `gpfs-2023-24` | 2023-24 | 2,677,519 |   114 |  200 | $'000        | accepted | variant required: face statement prints a single 'Total expenses from continuing operations' (181,317) and 'Net loss from the disposal of assets' (4,489); the FY2024-25 parser expects the 'excluding depreciation' expense label and would reject this layout. |
| `gpfs-2024-25` | 2024-25 | 1,807,768 |   110 |  200 | $'000        | accepted | supported by existing dubbo-council-gpfs (FY2024-25 constants).                                                                                                                                                                                                  |
| `gpfs-2025-26` | 2025-26 | 2,940,971 |   111 |  200 | $'000        | accepted | variant required: face statement adds a 'Net gain from the disposal of assets' revenue line (864) and prints the loss line at nil; the FY2024-25 parser excludes that line from total revenue and would fail reconciliation.                                     |

All ten are standalone statutory financial reports with an independent auditor report, printed `$'000` and printed total income and total expenses. They are accepted as the council-wide actual series. `dubbo-council-gpfs` currently reads FY2024-25 only; FY2023-24 and FY2025-26 need layout variants (§6).

The parser notes in the table above for FY2016-17..FY2022-23 describe builder readiness from the first discovery pass; those seven years are now deep-verified with printed totals, reconciliation and per-year variants in §10, which supersedes the "not deep-verified" wording.

### 3.2 Other published sources (listed, rejected for totals)

| source_id                     | FY      | type                              |       bytes | pages | HTTP | printed unit | status   | reason / overlap                                                                                                                                                                                                                                                                                                      |
| ----------------------------- | ------- | --------------------------------- | ----------: | ----: | ---: | ------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `annual-report-2017-18`       | 2017-18 | annual-report                     |  13,865,318 |    40 |  200 | not assessed | rejected | Annual report: compiles financial and non-financial content and restates/summarises the GPFS. Rejected as a totals source to avoid double-counting the standalone GPFS and mixing narrative measures. Overlaps the GPFS for the same year; use the GPFS PDF, never both.                                              |
| `annual-report-2018-19`       | 2018-19 | annual-report                     |  19,985,731 |    70 |  200 | not assessed | rejected | Annual report: compiles financial and non-financial content and restates/summarises the GPFS. Rejected as a totals source to avoid double-counting the standalone GPFS and mixing narrative measures. Overlaps the GPFS for the same year; use the GPFS PDF, never both.                                              |
| `annual-report-2019-20`       | 2019-20 | annual-report                     | 135,183,790 |    43 |  200 | not assessed | rejected | Annual report: compiles financial and non-financial content and restates/summarises the GPFS. Rejected as a totals source to avoid double-counting the standalone GPFS and mixing narrative measures. Overlaps the GPFS for the same year; use the GPFS PDF, never both.                                              |
| `annual-report-2020-21`       | 2020-21 | annual-report                     |   3,024,831 |    39 |  200 | not assessed | rejected | Annual report: compiles financial and non-financial content and restates/summarises the GPFS. Rejected as a totals source to avoid double-counting the standalone GPFS and mixing narrative measures. Overlaps the GPFS for the same year; use the GPFS PDF, never both.                                              |
| `annual-report-2021-22`       | 2021-22 | annual-report                     |   3,462,635 |    35 |  200 | not assessed | rejected | Annual report: compiles financial and non-financial content and restates/summarises the GPFS. Rejected as a totals source to avoid double-counting the standalone GPFS and mixing narrative measures. Overlaps the GPFS for the same year; use the GPFS PDF, never both.                                              |
| `annual-report-2022-23`       | 2022-23 | annual-report                     |  11,801,840 |    66 |  200 | not assessed | rejected | Annual report: compiles financial and non-financial content and restates/summarises the GPFS. Rejected as a totals source to avoid double-counting the standalone GPFS and mixing narrative measures. Overlaps the GPFS for the same year; use the GPFS PDF, never both.                                              |
| `annual-report-2023-24`       | 2023-24 | annual-report                     |  20,292,766 |    51 |  200 | not assessed | rejected | Annual report: compiles financial and non-financial content and restates/summarises the GPFS. Rejected as a totals source to avoid double-counting the standalone GPFS and mixing narrative measures. Overlaps the GPFS for the same year; use the GPFS PDF, never both.                                              |
| `annual-report-2024-25`       | 2024-25 | annual-report                     |   7,545,151 |    59 |  200 | not assessed | rejected | Annual report: compiles financial and non-financial content and restates/summarises the GPFS. Rejected as a totals source to avoid double-counting the standalone GPFS and mixing narrative measures. Overlaps the GPFS for the same year; use the GPFS PDF, never both.                                              |
| `annual-report-2025-26`       | 2025-26 | annual-report                     |   5,846,833 |    58 |  200 | not assessed | rejected | Annual report: compiles financial and non-financial content and restates/summarises the GPFS. Rejected as a totals source to avoid double-counting the standalone GPFS and mixing narrative measures. Overlaps the GPFS for the same year; use the GPFS PDF, never both.                                              |
| `budget-2025-29`              | 2025-26 | budget-forward-estimate           |   1,054,461 |    18 |  200 | $'000        | rejected | Budget/forward estimate (measure_type=budget), not an audited actual. Rejected from the GPFS actuals inventory; must not be summed with actuals. Different measure type and period from the GPFS actuals; keep as a separate budget series only.                                                                      |
| `budget-2026-27`              | 2026-27 | budget-forward-estimate           |     615,350 |    14 |  200 | $'000        | rejected | Budget/forward estimate (measure_type=budget), not an audited actual. Rejected from the GPFS actuals inventory; must not be summed with actuals. Different measure type and period from the GPFS actuals; keep as a separate budget series only.                                                                      |
| `dpop-2025-29`                | 2025-26 | delivery-program-operational-plan |   4,935,346 |    43 |  200 | not assessed | rejected | Delivery Program / Operational Plan: planning and service-delivery document, not a statutory financial report with audited actual totals. May quote budget figures already covered by the budget/forward-estimate series; do not treat as actuals.                                                                    |
| `former-dubbo-2015-16`        | 2015-16 | former-council                    |   5,822,888 |   141 |  200 | $'000        | rejected | Former council (pre-amalgamation) FY2015-16 statements: not consolidated Dubbo Regional Council actuals and outside the target series. Historical context only. Former Dubbo City and former Wellington City are separate entities in FY2015-16 and must never be added together or to Dubbo Regional Council totals. |
| `former-wellington-2015-16`   | 2015-16 | former-council                    |   3,136,063 |   131 |  200 | $'000        | rejected | Former council (pre-amalgamation) FY2015-16 statements: not consolidated Dubbo Regional Council actuals and outside the target series. Historical context only. Former Dubbo City and former Wellington City are separate entities in FY2015-16 and must never be added together or to Dubbo Regional Council totals. |
| `resourcing-strategy-2025-29` | 2025-26 | resourcing-strategy               |   4,844,520 |    44 |  200 | not assessed | rejected | Resourcing Strategy: long-term planning document, not a statutory financial report with audited actual totals. Planning context only; not an actuals source.                                                                                                                                                          |

### 3.3 Source URLs

- `annual-report-2017-18` — <https://www.dubbo.nsw.gov.au/ArticleDocuments/11102/Annual%20Report%202017%202018_Adopted.pdf.aspx>
- `annual-report-2018-19` — <https://www.dubbo.nsw.gov.au/ArticleDocuments/11102/DRC%20Annual%20Report%202019_SP.pdf.aspx>
- `annual-report-2019-20` — <https://www.dubbo.nsw.gov.au/ArticleDocuments/11102/DRC%20Annual%20Report%202020.pdf.aspx>
- `annual-report-2020-21` — <https://www.dubbo.nsw.gov.au/ArticleDocuments/11102/DRC%20Annual%20Report%202021_spreads_web.pdf.aspx>
- `annual-report-2021-22` — <https://www.dubbo.nsw.gov.au/ArticleDocuments/11102/20220926%20DRC%20Annual%20Report%202021%202022_Web.pdf.aspx>
- `annual-report-2022-23` — <https://www.dubbo.nsw.gov.au/ArticleDocuments/11102/Annual%20Report%202022%202023_Print.pdf.aspx>
- `annual-report-2023-24` — <https://www.dubbo.nsw.gov.au/ArticleDocuments/11102/Dubbo%20Regional%20Council%20Annual%20Report%2020232024%20-%20adopted%2024102024.PDF.aspx>
- `annual-report-2024-25` — <https://www.dubbo.nsw.gov.au/ArticleDocuments/11102/20242025%20Annual%20Report%20-%20final%20publication%20(endorsed%2028102025).PDF.aspx>
- `annual-report-2025-26` — <https://www.dubbo.nsw.gov.au/ArticleDocuments/11102/20252026%20Annual%20Report%20-%20Adopted%2027102026.PDF.aspx>
- `budget-2025-29` — <https://www.dubbo.nsw.gov.au/ArticleDocuments/290/20252029%20Budget%20and%20Forward%20Forecasts%20and%20Capital%20Expenditure.PDF.aspx>
- `budget-2026-27` — <https://www.dubbo.nsw.gov.au/ArticleDocuments/290/20262027%20Budget%20and%20Forecasts%20including%20Capital%20-%20Adopted.PDF.aspx>
- `dpop-2025-29` — <https://www.dubbo.nsw.gov.au/ArticleDocuments/290/DPOP_2025_Updated%20File.pdf.aspx>
- `former-dubbo-2015-16` — <https://www.dubbo.nsw.gov.au/ArticleDocuments/11102/The_former_Dubbo_Council_Financial_Statements_2015-16.pdf.aspx>
- `former-wellington-2015-16` — <https://www.dubbo.nsw.gov.au/ArticleDocuments/11102/The_former_Wellington_Council_Financial_Statements_2015-16.pdf.aspx>
- `gpfs-2016-17` — <https://www.dubbo.nsw.gov.au/ArticleDocuments/11102/Dubbo%20Regional%20Council%20Financial%20Statements%202016-2017.pdf.aspx>
- `gpfs-2017-18` — <https://www.dubbo.nsw.gov.au/ArticleDocuments/11102/Dubbo%20Regional%20Council%20Financial%20Statements%202017-2018.pdf.aspx>
- `gpfs-2018-19` — <https://www.dubbo.nsw.gov.au/ArticleDocuments/11102/Dubbo%20Regional%20Council%20-%20Financial%20Statements%202018-19.pdf.aspx>
- `gpfs-2019-20` — <https://www.dubbo.nsw.gov.au/ArticleDocuments/11102/Dubbo%20Regional%20Council%20-%20%20Annual%20Financial%20Statements%202019%202020%20-%20Annual%20Report%20(1).pdf.aspx>
- `gpfs-2020-21` — <https://www.dubbo.nsw.gov.au/ArticleDocuments/11102/Dubbo%20Regional%20Council%20-%20Annual%20Financial%20Statements%20-2020-2021%20(3).pdf.aspx>
- `gpfs-2021-22` — <https://www.dubbo.nsw.gov.au/ArticleDocuments/11102/Dubbo%20Regional%20Council%20-%20Annual%20Financial%20Statements%202021-2022%20(1).pdf.aspx>
- `gpfs-2022-23` — <https://www.dubbo.nsw.gov.au/ArticleDocuments/11102/Dubbo%20Regional%20Council%20-%20Annual%20Financial%20Statements-%20%202022-2023%20(1).pdf.aspx>
- `gpfs-2023-24` — <https://www.dubbo.nsw.gov.au/ArticleDocuments/11102/2023-2024%20Dubbo%20Regional%20Council%20Financial%20Statements.pdf.aspx>
- `gpfs-2024-25` — <https://www.dubbo.nsw.gov.au/ArticleDocuments/11102/20242025%20-%20Annual%20Financial%20Statements%20-%20Final%20for%20website.PDF.aspx>
- `gpfs-2025-26` — <https://www.dubbo.nsw.gov.au/ArticleDocuments/11102/2025-2026%20Annual%20Financial%20Statements%20-%20Dubbo%20Regional%20Council.pdf.aspx>
- `resourcing-strategy-2025-29` — <https://www.dubbo.nsw.gov.au/ArticleDocuments/290/Previous%202025-2029%20Resourcing%20Strategy%20(adopted%2022062025).PDF.aspx>

## 4. Deep verify — current/recent GPFS

All figures below are printed in `$'000`; no scaling or arithmetic was applied to the source numbers. The components are shown so the printed total can be re-added by a reviewer.

### FY2023-24

- document: <https://www.dubbo.nsw.gov.au/ArticleDocuments/11102/2023-2024%20Dubbo%20Regional%20Council%20Financial%20Statements.pdf.aspx>
- sha256: `3c2ee369960e0a78fece6716638bfa4628487445105948de65c3cc8deb0d66fe`
- printed pages: Income Statement p.5, B1-1 p.15 (PDF page numbers)
- proposed: source_id `dubbo-council-gpfs`, fiscal_year `2023-24`, measure_type `actual`

| printed line                                                | FY actual ($'000) |
| ----------------------------------------------------------- | ----------------: |
| Total income from continuing operations                     |           210,896 |
| Total expenses (incl. depreciation/amortisation/impairment) |           181,317 |
| Net operating result for the year                           |            29,579 |
| Employee benefits and on-costs                              |            49,340 |
| Depreciation, amortisation and impairment                   |            58,525 |
| Grants and contributions — operating                        |            32,079 |
| Grants and contributions — capital                          |            33,122 |
| Grants and contributions — total                            |            65,201 |

Reconciliation:

- revenue: 74,641 + 54,418 + 3,505 + 32,079 + 33,122 + 12,971 + 160 = **210,896**
- expenses: 49,340 + 63,102 + 3,037 + 58,525 + 2,824 + 4,489 = **181,317**
- net: 210,896 − 181,317 = **29,579**
- B1-1 Total functions and activities: income 210,896, expenses 181,317, result 29,579, grants 65,201 — **matches the face statement**.
- checks: revenue components = 210,896; expense components = 181,317; 210,896 - 181,317 = 29,579; B1-1 income/expenses/result/grants equal face statement.

### FY2024-25

- document: <https://www.dubbo.nsw.gov.au/ArticleDocuments/11102/20242025%20-%20Annual%20Financial%20Statements%20-%20Final%20for%20website.PDF.aspx>
- sha256: `d9213cea468547a318548dfd72d7faa0d9fd2da81bcf6835138d10b58914a43f`
- printed pages: Income Statement p.5, B1-1 p.14 (PDF page numbers)
- proposed: source_id `dubbo-council-gpfs`, fiscal_year `2024-25`, measure_type `actual`

| printed line                                                  | FY actual ($'000) |
| ------------------------------------------------------------- | ----------------: |
| Total income from continuing operations                       |           234,927 |
| Total expenses (incl. depreciation/amortisation/impairment)   |           174,925 |
| Net operating result for the year                             |            60,002 |
| Employee benefits and on-costs                                |            49,204 |
| Depreciation, amortisation and impairment                     |            57,859 |
| Grants and contributions — operating                          |            20,061 |
| Grants and contributions — capital                            |            59,726 |
| Grants and contributions — total                              |            79,787 |
| Total expenses excluding depreciation/amortisation/impairment |           117,066 |

Reconciliation:

- revenue: 80,278 + 55,081 + 5,223 + 20,061 + 59,726 + 14,365 + 193 = **234,927**
- expenses excl. D&A: 49,204 + 59,076 + 871 + 2,880 + 5,035 = **117,066**
- total expenses: 117,066 + 57,859 = **174,925**
- net: 234,927 − 174,925 = **60,002**
- B1-1 Total functions and activities: income 234,927, expenses 174,925, result 60,002, grants 79,787 — **matches the face statement**.
- checks: revenue components = 234,927; expenses excl. D&A = 117,066; 117,066 + 57,859 = 174,925; 234,927 - 174,925 = 60,002; B1-1 income/expenses/result/grants equal face statement; OLG FY2024-25 anchor 234,927 revenue / 174,925 expenses matched (existing constant).

### FY2025-26

- document: <https://www.dubbo.nsw.gov.au/ArticleDocuments/11102/2025-2026%20Annual%20Financial%20Statements%20-%20Dubbo%20Regional%20Council.pdf.aspx>
- sha256: `b6f52c9377952c6d72d011cda4c1cc0fda16c3aff32d501a05a263e3fd7d4fb5`
- printed pages: Income Statement p.5, B1-1 p.14 (PDF page numbers)
- proposed: source_id `dubbo-council-gpfs`, fiscal_year `2025-26`, measure_type `actual`

| printed line                                                  | FY actual ($'000) |
| ------------------------------------------------------------- | ----------------: |
| Total income from continuing operations                       |           226,358 |
| Total expenses (incl. depreciation/amortisation/impairment)   |           180,330 |
| Net operating result for the year                             |            46,028 |
| Employee benefits and on-costs                                |            57,396 |
| Depreciation, amortisation and impairment                     |            61,576 |
| Grants and contributions — operating                          |            30,491 |
| Grants and contributions — capital                            |            28,315 |
| Grants and contributions — total                              |            58,806 |
| Total expenses excluding depreciation/amortisation/impairment |           118,754 |
| Net gain from disposal of assets (revenue line)               |               864 |

Reconciliation:

- revenue: 84,034 + 63,474 + 4,312 + 30,491 + 28,315 + 14,696 + 172 + 864 = **226,358**
- expenses excl. D&A: 57,396 + 56,028 + 2,458 + 2,872 + 0 = **118,754**
- total expenses: 118,754 + 61,576 = **180,330**
- net: 226,358 − 180,330 = **46,028**
- B1-1 Total functions and activities: income 226,358, expenses 180,330, result 46,028, grants 58,806 — **matches the face statement**.
- checks: revenue components incl. net gain on disposal = 226,358; expenses excl. D&A = 118,754; 118,754 + 61,576 = 180,330; 226,358 - 180,330 = 46,028; B1-1 income/expenses/result/grants equal face statement.

## 5. Overlap and double-count rules

- **GPFS face vs B1-1:** the face income statement is the control total; B1-1 is the same income/expenses/grants cut by function. Emit one cut or the other, never add them.
- **GPFS vs annual report:** the annual report restates or summarises the same year. Use the standalone GPFS; do not add annual-report figures.
- **GPFS vs budget/forward estimate:** budget documents are `measure_type=budget` and cover different periods. Never sum with actuals.
- **Former Dubbo City vs former Wellington City vs Dubbo Regional Council:** three separate entities around amalgamation. Never add the former-council FY2015-16 statements to each other or to the current council series.
- **Cross-council:** no sum across councils is computed or implied by this packet.
- **FY2016-17 period:** 13 May 2016 to 30 June 2017 (post-amalgamation partial period) with amalgamation gain/transfer lines; not a normal comparative year.

## 6. Parser feasibility and proposed IDs

- `dubbo-council-gpfs` already discovers the reporting page by link text and can select any fiscal year through `selectDubboGpfsDocument(..., fiscalYear)`. **Discovery is year-parameterisable.**
- The parse/emit path is not yet year-parameterised: `mapLine` and `dubboGpfsNaturalKey` default to the `DUBBO_GPFS_FISCAL_YEAR` constant, and `DUBBO_GPFS_LINES` encodes the FY2024-25 layout.
- **FY2024-25:** supported by the existing module without change.
- **FY2023-24:** variant required — the face prints one `Total expenses from continuing operations` (181,317) and a `Net loss from the disposal of assets` line; the existing parser expects the FY2024-25 `excluding depreciation` label.
- **FY2025-26:** variant required — the face adds a `Net gain from the disposal of assets` revenue line (864) and prints the loss line at nil; the existing revenue sum would miss 864 and reconciliation would fail.
- **FY2016-17 to FY2022-23:** deferred pending per-year layout review (deep-verified with printed totals and anchors in §10; each year still needs its own layout spec in the builder). FY2016-17 is also a partial period and prints an amalgamation net-result trap.
- Recommendation: keep **one** source id `dubbo-council-gpfs` and add a per-year layout spec plus `fiscal_year` on the parse context. Do not create per-year source ids; natural keys already include the fiscal year.

## 7. Builder-ready brief

- **target:** Extend dubbo-council-gpfs to FY2023-24 and FY2025-26 (and optionally earlier years) with one council only.
- **input:** Archived PDF path and SHA-256 from this packet; discover the document from the reporting page by fiscal year (no hard-coded document URL).
- **unit gate:** Require the printed $'000 header. Reject if absent.
- **face lines:** Select lines by exact printed labels; add a per-year layout spec rather than one global line list.
- **reconciliation:** Sum printed revenue components to the printed total income; sum printed expense components (including the printed D&A line) to the printed total expenses; compare both with B1-1 Total functions and activities (income, expenses, result, grants). Refuse ingestion on any mismatch.
- **external anchor:** Use the existing OLG FY2024-25 revenue/expense anchors where the year matches; do not invent anchors for other years.
- **rows:** Emit non-additive agency_detail actual rows for total revenue, total expenses, net result, employee expenses, D&A and grant components; never create region/LGA allocation and never sum across councils or across measure types.
- **tests:** Golden-file tests from the archived byte sequence for each supported year, including a rejection test for the wrong layout and a unit-missing test.

## 8. Licence / attribution

© Dubbo Regional Council. Council states it owns or licenses all site content; sharing is supported for private study, research, criticism or review, and commercial reproduction/reuse is not permitted. Not an open-data licence grant.

Archived bytes are retained for public-interest research and verification only; the archive path is outside the repository and only metadata/SHA is committed.

## 9. Archive manifest (exact bytes and SHA-256)

| source_id                     | local path                                                                         |       bytes | sha256                                                             |
| ----------------------------- | ---------------------------------------------------------------------------------- | ----------: | ------------------------------------------------------------------ |
| `annual-report-2017-18`       | `~/ausspend-source-archive/dubbo-regional/2017-18/annual-report-2017-18.pdf`       |  13,865,318 | `d4cefd3a709ce45f5106e236d4f4c8e362a23cccf440c98678e6938c16669fa3` |
| `annual-report-2018-19`       | `~/ausspend-source-archive/dubbo-regional/2018-19/annual-report-2018-19.pdf`       |  19,985,731 | `871583d8931e5a7b1e31c8e767e7f30e69d6f88f2bdaf0ff9d94f69a95c36c18` |
| `annual-report-2019-20`       | `~/ausspend-source-archive/dubbo-regional/2019-20/annual-report-2019-20.pdf`       | 135,183,790 | `8a2ad13f57271dd2811947aea73629459915be96b9c31e9d0e308ce11317fca5` |
| `annual-report-2020-21`       | `~/ausspend-source-archive/dubbo-regional/2020-21/annual-report-2020-21.pdf`       |   3,024,831 | `ab5d7c57a7a887aaffc7685d942d6477779064845ba743bd0dd759cb8e0fa874` |
| `annual-report-2021-22`       | `~/ausspend-source-archive/dubbo-regional/2021-22/annual-report-2021-22.pdf`       |   3,462,635 | `2616bacb8e025afa8d844dd3b044db164e914063c897238d8677118c1e9614db` |
| `annual-report-2022-23`       | `~/ausspend-source-archive/dubbo-regional/2022-23/annual-report-2022-23.pdf`       |  11,801,840 | `1e5c0ec278a8feed7bd4b8e0286771e5710a6fd8608f3b4a99fed3e2b54a758a` |
| `annual-report-2023-24`       | `~/ausspend-source-archive/dubbo-regional/2023-24/annual-report-2023-24.pdf`       |  20,292,766 | `f9622420d0c3a76e586f8a3c8826d4e41ee6b6e62a2a9681db8f7ec70ca6f154` |
| `annual-report-2024-25`       | `~/ausspend-source-archive/dubbo-regional/2024-25/annual-report-2024-25.pdf`       |   7,545,151 | `8881e06aecb66d9b1df3977e600ad76e20540dd953cc2fb06eaf4032a1b1e790` |
| `annual-report-2025-26`       | `~/ausspend-source-archive/dubbo-regional/2025-26/annual-report-2025-26.pdf`       |   5,846,833 | `07b3ef349d1bde063d8e29ce4d901d9901efba3e12c4031f8e68711511ce0896` |
| `budget-2025-29`              | `~/ausspend-source-archive/dubbo-regional/2025-26/budget-2025-29.pdf`              |   1,054,461 | `79d6b40887755530dff3a8fd082dd728a2a4fd83c872fb8f3de75804792260d5` |
| `budget-2026-27`              | `~/ausspend-source-archive/dubbo-regional/2026-27/budget-2026-27.pdf`              |     615,350 | `0b527aae6088c850b4ad4307ca9e513d30b9d9e14859503ea61a937e41751123` |
| `dpop-2025-29`                | `~/ausspend-source-archive/dubbo-regional/2025-26/dpop-2025-29.pdf`                |   4,935,346 | `10e808ee41c0bcdf1a61c3faab9fd498baa9995d04e482428d8d7dd0e195361b` |
| `former-dubbo-2015-16`        | `~/ausspend-source-archive/dubbo-regional/2015-16/former-dubbo-2015-16.pdf`        |   5,822,888 | `b74a17854409ef56d97504130ced20cdccb6d081d4475ca7b79f5bd6e842dc53` |
| `former-wellington-2015-16`   | `~/ausspend-source-archive/dubbo-regional/2015-16/former-wellington-2015-16.pdf`   |   3,136,063 | `ded763340e54e269a26b0cdb572ae05573418f647057432d50560112c71ae964` |
| `gpfs-2016-17`                | `~/ausspend-source-archive/dubbo-regional/2016-17/gpfs-2016-17.pdf`                |   2,404,714 | `0379e3a81a856d7320c1923303ec7a893ec4ab0658feda2013624301bc9fa88b` |
| `gpfs-2017-18`                | `~/ausspend-source-archive/dubbo-regional/2017-18/gpfs-2017-18.pdf`                |   3,036,559 | `1ca80eb0981aedc442dcea94745a28ed4312bfa86b3c4348614a0402ebf02dfd` |
| `gpfs-2018-19`                | `~/ausspend-source-archive/dubbo-regional/2018-19/gpfs-2018-19.pdf`                |   5,224,896 | `f95027b5bcaf2dc12e9f9b9c752170f2694d88c15b07f170dbda761d5d2034ea` |
| `gpfs-2019-20`                | `~/ausspend-source-archive/dubbo-regional/2019-20/gpfs-2019-20.pdf`                |   6,841,185 | `d42c0ee29172672a693c0878a83a8c48d5b46c80881bc247f3f61b9f2e8c277e` |
| `gpfs-2020-21`                | `~/ausspend-source-archive/dubbo-regional/2020-21/gpfs-2020-21.pdf`                |   2,637,455 | `69a7b9cb99774a63b845bdb85950265a870246ce0c1f82a3929c2642244aab9b` |
| `gpfs-2021-22`                | `~/ausspend-source-archive/dubbo-regional/2021-22/gpfs-2021-22.pdf`                |   3,891,387 | `d28778f441953f17b01e78b2797c8bac9e34b1e42b94ba1777d7a922516a6153` |
| `gpfs-2022-23`                | `~/ausspend-source-archive/dubbo-regional/2022-23/gpfs-2022-23.pdf`                |   3,665,534 | `b663ddc3a8a5fca8f1887de978a1df7d1cecd24550815fdc7c1c64209074212a` |
| `gpfs-2023-24`                | `~/ausspend-source-archive/dubbo-regional/2023-24/gpfs-2023-24.pdf`                |   2,677,519 | `3c2ee369960e0a78fece6716638bfa4628487445105948de65c3cc8deb0d66fe` |
| `gpfs-2024-25`                | `~/ausspend-source-archive/dubbo-regional/2024-25/gpfs-2024-25.pdf`                |   1,807,768 | `d9213cea468547a318548dfd72d7faa0d9fd2da81bcf6835138d10b58914a43f` |
| `gpfs-2025-26`                | `~/ausspend-source-archive/dubbo-regional/2025-26/gpfs-2025-26.pdf`                |   2,940,971 | `b6f52c9377952c6d72d011cda4c1cc0fda16c3aff32d501a05a263e3fd7d4fb5` |
| `resourcing-strategy-2025-29` | `~/ausspend-source-archive/dubbo-regional/2025-26/resourcing-strategy-2025-29.pdf` |   4,844,520 | `eeb940b09ad19b786dffe4ee7892084f56ae784e47ad077c1a278371bcf5332c` |

All 25 files were re-hashed from the archive on write; `SHA256SUMS` matches the table above. The FY2024-25 GPFS SHA-256 `d9213cea468547a318548dfd72d7faa0d9fd2da81bcf6835138d10b58914a43f` is the same hash already pinned in the `dubbo-council-gpfs` fixture.

## 10. Historical deep verify — FY2015-16 to FY2022-23

This section extends the packet to the historical series. It adds no connector, DB or `measures` write. Every figure below is printed in `$'000`; nothing is scaled, derived or summed across entities.

### 10.0 Method and re-verification

- Each historical PDF was re-downloaded from the reporting-page URL, and its exact bytes and SHA-256 were compared with the archive manifest in §9: **9/9 matched**, so the archived bytes are the bytes read here.
- Text was extracted with `pdfjs-dist` in row-aware mode (items grouped by page y-position and sorted by x); no OCR. Values were read only from the printed income statement and, where present, the printed B1-1 `Total functions and activities` row.
- The printed unit header is `$ '000` on every historical income statement; none is rejected by the unit gate.
- Reconciliation below re-adds the printed components of each face statement, then compares the printed total income, total expenses and operating result with the printed B1-1 anchor where one exists.

### 10.1 Former councils — FY2015-16 (pre-amalgamation, rejected as council actuals)

Both are predecessor entities with a **1 July 2015 to 12 May 2016** partial period. They are separate from each other and from Dubbo Regional Council, and are **never added together or to the current council series**. Historical context only.

| source_id                   | entity                    | period           | printed unit | revenue ($'000) | expenses ($'000) | net result ($'000) | income stmt (PDF p.) | B1-1         |
| --------------------------- | ------------------------- | ---------------- | ------------ | --------------: | ---------------: | -----------------: | -------------------- | ------------ |
| `former-dubbo-2015-16`      | former Dubbo City Council | 1/7/15 – 12/5/16 | `$'000`      |         117,764 |           79,926 |             37,838 | p.5                  | none printed |
| `former-wellington-2015-16` | former Wellington Council | 1/7/15 – 12/5/16 | `$'000`      |          25,366 |           20,143 |              5,223 | p.5                  | p.30         |

- `former-dubbo-2015-16`: revenue 41,871 + 32,961 + 3,700 + 976 + 13,964 + 22,494 + 1,778 + 20 = **117,764**; expenses 24,892 + 3,673 + 19,522 + 21,364 + 10,475 = **79,926**; 117,764 − 79,926 = **37,838**. No by-function/B1-1 note is printed, so the income statement is the only anchor.
- `former-wellington-2015-16`: revenue 8,464 + 5,376 + 792 + 341 + 7,611 + 2,633 + 145 + 4 = **25,366**; expenses 6,588 + 558 + 5,009 + 5,904 + 0 + 2,084 = **20,143**; 25,366 − 20,143 = **5,223**. B1-1 anchor: total functions 15,039 + share of associates 4 + general purpose income 10,323 = 25,366 income; expenses 20,143; result 5,224 (one-dollar rounding vs face 5,223).
- Neither former-council statement is a `Dubbo Regional Council` actual and neither may seed the council series.

### 10.2 Dubbo Regional Council GPFS — FY2016-17 to FY2022-23

All seven are standalone audited GPFS with printed `$'000`, printed total income, total expenses and an operating result. They form the council-wide actual series for these years.

| source_id      | FY      | period            | revenue ($'000) | expenses ($'000) | operating result ($'000) | income stmt (PDF p.) | B1-1 (PDF p.) | B1-1 vs face |
| -------------- | ------- | ----------------- | --------------: | ---------------: | -----------------------: | -------------------- | ------------- | ------------ |
| `gpfs-2016-17` | 2016-17 | 13/5/16 – 30/6/17 |         201,796 |          140,525 |                   61,271 | p.4                  | p.25          | +$1 rounding |
| `gpfs-2017-18` | 2017-18 | 1/7/17 – 30/6/18  |         213,627 |          122,281 |                   91,346 | p.4                  | p.13          | equal        |
| `gpfs-2018-19` | 2018-19 | 1/7/18 – 30/6/19  |         184,140 |          136,358 |                   47,782 | p.5                  | p.15          | equal        |
| `gpfs-2019-20` | 2019-20 | 1/7/19 – 30/6/20  |         169,828 |          145,084 |                   24,744 | p.4                  | p.13          | equal        |
| `gpfs-2020-21` | 2020-21 | 1/7/20 – 30/6/21  |         186,754 |          149,630 |                   37,124 | p.4                  | p.14          | **+188**     |
| `gpfs-2021-22` | 2021-22 | 1/7/21 – 30/6/22  |         192,666 |          152,220 |                   40,446 | p.5                  | p.15          | equal        |
| `gpfs-2022-23` | 2022-23 | 1/7/22 – 30/6/23  |         213,640 |          162,924 |                   50,716 | p.5                  | p.15          | equal        |

Per-year printed reconciliation (components in `$'000`):

- **FY2016-17** — revenue 59,787 + 55,912 + 6,291 + 1,778 + 37,994 + 36,155 + 3,696 + 183 = **201,796**; expenses 43,183 + 5,215 + 38,940 + 35,131 + 18,056 = **140,525**; 201,796 − 140,525 = **61,271**. B1-1: total functions 149,245 + share 183 + general purpose 52,369 = 201,797; expenses 140,525; result 61,272. **Trap:** the face also prints an amalgamation gain/asset transfer of 2,266,670 and a resulting `Net result for the period` of **2,327,941**. That is not an operating total and must never be ingested as the year result.
- **FY2017-18** — revenue 56,909 + 54,445 + 6,494 + 1,359 + 30,703 + 60,804 + 2,762 + 151 = **213,627**; expenses 37,187 + 5,682 + 32,936 + 30,407 + 16,069 = **122,281**; 213,627 − 122,281 = **91,346**. B1-1 income 213,627, expenses 122,281, result 91,346, grants 53,226 — equal.
- **FY2018-19** — revenue 62,438 + 46,393 + 6,834 + 1,934 + 18,610 + 47,179 + 703 + 49 = **184,140**; expenses 40,104 + 4,435 + 35,017 + 39,902 + 16,900 = **136,358**; 184,140 − 136,358 = **47,782**. B1-1 income 184,140, expenses 136,358, result 47,782, grants 44,452 — equal.
- **FY2019-20** — revenue 64,587 + 42,455 + 1,986 + 21,858 + 33,077 + 5,716 + 0 + 149 = **169,828**; expenses 45,200 + 3,691 + 36,364 + 42,261 + 15,075 + 2,493 = **145,084**; 169,828 − 145,084 = **24,744**. B1-1 income 169,828, expenses 145,084, result 24,744, grants 35,142 — equal.
- **FY2020-21** — revenue 66,845 + 39,776 + 2,628 + 22,054 + 48,265 + 3,703 + 37 + 3,446 = **186,754**; expenses 44,932 + 53,696 + 3,095 + 45,551 + 2,356 + 0 = **149,630**; 186,754 − 149,630 = **37,124**. B1-1 prints income 186,942 and result 37,312, both **188 higher** than the face. Reconcile to the face statement and treat the 188 as unexplained until resolved; do not assume B1-1 equality.
- **FY2021-22** — revenue 69,356 + 39,771 + 5,062 + 26,053 + 49,260 + 3,006 + 158 + 0 = **192,666**; expenses 44,485 + 46,710 + 2,981 + 48,457 + 2,438 + 7,149 = **152,220**; 192,666 − 152,220 = **40,446**. B1-1 income 192,666, expenses 152,220, result 40,446, grants 75,313 — equal.
- **FY2022-23** — revenue 72,492 + 44,916 + 3,405 + 28,542 + 56,552 + 7,662 + 71 = **213,640**; expenses 47,319 + 51,966 + 2,995 + 54,323 + 3,045 + 3,276 = **162,924**; 213,640 − 162,924 = **50,716**. B1-1 income 213,640, expenses 162,924, result 50,716, grants 85,094 — equal.

### 10.3 Overlap and traps (historical)

- **Own-year GPFS only:** each year must be read from its own GPFS. Do not ingest a later report's restated comparative (e.g. FY2016-17 restated inside FY2017-18) as the earlier year.
- **Annual reports:** the FY2017-18..FY2022-23 annual reports restate/summarise the same-year GPFS and remain rejected as totals sources (§3.2).
- **Budget/forward estimates:** budget documents are `measure_type=budget`; never summed with these actuals.
- **Former councils:** FY2015-16 former Dubbo (117,764 / 79,926) and former Wellington (25,366 / 20,143) are predecessor partial periods; never add them to each other or to any Dubbo Regional Council year.
- **Amalgamation:** FY2016-17 is a 13 May 2016 – 30 June 2017 partial period; the 2,266,670 amalgamation transfer is excluded from the operating result.
- **FY2020-21 B1-1:** income/result are 188 above the face; reconcile to the face.

### 10.4 Parser feasibility (historical)

- **FY2016-17:** variant required — split label/number columns in extracted text; partial period; must select `Operating result from continuing operations` (61,271) and must not select `Net result for the period` (2,327,941).
- **FY2017-18:** variant required — split label/number columns; three printed columns (budget, actual, restated prior); select the Actual current-year column.
- **FY2018-19:** inline label/number rows; three columns (budget, actual, restated prior); select Actual current-year.
- **FY2019-20:** inline rows; adds a `Net losses from the disposal of assets` expense line (2,493) and a nil disposal-gain revenue line.
- **FY2020-21:** revised labels (`Other revenue`, `Materials and services`, `Depreciation, amortisation and impairment for non-financial assets`); B1-1 differs from face by 188.
- **FY2021-22:** disposal-loss expense line 7,149; B1-1 equals face.
- **FY2022-23:** disposal-loss expense line 3,276; no disposal revenue line; B1-1 equals face.
- **Former councils:** not builder-ready as council actuals; predecessor partial periods. Keep as rejected context unless a predecessor series is explicitly scoped.

### 10.5 Builder-ready brief (historical)

- **target:** extend `dubbo-council-gpfs` to FY2016-17..FY2022-23 with one council and a per-year layout spec.
- **input:** archived PDF path and SHA-256 from §10.6; discover the document from the reporting page by fiscal year (no hard-coded document URL).
- **unit gate:** require the printed `$'000` header on the income statement page; reject if absent.
- **face lines:** select labels per year; FY2016-17/FY2017-18 use split label/number columns, FY2018-19..FY2022-23 inline rows, FY2020-21+ revised labels.
- **result line:** for FY2016-17 use the operating result (61,271), never the net result after amalgamation (2,327,941).
- **reconciliation:** sum printed revenue components to printed total income and printed expense components to printed total expenses; compare with the printed operating result and with B1-1 where B1-1 equals the face. Refuse on mismatch or unexplained B1-1 difference.
- **rows:** non-additive `agency_detail` actual rows for total revenue, total expenses, net result, employee expenses, D&A and grant components; never allocate to region/LGA and never sum across councils, predecessor entities or measure types.
- **tests:** per-year golden-file tests from the archived bytes, plus rejection tests for missing unit, wrong layout and the FY2016-17 amalgamation net-result trap.

### 10.6 Historical archive re-verification

All paths are outside the repository under `~/ausspend-source-archive/dubbo-regional/`. Each file was re-downloaded on 2026-11-18 and matched the manifest SHA-256 exactly; bytes are the archived byte counts.

| source_id                   | local path                                                                       |     bytes | sha256                                                             |
| --------------------------- | -------------------------------------------------------------------------------- | --------: | ------------------------------------------------------------------ |
| `former-dubbo-2015-16`      | `~/ausspend-source-archive/dubbo-regional/2015-16/former-dubbo-2015-16.pdf`      | 5,822,888 | `b74a17854409ef56d97504130ced20cdccb6d081d4475ca7b79f5bd6e842dc53` |
| `former-wellington-2015-16` | `~/ausspend-source-archive/dubbo-regional/2015-16/former-wellington-2015-16.pdf` | 3,136,063 | `ded763340e54e269a26b0cdb572ae05573418f647057432d50560112c71ae964` |
| `gpfs-2016-17`              | `~/ausspend-source-archive/dubbo-regional/2016-17/gpfs-2016-17.pdf`              | 2,404,714 | `0379e3a81a856d7320c1923303ec7a893ec4ab0658feda2013624301bc9fa88b` |
| `gpfs-2017-18`              | `~/ausspend-source-archive/dubbo-regional/2017-18/gpfs-2017-18.pdf`              | 3,036,559 | `1ca80eb0981aedc442dcea94745a28ed4312bfa86b3c4348614a0402ebf02dfd` |
| `gpfs-2018-19`              | `~/ausspend-source-archive/dubbo-regional/2018-19/gpfs-2018-19.pdf`              | 5,224,896 | `f95027b5bcaf2dc12e9f9b9c752170f2694d88c15b07f170dbda761d5d2034ea` |
| `gpfs-2019-20`              | `~/ausspend-source-archive/dubbo-regional/2019-20/gpfs-2019-20.pdf`              | 6,841,185 | `d42c0ee29172672a693c0878a83a8c48d5b46c80881bc247f3f61b9f2e8c277e` |
| `gpfs-2020-21`              | `~/ausspend-source-archive/dubbo-regional/2020-21/gpfs-2020-21.pdf`              | 2,637,455 | `69a7b9cb99774a63b845bdb85950265a870246ce0c1f82a3929c2642244aab9b` |
| `gpfs-2021-22`              | `~/ausspend-source-archive/dubbo-regional/2021-22/gpfs-2021-22.pdf`              | 3,891,387 | `d28778f441953f17b01e78b2797c8bac9e34b1e42b94ba1777d7a922516a6153` |
| `gpfs-2022-23`              | `~/ausspend-source-archive/dubbo-regional/2022-23/gpfs-2022-23.pdf`              | 3,665,534 | `b663ddc3a8a5fca8f1887de978a1df7d1cecd24550815fdc7c1c64209074212a` |

No historical year is rejected for a missing unit or missing printed total; the two former-council statements are rejected as council actuals because they are predecessor entities, not because their printed totals are absent.
