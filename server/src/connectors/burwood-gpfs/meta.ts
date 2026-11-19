export const BURWOOD_GPFS_ID = 'burwood-gpfs';
export const BURWOOD_GPFS_NAME = 'Burwood Council — General Purpose Financial Statements';
export const BURWOOD_GPFS_PUBLISHER = 'Burwood Council';

/**
 * Official FY2025-26 Annual Financial Statements exhibition page. The
 * council's main site (www.burwood.nsw.gov.au) is behind Akamai bot
 * protection, but the consultation subdomain is an official
 * burwood.nsw.gov.au host that serves the current audited financial
 * statements PDF in its Document Library.
 */
export const BURWOOD_GPFS_REPORTING_URL =
  'https://participate.burwood.nsw.gov.au/annual-financial-statement-year-ended-30-june-2026';

/**
 * Documented official pin: the FY2025-26 audited Annual Financial Statements
 * (year ended 30 June 2026), published on the official exhibition page as
 * `Annual financial statements 2026 PDF (4.24 MB)`. It is the current audited
 * GPFS; the newest combined annual report on the council site is still
 * FY2024-25 and is summary-only.
 */
export const BURWOOD_GPFS_DOCUMENT_PIN =
  'https://participate.burwood.nsw.gov.au/download_file/2459/1036';
export const BURWOOD_GPFS_STANDALONE_FS_BYTES = 4_450_607;
export const BURWOOD_GPFS_STANDALONE_FS_SHA256 =
  '9b6e3f8725e47823038329b269d955ef263d7cc6680aacea9b944320919f2e13';
export const BURWOOD_GPFS_STANDALONE_FS_PAGES = 70;
export const BURWOOD_GPFS_FISCAL_YEAR = '2025-26';
export const BURWOOD_GPFS_SOURCE_DATASET = 'Burwood Council GPFS 2025-26';
export const BURWOOD_GPFS_LICENSE =
  '© Burwood Council. Published council documents used here for public-interest research; not an open-data licence grant.';
export const BURWOOD_GPFS_DATA_QUALITY_FLAG = 'provisional/local_government';
export const BURWOOD_GPFS_DELIVERY_ENTITY = 'Burwood Council';

/**
 * The newest combined annual report published on the council site (FY2024-25).
 * It is summary-only and is not substituted for the audited financial
 * statements.
 */
export const BURWOOD_GPFS_CURRENT_ANNUAL_REPORT_PIN =
  'https://www.burwood.nsw.gov.au/files/assets/public/v/1/burwood-council-annual-report-2025.pdf';

/**
 * The main council site is behind Akamai; the consultation subdomain is not.
 * These headers are used by the plain fallback and are documented so the WAF
 * gate is explicit.
 */
export const BURWOOD_GPFS_REQUEST_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.85 Safari/537.36',
  accept: 'application/pdf,text/html;q=0.9,*/*;q=0.8',
  'accept-language': 'en-AU,en;q=0.9',
} as const;

export const BURWOOD_GPFS_META = {
  id: BURWOOD_GPFS_ID,
  name: BURWOOD_GPFS_NAME,
  publisher: BURWOOD_GPFS_PUBLISHER,
  reportingUrl: BURWOOD_GPFS_REPORTING_URL,
  licence: BURWOOD_GPFS_LICENSE,
  fiscalYear: BURWOOD_GPFS_FISCAL_YEAR,
  dataQualityFlag: BURWOOD_GPFS_DATA_QUALITY_FLAG,
  sourceDataset: BURWOOD_GPFS_SOURCE_DATASET,
  jurisdiction: 'NSW',
  deliveryEntity: BURWOOD_GPFS_DELIVERY_ENTITY,
} as const;
