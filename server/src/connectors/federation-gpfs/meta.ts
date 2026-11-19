export const FEDERATION_GPFS_ID = 'federation-gpfs';
export const FEDERATION_GPFS_NAME = 'Federation Council — General Purpose Financial Statements';
export const FEDERATION_GPFS_PUBLISHER = 'Federation Council';

/**
 * Official Annual Financial Statements page. The council publishes the audited
 * financial statements here as `/files/...` media under the official domain.
 * The site is behind Akamai bot protection: plain HTTP clients get HTTP 403
 * ("Access Denied") on the home page, sitemaps and every `/files` path, while a
 * real headless Chromium session gets HTTP 200. The current available audited
 * annual financial statements (FY2024-25) are therefore pinned to the exact
 * official upload listed on this page and fetched through the browser/WAF path.
 */
export const FEDERATION_GPFS_REPORTING_URL =
  'https://www.federationcouncil.nsw.gov.au/Council/Corporate-Planning/Reporting/Annual-Financial-Statements';

/**
 * Documented official pin: the FY2024-25 Annual Financial Statements (year
 * ended 30 June 2025), published on the official Annual Financial Statements
 * page as `Annual Financial Statements 2024-2025 (PDF, 5MB)`. The single AFS
 * document incorporates the audited General Purpose Financial Statements, the
 * Special Purpose Financial Statements and the Special Schedules. As at
 * 2026-11-20 no FY2025-26 annual financial statements were published, so
 * FY2024-25 is the latest available audited GPFS and is ingested as such; no
 * older year is substituted.
 */
export const FEDERATION_GPFS_DOCUMENT_PIN =
  'https://www.federationcouncil.nsw.gov.au/files/assets/public/v/1/document-library/corporate-documents/other/financial-statements/federation-council-annual_financial_statements-2025.pdf';
export const FEDERATION_GPFS_STANDALONE_FS_BYTES = 4_790_806;
export const FEDERATION_GPFS_STANDALONE_FS_SHA256 =
  '7dbdc2a08b4f03e217f1112db1684c1302363d6632ce2660c1f8717779426ca5';
export const FEDERATION_GPFS_STANDALONE_FS_PAGES = 114;
export const FEDERATION_GPFS_FISCAL_YEAR = '2024-25';
export const FEDERATION_GPFS_SOURCE_DATASET = 'Federation Council GPFS 2024-25';
export const FEDERATION_GPFS_LICENSE =
  '© Federation Council. Published council documents used here for public-interest research; not an open-data licence grant.';
export const FEDERATION_GPFS_DATA_QUALITY_FLAG = 'provisional/local_government';
export const FEDERATION_GPFS_DELIVERY_ENTITY = 'Federation Council';

/**
 * The newest combined annual report published on the same site (FY2024-25).
 * It is the narrative annual report, not the audited financial statements, and
 * is therefore not substituted for the AFS/GPFS.
 */
export const FEDERATION_GPFS_CURRENT_ANNUAL_REPORT_PIN =
  'https://www.federationcouncil.nsw.gov.au/files/assets/public/v/2/document-library/corporate-documents/plans-amp-strategies-ampipampr/2024-2025-strategic-documents/annual-report-2024-2025-v1.1.pdf';

/**
 * The official site is behind Akamai. A plain HTTP client gets HTTP 403 for the
 * home page, sitemap and every `/files` path. These headers are used by the
 * plain fallback and are documented here so the WAF gate is explicit.
 */
export const FEDERATION_GPFS_REQUEST_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.85 Safari/537.36',
  accept: 'application/pdf,text/html;q=0.9,*/*;q=0.8',
  'accept-language': 'en-AU,en;q=0.9',
} as const;

export const FEDERATION_GPFS_META = {
  id: FEDERATION_GPFS_ID,
  name: FEDERATION_GPFS_NAME,
  publisher: FEDERATION_GPFS_PUBLISHER,
  reportingUrl: FEDERATION_GPFS_REPORTING_URL,
  licence: FEDERATION_GPFS_LICENSE,
  fiscalYear: FEDERATION_GPFS_FISCAL_YEAR,
  dataQualityFlag: FEDERATION_GPFS_DATA_QUALITY_FLAG,
  sourceDataset: FEDERATION_GPFS_SOURCE_DATASET,
  jurisdiction: 'NSW',
  deliveryEntity: FEDERATION_GPFS_DELIVERY_ENTITY,
} as const;
