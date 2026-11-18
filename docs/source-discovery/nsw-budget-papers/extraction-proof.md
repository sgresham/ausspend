# NSW Budget Papers — extraction proof (research only)

Representative proof that the current PDFs have a usable text layer and that a table can be
recovered deterministically. This is **not** a parser and **nothing** here is ingested.

## Source

- Paper: BP1 Budget Statement 2026-27
- URL: `https://www.nsw.gov.au/sites/default/files/noindex/2026-06/bp1-budget-statement-nsw-budget-2026-27.pdf`
- SHA-256: `cb9ecdf041747f271acba0ad2c425c5f3ae901383430d40811c6ad6ca594432b`
- PDF page 100 (printed page A-12)
- Tables: **A.7 General government sector expenses by function** and
  **A.8 General government sector purchases of non-financial assets by function**
- Printed unit: `$m`; columns: `2024-25 Actual`, `2025-26 Revised`, `2026-27 Budget`

## Method

Tool: `pdfjs-dist@6.5.438` legacy build on Node v24.14.1. Node and pdfjs were installed only in a
temporary, git-ignored directory (`.tmp-nsw-bp/`); no repo dependency or lockfile changed.

1. Read the PDF with `getDocument`.
2. `getPage(100).getTextContent()` returns text items with `transform[4]` (x) and `transform[5]` (y).
3. Group items whose y differs by <= 2.5 into visual rows.
4. Treat items with x < 300 as the row label; assign numeric items to the nearest of the three
   printed column anchors (x = 386.2, 445.4, 504.2).
5. Parse `(n)` as negative, `...` as null, strip thousands separators.
6. Stop at the next `Total` row. Reconcile the ten published function rows to the printed total.

Command used in the temporary directory:

```bash
export PATH="$HOME/.nvm/versions/node/v24.14.1/bin:$PATH"
node table-a7.mjs
```

The full sample JSON was written to the temporary directory as `table-a7.json` and was not
committed. The sandbox denied writes under `/tmp`, so temporary artefacts were held in the
git-ignored `.tmp-nsw-bp/` directory and removed before commit; the committed artefact is this
text excerpt plus `access-log.json`.

## Extracted rows (Table A.7)

```text
Function                        2024-25 Actual  2025-26 Revised  2026-27 Budget
General Public Services                 14,553           14,195          16,018
Defence                                    ...              ...             ...
Public Order and Safety                 12,283           13,098          12,904
Economic Affairs                         5,343            5,628           5,688
Environmental Protection                 1,872            1,598           2,208
Housing and Community Amenities          1,987            2,473           3,415
Health                                  32,170           34,860          36,320
Recreation, Culture and Religion         1,658            1,815           1,592
Education                               23,841           25,952          26,240
Social Protection                       11,608           12,113          11,171
Transport                               17,764           18,036          17,475
Total Expenses                         123,078          129,769         133,032
```

Reconciliation of the ten non-null function rows against the printed total:

```text
2024-25 Actual:  sum=123,079  total=123,078  diff=+1
2025-26 Revised: sum=129,768  total=129,769  diff=-1
2026-27 Budget:  sum=133,031  total=133,032  diff=-1
```

The +/-1 differences are consistent with rounding of published $m values; they are not an
extraction error. Table A.8 extracts the same way:

```text
General Public Services                   462    395    416
Public Order and Safety                 1,569  1,621  1,794
Economic Affairs                        1,133  1,048  1,314
Environmental Protection                  391    433    609
Housing and Community Amenities           136    135    304
Health                                  2,673  3,127  2,931
Recreation, Culture and Religion          138    312    328
Education                               2,644  3,314  2,804
Social Protection                         243    244    219
Transport                              12,235 12,294 11,157
Total Purchases                        21,623 22,924 21,876
```

## What this proves and what it does not

- Proves: the current official PDFs are downloadable, have a real text layer, and a fixed-layout
  expenditure table can be recovered and reconciled without OCR.
- Proves: the best whole-of-government expense table is a **COFOG function** table with **three
  years** (`Actual / Revised / Budget`), not a service-group table and not forward estimates.
- Does not prove: a service-group, sub-service-group, agency or program expenditure series exists
  in BP1/BP2/BP3. Those words/dimensions are absent (see the main report).
- Does not prove: BP3 project tables are equally easy. Table 4.1 uses dotted leaders and wrapped
  agency names; BP3 project tables have many columns and page-spanning rows.
