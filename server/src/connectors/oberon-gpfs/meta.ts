export const OBERON_GPFS_ID = 'oberon-gpfs';
export const OBERON_GPFS_NAME = 'Oberon Council — General Purpose Financial Statements';
export const OBERON_GPFS_PUBLISHER = 'Oberon Council';

/**
 * Official Have Your Say Oberon page for the FY2024-25 audited financial
 * statements. The council's main IP&R page links only the 52 MB combined annual
 * report bundle, but this official engagement page publishes the separate
 * audited GPFS, SPFS and Special Schedules PDFs in its Documents tab.
 */
export const OBERON_GPFS_REPORTING_URL =
  'https://haveyoursay.oberon.nsw.gov.au/2024-2025-audited-financial-statements';

/**
 * Stable official document entry point for the FY2024-25 General Purpose
 * Annual Financial Statements (6.79 MB). Visiting it triggers the official
 * browser download; the file is named
 * `Annual_Financial_Statements-GPFS-2025 Complete.pdf`.
 */
export const OBERON_GPFS_DOCUMENT_PIN =
  'https://haveyoursay.oberon.nsw.gov.au/104015/widgets/476199/documents/318527';
export const OBERON_GPFS_STANDALONE_FS_BYTES = 7_118_843;
export const OBERON_GPFS_STANDALONE_FS_SHA256 =
  'ef24ded09ec28724e7b622f97860685c606eeec42b6b31f38b59088ac866a630';
export const OBERON_GPFS_STANDALONE_FS_PAGES = 80;
export const OBERON_GPFS_FISCAL_YEAR = '2024-25';
export const OBERON_GPFS_SOURCE_DATASET = 'Oberon Council GPFS 2024-25';
export const OBERON_GPFS_LICENSE =
  '© Oberon Council. Published council documents used here for public-interest research; not an open-data licence grant.';
export const OBERON_GPFS_DATA_QUALITY_FLAG = 'provisional/local_government';
export const OBERON_GPFS_DELIVERY_ENTITY = 'Oberon Council';

/**
 * The FY2024-25 combined annual report bundle on the council's main IP&R page.
 * It is the narrative annual report with attachments (54,350,198 bytes), not a
 * standalone GPFS; the separate audited GPFS PDF above is used instead.
 */
export const OBERON_GPFS_CURRENT_ANNUAL_REPORT_PIN =
  'https://www.oberon.nsw.gov.au/files/assets/public/v/1/council/ipampr/20242025/annual-report-2024-2025-single-pages-low-res-with-attachments_1.pdf';
export const OBERON_GPFS_CURRENT_ANNUAL_REPORT_BYTES = 54_350_198;

/**
 * The main IP&R reporting page (lists the combined annual reports, not the
 * separate Have Your Say GPFS documents).
 */
export const OBERON_GPFS_MAIN_REPORTING_URL =
  'https://www.oberon.nsw.gov.au/Council/Integrated-Planning-Reporting';

/**
 * The main council site rejects a bare Chrome UA with HTTP 403 but serves a
 * plain client UA; Have Your Say Oberon serves the plain UA too. These headers
 * are used by the browser helper and any plain fetch.
 */
export const OBERON_GPFS_REQUEST_HEADERS = {
  'user-agent': 'curl/8.5.0',
  accept: 'application/pdf,text/html;q=0.9,*/*;q=0.8',
  'accept-language': 'en-AU,en;q=0.9',
} as const;

export const OBERON_GPFS_META = {
  id: OBERON_GPFS_ID,
  name: OBERON_GPFS_NAME,
  publisher: OBERON_GPFS_PUBLISHER,
  reportingUrl: OBERON_GPFS_REPORTING_URL,
  licence: OBERON_GPFS_LICENSE,
  fiscalYear: OBERON_GPFS_FISCAL_YEAR,
  dataQualityFlag: OBERON_GPFS_DATA_QUALITY_FLAG,
  sourceDataset: OBERON_GPFS_SOURCE_DATASET,
  jurisdiction: 'NSW',
  deliveryEntity: OBERON_GPFS_DELIVERY_ENTITY,
} as const;
