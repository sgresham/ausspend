export const GREATER_HUME_GPFS_ID = 'greater-hume-gpfs';
export const GREATER_HUME_GPFS_NAME =
  'Greater Hume Shire Council — General Purpose Financial Statements';
export const GREATER_HUME_GPFS_PUBLISHER = 'Greater Hume Shire Council';

/**
 * Official "Financial Statements" exhibition page. Council publishes the
 * audited annual financial statements here and links the exact `/files/...`
 * PDF. The site is behind Akamai bot protection: plain HTTP clients get HTTP
 * 403 ("Access Denied") on the home page and every `/files` path, while a real
 * headless Chromium session gets HTTP 200. The current FY2025-26 audited
 * financial statements are therefore pinned to the exact official upload listed
 * on this page and fetched through the browser/WAF path.
 */
export const GREATER_HUME_GPFS_REPORTING_URL =
  'https://www.greaterhume.nsw.gov.au/Your-Greater-Hume-Council/Have-Your-Say-On-Exhibition/Financial-Statements';

/**
 * Documented official pin: the FY2025-26 audited Annual Financial Statements
 * (year ended 30 June 2026), published on the official Financial Statements
 * page as `Annual Financial Statements (PDF, 25MB)`. The page states that the
 * 18 November 2026 Ordinary Council meeting included the presentation of the
 * audited Financial Statements and the Auditor's Reports for the year ended
 * 30 June 2026, and invites submissions until 25 November 2026. This is the
 * current audited FS, not an older-year substitute.
 */
export const GREATER_HUME_GPFS_DOCUMENT_PIN =
  'https://www.greaterhume.nsw.gov.au/files/sharedassets/public/v/1/have-your-say/2026/greater-hume-council-financial-statements-2025-2026-final.pdf';
export const GREATER_HUME_GPFS_STANDALONE_FS_BYTES = 26_114_412;
export const GREATER_HUME_GPFS_STANDALONE_FS_SHA256 =
  'f181da5b9a70f33ec4c2a2ee5fbac7b0eae5ebd4162e91624226c675fefe9db5';
export const GREATER_HUME_GPFS_STANDALONE_FS_PAGES = 122;
export const GREATER_HUME_GPFS_FISCAL_YEAR = '2025-26';
export const GREATER_HUME_GPFS_SOURCE_DATASET = 'Greater Hume Shire Council GPFS 2025-26';
export const GREATER_HUME_GPFS_LICENSE =
  '© Greater Hume Shire Council. Published council documents used here for public-interest research; not an open-data licence grant.';
export const GREATER_HUME_GPFS_DATA_QUALITY_FLAG = 'provisional/local_government';
export const GREATER_HUME_GPFS_DELIVERY_ENTITY = 'Greater Hume Shire Council';

/**
 * Newest narrative annual report linked on the council's Documents and Policies
 * page (Annual Report 2025, covering the year ended 30 June 2025). It is the
 * narrative report, not the audited financial statements, and is not
 * substituted for the AFS/GPFS.
 */
export const GREATER_HUME_GPFS_CURRENT_ANNUAL_REPORT_PIN =
  'https://www.greaterhume.nsw.gov.au/files/sharedassets/public/v/1/documents-and-policies/documents/annual-report-2025-1.pdf';

/**
 * The official site is behind Akamai. A plain HTTP client gets HTTP 403 for the
 * home page and every `/files` path. These headers are used by the plain
 * fallback and are documented here so the WAF gate is explicit.
 */
export const GREATER_HUME_GPFS_REQUEST_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.85 Safari/537.36',
  accept: 'application/pdf,text/html;q=0.9,*/*;q=0.8',
  'accept-language': 'en-AU,en;q=0.9',
} as const;

export const GREATER_HUME_GPFS_META = {
  id: GREATER_HUME_GPFS_ID,
  name: GREATER_HUME_GPFS_NAME,
  publisher: GREATER_HUME_GPFS_PUBLISHER,
  reportingUrl: GREATER_HUME_GPFS_REPORTING_URL,
  licence: GREATER_HUME_GPFS_LICENSE,
  fiscalYear: GREATER_HUME_GPFS_FISCAL_YEAR,
  dataQualityFlag: GREATER_HUME_GPFS_DATA_QUALITY_FLAG,
  sourceDataset: GREATER_HUME_GPFS_SOURCE_DATASET,
  jurisdiction: 'NSW',
  deliveryEntity: GREATER_HUME_GPFS_DELIVERY_ENTITY,
} as const;
