export const BALRANALD_GPFS_ID = 'balranald-gpfs';
export const BALRANALD_GPFS_NAME =
  'Balranald Shire Council — General Purpose Financial Statements';
export const BALRANALD_GPFS_PUBLISHER = 'Balranald Shire Council';

/**
 * Official annual-reports page. The council publishes its annual reports and
 * financial statements here as WordPress media under the official apex domain
 * (`balranald.nsw.gov.au`; the `www` host 301-redirects to the apex). The page
 * itself is only reachable through a real browser: Cloudflare bot management
 * returns HTTP 403 to plain clients (including a plain client with full Chrome
 * headers), so discovery is pinned to the exact official upload listed on that
 * page and the bytes are fetched through headless Chromium.
 */
export const BALRANALD_GPFS_REPORTING_URL =
  'https://balranald.nsw.gov.au/business/council-documents/annual-reports-documents/';

/**
 * Documented official pin: the FY2025-26 General Purpose Financial Statements
 * (year ended 30 June 2026), published November 2026 on the official
 * annual-reports page and named as the council's OLG submission. It is the
 * current standalone audited FS; the newest combined annual report on the same
 * page is still FY2024-25.
 */
export const BALRANALD_GPFS_DOCUMENT_PIN =
  'https://balranald.nsw.gov.au/wp-content/uploads/2026/11/Balranald-Annual_Financial_Statements-2026-OLG.pdf';
export const BALRANALD_GPFS_STANDALONE_FS_BYTES = 2_920_220;
export const BALRANALD_GPFS_STANDALONE_FS_SHA256 =
  'd7c10c675385d2376ddccae430b08087f25d491a34f6a3695a86e9d807b169fd';
export const BALRANALD_GPFS_STANDALONE_FS_PAGES = 108;
export const BALRANALD_GPFS_FISCAL_YEAR = '2025-26';
export const BALRANALD_GPFS_SOURCE_DATASET = 'Balranald Shire Council GPFS 2025-26';
export const BALRANALD_GPFS_LICENSE =
  '© Balranald Shire Council. Published council documents used here for public-interest research; not an open-data licence grant.';
export const BALRANALD_GPFS_DATA_QUALITY_FLAG = 'provisional/local_government';
export const BALRANALD_GPFS_DELIVERY_ENTITY = 'Balranald Shire Council';

/**
 * The official site is behind Cloudflare bot management. A plain HTTP client
 * gets HTTP 403 for the home page, sitemap and every PDF path; only `robots.txt`
 * is served. These headers are used by the plain fallback and are documented
 * here so the WAF gate is explicit.
 */
export const BALRANALD_GPFS_REQUEST_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.85 Safari/537.36',
  accept: 'application/pdf,text/html;q=0.9,*/*;q=0.8',
  'accept-language': 'en-AU,en;q=0.9',
} as const;

/** The newest combined annual report published on the same page (FY2024-25). */
export const BALRANALD_GPFS_CURRENT_ANNUAL_REPORT_PIN =
  'https://balranald.nsw.gov.au/wp-content/uploads/2025/11/BSC-Annual-Report-2024-2025-with-Financials.pdf';

export const BALRANALD_GPFS_META = {
  id: BALRANALD_GPFS_ID,
  name: BALRANALD_GPFS_NAME,
  publisher: BALRANALD_GPFS_PUBLISHER,
  reportingUrl: BALRANALD_GPFS_REPORTING_URL,
  licence: BALRANALD_GPFS_LICENSE,
  fiscalYear: BALRANALD_GPFS_FISCAL_YEAR,
  dataQualityFlag: BALRANALD_GPFS_DATA_QUALITY_FLAG,
  sourceDataset: BALRANALD_GPFS_SOURCE_DATASET,
  jurisdiction: 'NSW',
  deliveryEntity: BALRANALD_GPFS_DELIVERY_ENTITY,
} as const;
