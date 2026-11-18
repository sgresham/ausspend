/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
/**
 * Text and coordinate items extracted from the audited North Sydney Council
 * FY2024-25 General Purpose Financial Statements (83-page PDF). Kept as literal
 * extracted text/items so the parser is tested against the printed layout, not a
 * hand-built object.
 *
 * The Income Statement prints the Original unaudited budget amount before the
 * line label in the PDF text stream; the FY2024-25 actual and FY2023-24 follow
 * the label.
 */
export const INCOME_TEXT = `North Sydney Council | Income Statement | for the year ended 30 June 2025
North Sydney Council
Income Statement
for the year ended 30 June 2025
Original unaudited budget Actual Actual
2025 $ '000 Notes 2025 2024
Income from continuing operations
79,066 Rates and annual charges B2-1 79,820 75,559
36,774 User charges and fees B2-2 30,734 32,134
10,216 Other revenues B2-3 13,967 10,239
4,666 Grants and contributions provided for operating purposes B2-4 4,869 5,453
3,058 Grants and contributions provided for capital purposes B2-4 13,909 16,690
2,665 Interest and investment income 5,759 5,612
5,887 Other income B2-6 5,522 5,970
142,332 Total income from continuing operations 154,580 151,657
Expenses from continuing operations
55,651 Employee benefits and on-costs B3-1 48,080 49,118
53,337 Materials and services B3-2 52,555 51,176
2,382 Borrowing costs 2,365 1,497
4,783 Other expenses B3-5 5,108 7,269
277 Net loss from the disposal of assets 883 1,304
– Net share of interests in joint ventures and associates using the equity method 1 –
116,430 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 108,992 110,364
25,902 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 45,588 41,293
31,095 Depreciation, amortisation and impairment of non-financial assets B3-4 30,411 28,240
(5,193) Operating result from continuing operations 15,177 13,053
(5,193) Net operating result for the year attributable to Council 15,177 13,053
(8,251) Net operating result for the year before grants and contributions provided for capital purposes 1,268 (3,637)`;
export const COMPREHENSIVE_TEXT = `North Sydney Council
Statement of Comprehensive Income
for the year ended 30 June 2025
$ '000 2025 2024
Net operating result for the year – from Income Statement 15,177 13,053
Other comprehensive income:
Amounts which will not be reclassified subsequent to operating result
Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-5 84,122 37,383
Total items which will not be reclassified subsequent to operating result 84,122 37,383
Total other comprehensive income for the year 84,122 37,383
Total comprehensive income for the year attributable to Council 99,299 50,436`;
// B1-1 is a horizontal layout: the total-column values are stacked by section
// and read by coordinates, not in text order. The header sits at x=255.8, y=61;
// the total values share x≈257 and run upward from y≈228 to y≈745.
export const FUNCTIONS_TEXT = `B1-1 Functions or activities – income, expenses and assets
Income, expenses and assets have been directly attributed to the following functions or activities.
$ '000 Functions or activities OPEN SPACE & INFRASTRUCTURE PLANNING & ENVIRONMENT CORPORATE SERVICES OFFICE OF THE CEO Total functions and activities (1)`;
export const FUNCTIONS_ITEMS = [
  { page_number: 18, str: 'Total functions and activities', x: 255.8, y: 61 },
  { page_number: 18, str: '154,580', x: 257, y: 228 },
  { page_number: 18, str: '151,657', x: 257, y: 281.9 },
  { page_number: 18, str: '139,403', x: 257, y: 345.6 },
  { page_number: 18, str: '138,604', x: 257, y: 399.5 },
  { page_number: 18, str: '15,177', x: 257, y: 468.1 },
  { page_number: 18, str: '13,053', x: 257, y: 522 },
  { page_number: 18, str: '18,778', x: 257, y: 585.7 },
  { page_number: 18, str: '22,143', x: 257, y: 639.6 },
  { page_number: 18, str: '1,910,155', x: 257, y: 691.1 },
  { page_number: 18, str: '1,802,265', x: 257, y: 745 },
];
export const DEPRECIATION_TEXT = `B3-4 Depreciation, amortisation and impairment of non-financial assets
Notes
$ '000 2025 2024
Depreciation and amortisation
Plant and equipment 1,898 1,831
Total depreciation and amortisation costs 29,086 28,240
Impairment / revaluation decrement of IPPE
Infrastructure: C1-5
- Capital Work In Progress 1,325 –
Total gross IPPE impairment / revaluation decrement costs 1,325 –`;
//# sourceMappingURL=north-sydney-gpfs.fixture.js.map
