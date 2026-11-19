export const CABONNE_GPFS_ID = 'cabonne-gpfs';
export const CABONNE_GPFS_NAME = 'Cabonne Council — General Purpose Financial Statements';
export const CABONNE_GPFS_PUBLISHER = 'Cabonne Council';

/**
 * Official Reports page. The council publishes annual reports and the annual
 * financial statements here as `/files/...` media under the official domain.
 * The site is behind Akamai bot protection: plain HTTP clients get HTTP 403
 * ("Access Denied") on the home page, sitemaps and every `/files` path, while a
 * real headless Chromium session gets HTTP 200. The current FY2025-26 GPFS is
 * therefore pinned to the exact official upload listed on this page and fetched
 * through the browser/WAF path.
 */
export const CABONNE_GPFS_REPORTING_URL =
  'https://www.cabonne.nsw.gov.au/Council/Strategies-policies-and-publications/Reports';

/**
 * Documented official pin: the standalone FY2025-26 General Purpose Financial
 * Statements (year ended 30 June 2026), published on the official Reports page
 * as `Annual_Financial_Statements-GPFS-2026.pdf`. It is the current audited FS;
 * the newest combined annual report on the same page is still FY2024-25.
 */
export const CABONNE_GPFS_DOCUMENT_PIN =
  'https://www.cabonne.nsw.gov.au/files/98ceb2a5-f381-4fcb-b4e6-32cb52eab396/Annual_Financial_Statements-GPFS-2026.pdf';
export const CABONNE_GPFS_STANDALONE_FS_BYTES = 8_577_237;
export const CABONNE_GPFS_STANDALONE_FS_SHA256 =
  'acb8b3d53a4b795bfb6bd5dd4770e377fe24dfc0ca2801f44df9a348369d885f';
export const CABONNE_GPFS_STANDALONE_FS_PAGES = 77;
export const CABONNE_GPFS_FISCAL_YEAR = '2025-26';
export const CABONNE_GPFS_SOURCE_DATASET = 'Cabonne Council GPFS 2025-26';
export const CABONNE_GPFS_LICENSE =
  '© Cabonne Council. Published council documents used here for public-interest research; not an open-data licence grant.';
export const CABONNE_GPFS_DATA_QUALITY_FLAG = 'provisional/local_government';
export const CABONNE_GPFS_DELIVERY_ENTITY = 'Cabonne Council';

/** The newest combined annual report published on the same page (FY2024-25). */
export const CABONNE_GPFS_CURRENT_ANNUAL_REPORT_PIN =
  'https://www.cabonne.nsw.gov.au/files/sharedassets/public/v/1/council/business-papers-reports-policies-and-publications/reports/annual-reports/final-annual-report-2024-2025.pdf';

/**
 * The official site is behind Akamai. A plain HTTP client gets HTTP 403 for the
 * home page, sitemap and every `/files` path. These headers are used by the
 * plain fallback and are documented here so the WAF gate is explicit.
 */
export const CABONNE_GPFS_REQUEST_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.85 Safari/537.36',
  accept: 'application/pdf,text/html;q=0.9,*/*;q=0.8',
  'accept-language': 'en-AU,en;q=0.9',
} as const;

export const CABONNE_GPFS_META = {
  id: CABONNE_GPFS_ID,
  name: CABONNE_GPFS_NAME,
  publisher: CABONNE_GPFS_PUBLISHER,
  reportingUrl: CABONNE_GPFS_REPORTING_URL,
  licence: CABONNE_GPFS_LICENSE,
  fiscalYear: CABONNE_GPFS_FISCAL_YEAR,
  dataQualityFlag: CABONNE_GPFS_DATA_QUALITY_FLAG,
  sourceDataset: CABONNE_GPFS_SOURCE_DATASET,
  jurisdiction: 'NSW',
  deliveryEntity: CABONNE_GPFS_DELIVERY_ENTITY,
} as const;
