export const WALGETT_GPFS_ID = 'walgett-gpfs';
export const WALGETT_GPFS_NAME = 'Walgett Shire Council — General Purpose Financial Statements';
export const WALGETT_GPFS_PUBLISHER = 'Walgett Shire Council';

/**
 * Official "Annual Reports and Financial Statements" page. It is a
 * client-rendered single-page app: the HTML shell contains no document links,
 * so discovery reads the same published CMS snapshot (`/snapshot.json`) the SPA
 * loads at runtime. The browser helper performs the same discovery from the
 * rendered DOM and the observed `/snapshot.json` network request.
 */
export const WALGETT_GPFS_REPORTING_URL =
  'https://www.walgett.nsw.gov.au/council/council-publications/annual-reports';

/** Same-origin CMS snapshot the SPA fetches; it carries the published file list. */
export const WALGETT_GPFS_SNAPSHOT_URL = 'https://www.walgett.nsw.gov.au/snapshot.json';

/**
 * Stable official PDF for the FY2024-25 audited standalone financial statements
 * (`Audited-Financial-Statements-2024-25.pdf`, 2.9 MB). The same URL is the
 * documented official fallback pin used when live snapshot discovery fails.
 */
export const WALGETT_GPFS_DOCUMENT_PIN =
  'https://www.walgett.nsw.gov.au/assets/files/e14f90d207d06a69-1776849622581_6c2e2885.pdf';
export const WALGETT_GPFS_STANDALONE_FS_BYTES = 3_001_912;
export const WALGETT_GPFS_STANDALONE_FS_SHA256 =
  '26f02f8523fe3742aa84f0998e43241b398d13f3fd158920380c77907baa9de4';
export const WALGETT_GPFS_STANDALONE_FS_PAGES = 109;
export const WALGETT_GPFS_FISCAL_YEAR = '2024-25';
export const WALGETT_GPFS_SOURCE_DATASET = 'Walgett Shire Council GPFS 2024-25';
export const WALGETT_GPFS_LICENSE =
  '© Walgett Shire Council. Published council documents used here for public-interest research; not an open-data licence grant.';
export const WALGETT_GPFS_DATA_QUALITY_FLAG = 'provisional/local_government';
export const WALGETT_GPFS_DELIVERY_ENTITY = 'Walgett Shire Council';

/**
 * The FY2024-25 narrative annual report listed above the financial statements.
 * It is a combined narrative document, not the standalone audited GPFS, and is
 * never substituted for the audited statements.
 */
export const WALGETT_GPFS_CURRENT_ANNUAL_REPORT_PIN =
  'https://www.walgett.nsw.gov.au/assets/files/f99e8f028b702a44-1775602766918_41bfcfd2.pdf';
export const WALGETT_GPFS_CURRENT_ANNUAL_REPORT_NAME = 'Annual Report 2024–25';

/**
 * The SPA and its file endpoints serve both a plain client UA and a Chrome UA
 * (verified 2026-11-20). The browser helper uses the Chrome UA; the connector
 * uses the same origin for both the snapshot and the PDF.
 */
export const WALGETT_GPFS_REQUEST_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
  accept: 'application/json,application/pdf,text/html;q=0.9,*/*;q=0.8',
  'accept-language': 'en-AU,en;q=0.9',
} as const;

export const WALGETT_GPFS_META = {
  id: WALGETT_GPFS_ID,
  name: WALGETT_GPFS_NAME,
  publisher: WALGETT_GPFS_PUBLISHER,
  reportingUrl: WALGETT_GPFS_REPORTING_URL,
  licence: WALGETT_GPFS_LICENSE,
  fiscalYear: WALGETT_GPFS_FISCAL_YEAR,
  dataQualityFlag: WALGETT_GPFS_DATA_QUALITY_FLAG,
  sourceDataset: WALGETT_GPFS_SOURCE_DATASET,
  jurisdiction: 'NSW',
  deliveryEntity: WALGETT_GPFS_DELIVERY_ENTITY,
} as const;
