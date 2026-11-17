/**
 * Text extracted from the audited Cumberland City Council FY2024-25 General
 * Purpose Financial Statements, which the council publishes as its dedicated
 * "Annual Financial Statements 2024-2025" PDF (pages 5, 6, 14-15 and 28 of that
 * PDF). Kept as literal extracted text so the parser is tested against the
 * printed layout, not a hand-built object.
 *
 * The Income Statement prints the Original unaudited budget amount before the
 * line label in the PDF text stream; the FY2024-25 actual and FY2023-24 follow
 * the label.
 */
export const INCOME_TEXT = `Cumberland City Council | Income Statement | for the year ended 30 June 2025
Original unaudited budget Actual Actual
2025 $ '000 Notes 2025 2024
Income from continuing operations
171,039 Rates and annual charges B2-1 172,624 163,679
34,520 User charges and fees B2-2 34,536 33,120
7,786 Other revenues 9,184 8,183
18,970 Grants and contributions provided for operating purposes B2-3 16,225 19,807
27,058 Grants and contributions provided for capital purposes B2-3 26,185 45,441
9,195 Interest and investment income 14,138 12,453
2,717 Other income 4,247 5,317
150 Net gain from the disposal of assets – 1,323
271,435 Total income from continuing operations 277,139 289,323
Expenses from continuing operations
95,634 Employee benefits and on-costs B3-1 95,814 89,171
90,546 Materials and services B3-2 92,122 91,171
518 Borrowing costs 1,043 1,045
4,933 Other expenses 4,371 5,107
– Net loss from the disposal of assets 261 –
191,631 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 193,611 186,494
79,804 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 83,528 102,829
49,731 Depreciation, amortisation and impairment of non-financial assets B3-3 48,954 47,765
30,073 Operating result from continuing operations 34,574 55,064
30,073 Net operating result for the year attributable to Council 34,574 55,064
3,014 Net operating result for the year before grants and contributions provided for capital purposes 8,389 9,623`;

export const COMPREHENSIVE_TEXT = `Cumberland City Council
Statement of Comprehensive Income
for the year ended 30 June 2025
$ '000 Notes 2025 2024
Net operating result for the year – from Income Statement 34,574 55,064
Other comprehensive income:
Amounts which will not be reclassified subsequent to operating result
Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-6 48,015 93,864
Total items which will not be reclassified subsequent to operating result 48,015 93,864
Total other comprehensive income for the year 48,015 93,864
Total comprehensive income for the year attributable to Council 82,589 148,928`;

// B1-1 prints the total row in text order: income 2025/2024, expenses
// 2025/2024, operating result 2025/2024, grants 2025/2024, carrying amount
// 2025/2024. The parser reads the 2025 values at indices 0, 2, 4 and 6; it never
// sums the function rows. Cumberland prints expenses 242,564 and operating
// result 34,575, a published $1k rounding difference from the face statement.
export const FUNCTIONS_TEXT = `Cumberland City Council
Notes to the Financial Statements 30 June 2025
B1-1 Functions or activities – income, expenses and assets
Income, expenses and assets have been directly attributed to the following functions or activities.
Income Expenses Operating result Grants and contributions Carrying amount of assets
$ '000 2025 2024 2025 2024 2025 2024 2025 2024 2025 2024
Accounting 21,929 22,536 8,734 8,391 13,195 14,145 6,581 8,579 309,142 264,933
Rates 117,419 111,935 2,055 1,919 115,364 110,016 90 – 8,139 6,983
Waste Services 56,225 52,568 45,712 43,457 10,513 9,111 – – 4,413 3,975
Total functions and activities 277,139 289,323 242,564 234,259 34,575 55,064 42,410 65,248 3,515,615 3,436,479`;

export const DEPRECIATION_TEXT = `B3-3 Depreciation, amortisation and impairment of non-financial assets
$ '000 Notes 2025 2024
Depreciation and amortisation
Plant and equipment 1,194 1,260
Buildings 10,270 10,216
Roads 16,187 14,529
Total depreciation and amortisation costs 48,954 47,765
Total depreciation, amortisation and impairment for non-financial assets 48,954 47,765`;
