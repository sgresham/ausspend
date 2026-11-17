/**
 * Text extracted from the audited Council of the City of Ryde FY2024-25
 * General Purpose Financial Statements (standalone PDF, 82 pages). Kept as
 * literal text so the parser is tested against the printed layout, not a
 * hand-built object.
 *
 * The Income Statement prints the Original unaudited budget column before the
 * line label in the PDF text stream; the FY2024-25 actual and FY2023-24 follow
 * the label. The budget amount for the next line therefore trails the previous
 * line's two actual amounts. This is the real extracted ordering, not a visual
 * row read.
 */
export const INCOME_TEXT = `Council of the City of Ryde
Income Statement
for the year ended 30 June 2025
Original unaudited budget Actual Actual
2025 $ '000 Notes 2025 2024
Income from continuing operations
115,569 Rates and annual charges B2-1 115,842 110,190 18,937
User charges and fees B2-2 19,770 18,144 7,443
Other revenues B2-3 7,319 6,866 6,293
Grants and contributions provided for operating purposes B2-4 5,133 6,596 14,637
Grants and contributions provided for capital purposes B2-4 42,063 54,691 9,987
Interest and investment income B2-5 16,624 13,625 5,468
Other income B2-6 8,710 5,672 638
Net gain from the disposal of assets B4-1 – – 178,972
Total income from continuing operations 215,461 215,784
Expenses from continuing operations 67,122
Employee benefits and on-costs B3-1 65,215 60,119 58,203
Materials and services B3-2 56,995 57,018 82
Borrowing costs B3-3 353 521 6,556
Other expenses B3-5 8,243 7,192
Net loss from the disposal of assets B4-1 17,882 2,220 131,963
Total expenses from continuing operations excluding
depreciation, amortisation and impairment of non-financial
assets 148,688 127,070 47,009
Operating result from continuing operations excluding
depreciation, amortisation and impairment of non-financial
assets 66,773 88,714 29,874
Depreciation, amortisation and impairment of non-financial
assets B3-4 30,119 29,321 17,135
Operating result from continuing operations 36,654 59,393 17,135
Net operating result for the year attributable to Council 36,654 59,393 2,498
Net operating result for the year before grants and contributions
provided for capital purposes (5,409) 4,702`;

export const COMPREHENSIVE_TEXT = `Council of the City of Ryde
Statement of Comprehensive Income
for the year ended 30 June 2025
$ '000 2025 2024
Net operating result for the year – from Income Statement 36,654 59,393
Other comprehensive income:
Amounts which will not be reclassified subsequent to operating result
Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-6 162,717 17,007
Total other comprehensive income for the year 162,717 17,007
Total comprehensive income for the year attributable to Council 199,371 76,400`;

export const FUNCTIONS_TEXT = `B1-1 Functions or activities – income, expenses and assets
Income, expenses and assets have been directly attributed to the following functions or activities.
Income Expenses Operating result Grants and contributions Carrying amount of assets
$ '000 2025 2024 2025 2024 2025 2024 2025 2024 2025 2024
Functions or activities
Catchment Waterway 1,099 720 8,605 7,541 (7,506) (6,821) 1,097 706 298,653 275,157
City Development 28,094 46,137 5,324 5,810 22,770 40,327 25,460 43,551 – –
City Economy 1 352 464 746 (463) (394) – 352 – –
City Sports and Recreation 13,234 9,434 20,819 20,822 (7,585) (11,388) 1,930 1,296 1,029,056 948,026
General purpose income 101,127 96,998 – – 101,127 96,998 3,206 4,155 – –
Total functions and activities 215,461 215,784 178,792 156,391 36,669 59,393 47,196 61,287 2,503,005 2,300,380`;

export const DEPRECIATION_TEXT = `B3-4 Depreciation, amortisation and impairment of non-financial assets
Notes
$ '000 2025 2024
Depreciation and amortisation
Plant and equipment 2,127 2,278
Office equipment 990 1,264
Total depreciation and amortisation costs 30,119 29,321
Total depreciation, amortisation and impairment of
non-financial assets 30,119 29,321`;
