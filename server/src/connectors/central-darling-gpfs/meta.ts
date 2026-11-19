export const CENTRAL_DARLING_GPFS_ID = 'central-darling-gpfs';
export const CENTRAL_DARLING_GPFS_NAME =
  'Central Darling Shire Council — General Purpose Financial Statements';
export const CENTRAL_DARLING_GPFS_PUBLISHER = 'Central Darling Shire Council';

/**
 * Official public-notice page that publishes the audited FY2024-25 General
 * Purpose Financial Statements and the FY2025-26 presentation notice. The
 * council's host has the opposite WAF quirk to most NSW council sites: a plain
 * client UA gets HTTP 200 while a bare Chrome UA gets HTTP 403. The exact
 * official upload is therefore pinned and fetched with the plain client UA
 * through the browser helper (`scripts/central-darling-gpfs-browser.ts`).
 */
export const CENTRAL_DARLING_GPFS_REPORTING_URL =
  'https://www.centraldarling.nsw.gov.au/Public-notices/Presentation-of-Council-Financial-Statements-at-Council-meeting';

/**
 * Documented official pin: the FY2024-25 General Purpose Financial Statements
 * (year ended 30 June 2025), published on the official public-notice page as
 * `cdsc-annual_financial_statements-2025-olg.pdf`. It is the latest available
 * full audited GPFS as at 2026-11-20; the FY2025-26 document on the same page is
 * only a one-page presentation notice with a summary, so FY2024-25 is ingested
 * as the latest available audited year and the newer summary is not
 * substituted.
 */
export const CENTRAL_DARLING_GPFS_DOCUMENT_PIN =
  'https://www.centraldarling.nsw.gov.au/files/assets/public/v/1/finance-2025/financial-statements/cdsc-annual_financial_statements-2025-olg.pdf';
export const CENTRAL_DARLING_GPFS_STANDALONE_FS_BYTES = 3_386_192;
export const CENTRAL_DARLING_GPFS_STANDALONE_FS_SHA256 =
  'b583822dce9f5bac927d04dd60455f1de058f8542f990817839e3ed03c53b5c6';
export const CENTRAL_DARLING_GPFS_STANDALONE_FS_PAGES = 102;
export const CENTRAL_DARLING_GPFS_FISCAL_YEAR = '2024-25';
export const CENTRAL_DARLING_GPFS_SOURCE_DATASET = 'Central Darling Shire Council GPFS 2024-25';
export const CENTRAL_DARLING_GPFS_LICENSE =
  '© Central Darling Shire Council. Published council documents used here for public-interest research; not an open-data licence grant.';
export const CENTRAL_DARLING_GPFS_DATA_QUALITY_FLAG = 'provisional/local_government';
export const CENTRAL_DARLING_GPFS_DELIVERY_ENTITY = 'Central Darling Shire Council';

/**
 * The FY2025-26 public notice (1 page, 120,015 bytes) presented to the
 * 17 November 2026 Council meeting. It prints only summary figures and is not a
 * full GPFS, so it is not ingested or substituted.
 */
export const CENTRAL_DARLING_GPFS_2025_26_NOTICE_PIN =
  'https://www.centraldarling.nsw.gov.au/files/assets/public/v/1/finance-2025/finance-2026/cdsc-annual_financial_statements_notepn_public_notice_%E2%80%93_presentation_of_financial_statements-2026.pdf';
export const CENTRAL_DARLING_GPFS_2025_26_NOTICE_BYTES = 120_015;
export const CENTRAL_DARLING_GPFS_2025_26_NOTICE_SHA256 =
  '77a91c3a63721d50819b56e98ca666a4839edeb215007fa91f2e9ec4ae656e97';

/**
 * The newest combined annual report published on the same site (FY2024-25).
 * It is the narrative annual report, not the audited financial statements; its
 * statutory financial-statements section is scanned images with no text layer.
 * It is therefore not substituted for the separate audited GPFS PDF.
 */
export const CENTRAL_DARLING_GPFS_CURRENT_ANNUAL_REPORT_PIN =
  'https://www.centraldarling.nsw.gov.au/files/assets/public/v/1/governance/annual-report/2024-2025-annual-report/annual-report-2024-2205-final.pdf';
export const CENTRAL_DARLING_GPFS_CURRENT_ANNUAL_REPORT_BYTES = 9_421_161;
export const CENTRAL_DARLING_GPFS_CURRENT_ANNUAL_REPORT_SHA256 =
  'e00628ff2d75c2c71c354dffca1f2c7e1086c8ff566f1b5279fc3f1a9e540070';

/**
 * The host rejects a bare Chrome UA with HTTP 403 but serves a plain client UA.
 * These headers are used by both the plain fetch and the browser helper.
 */
export const CENTRAL_DARLING_GPFS_REQUEST_HEADERS = {
  'user-agent': 'curl/8.5.0',
  accept: 'application/pdf,text/html;q=0.9,*/*;q=0.8',
  'accept-language': 'en-AU,en;q=0.9',
} as const;

export const CENTRAL_DARLING_GPFS_META = {
  id: CENTRAL_DARLING_GPFS_ID,
  name: CENTRAL_DARLING_GPFS_NAME,
  publisher: CENTRAL_DARLING_GPFS_PUBLISHER,
  reportingUrl: CENTRAL_DARLING_GPFS_REPORTING_URL,
  licence: CENTRAL_DARLING_GPFS_LICENSE,
  fiscalYear: CENTRAL_DARLING_GPFS_FISCAL_YEAR,
  dataQualityFlag: CENTRAL_DARLING_GPFS_DATA_QUALITY_FLAG,
  sourceDataset: CENTRAL_DARLING_GPFS_SOURCE_DATASET,
  jurisdiction: 'NSW',
  deliveryEntity: CENTRAL_DARLING_GPFS_DELIVERY_ENTITY,
} as const;
