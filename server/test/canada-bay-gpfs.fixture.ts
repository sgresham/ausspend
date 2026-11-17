/**
 * Text extracted from the audited City of Canada Bay Council FY2024-25 General
 * Purpose Financial Statements, which the council publishes inside its Annual
 * Report 2024-2025 PDF (pages 133, 134, 142 and 155 of that PDF). Kept as
 * literal extracted text so the parser is tested against the printed layout, not
 * a hand-built object.
 *
 * The Income Statement prints the Original unaudited budget amount before the
 * line label in the PDF text stream; the FY2024-25 actual and FY2023-24 follow
 * the label.
 */
export const INCOME_TEXT = `City of Canada Bay Council | Income Statement | for the year ended 30 June 2025
Original unaudited budget Actual Actual
2025 $ '000 Notes 2025 2024
Income from continuing operations
71,109 Rates and annual charges B2-1 71,585 67,310
21,590 User charges and fees B2-2 28,590 21,446
6,748 Other revenues B2-3 7,744 7,175
6,506 Grants and contributions provided for operating purposes B2-4 6,520 8,288
12,875 Grants and contributions provided for capital purposes B2-4 66,670 60,681
7,058 Interest and investment income B2-5 9,385 7,413
4,446 Other income B2-6 10,585 7,591
130,332 Total income from continuing operations 201,079 179,904
Expenses from continuing operations
50,555 Employee benefits and on-costs B3-1 51,227 45,409
41,407 Materials and services B3-2 44,170 42,229
587 Borrowing costs B3-3 588 633
7,180 Other expenses B3-5 12,379 7,126
– Net loss from the disposal of assets B4-1 3,684 3,881
99,729 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 112,048 99,278
30,603 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 89,031 80,626
17,528 Depreciation, amortisation and impairment of non-financial assets B3-4 18,953 17,763
13,075 Operating result from continuing operations 70,078 62,863
13,075 Net operating result for the year attributable to Council 70,078 62,863
200 Net operating result for the year before grants and contributions provided for capital purposes 3,408 2,182`;

export const COMPREHENSIVE_TEXT = `City of Canada Bay Council
Statement of Comprehensive Income
for the year ended 30 June 2025
$ '000 Notes 2025 2024
Net operating result for the year – from Income Statement 70,078 62,863
Other comprehensive income:
Amounts which will not be reclassified subsequent to operating result
Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-8 85,385 (79,456)
Total items which will not be reclassified subsequent to operating result 85,385 (79,456)
Total other comprehensive income for the year 85,385 (79,456)
Total comprehensive income for the year attributable to Council 155,463 (16,593)`;

// B1-1 prints the total row in text order: income 2025/2024, expenses
// 2025/2024, operating result 2025/2024, grants 2025/2024, carrying amount
// 2025/2024. The parser reads the 2025 values at indices 0, 2, 4 and 6; it never
// sums the function rows.
export const FUNCTIONS_TEXT = `City of Canada Bay Council
Notes to the Financial Statements 30 June 2025
B1-1 Functions or activities – income, expenses and assets
Income, expenses and assets have been directly attributed to the following functions or activities.
Income Expenses Operating result Grants and contributions Carrying amount of assets
$ '000 2025 2024 2025 2024 2025 2024 2025 2024 2025 2024
Connected community 25,875 19,146 44,782 36,898 (18,907) (17,752) 639 856 703,528 644,084
Sustainable and thriving environment 23,586 23,772 31,011 27,441 (7,425) (3,669) 4,196 5,514 153,897 121,629
Vibrant urban living 2,609 2,677 7,977 7,603 (5,368) (4,926) 789 275 1,976 2,533
Infrastructure and transport 9,836 11,877 30,387 29,848 (20,551) (17,971) 4,223 7,468 1,835,369 1,803,517
Civic leadership 139,173 122,432 16,844 15,251 122,329 107,181 63,343 54,856 349,042 304,256
Total functions and activities 201,079 179,904 131,001 117,041 70,078 62,863 73,190 68,969 3,043,812 2,876,019`;

export const DEPRECIATION_TEXT = `B3-4 Depreciation, amortisation and impairment of non-financial assets
$ '000 Notes 2025 2024
Depreciation and amortisation
Plant and equipment 793 688
Total gross depreciation and amortisation costs 18,953 17,763
Total depreciation and amortisation costs 18,953 17,763
Total depreciation, amortisation and impairment for non-financial assets 18,953 17,763`;
