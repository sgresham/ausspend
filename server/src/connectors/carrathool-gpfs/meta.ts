export const CARRATHOOL_GPFS_ID = 'carrathool-gpfs';
export const CARRATHOOL_GPFS_NAME =
  'Carrathool Shire Council — General Purpose Financial Statements';
export const CARRATHOOL_GPFS_PUBLISHER = 'Carrathool Shire Council';

/**
 * Official annual-report page. The page itself still lists only reports up to
 * FY2023-24, so it is the human-facing reporting page and the browser helper's
 * navigation target, not the discovery index. The current financial statements
 * are published as WordPress media under the official council domain.
 */
export const CARRATHOOL_GPFS_REPORTING_URL =
  'https://carrathool.nsw.gov.au/about-council/publications/annual-report';

/**
 * Official WordPress media index used for discovery. The council publishes
 * documents to `/wp-content/uploads/` and exposes them through its own media
 * REST endpoint; this is the same official domain and returns the FY2025-26
 * Annual Financial Statements PDF.
 */
export const CARRATHOOL_GPFS_MEDIA_SEARCH_URL =
  'https://carrathool.nsw.gov.au/wp-json/wp/v2/media?search=annual%20financial%20statements&per_page=100';

/**
 * Documented official pin: the FY2025-26 General Purpose Financial Statements
 * (year ended 30 June 2026), published in the council's Public Exhibition
 * folder. The identical bytes are also published under Agendas-Minutes; the
 * Public Exhibition path is the stable pin.
 */
export const CARRATHOOL_GPFS_DOCUMENT_PIN =
  'https://carrathool.nsw.gov.au/wp-content/uploads/Public-Exhibition/Carrathool-Shire-Annual-Financial-Statements-25-26.pdf';
export const CARRATHOOL_GPFS_STANDALONE_FS_BYTES = 5_397_495;
export const CARRATHOOL_GPFS_STANDALONE_FS_SHA256 =
  'cf6c36b1c5fdeb5b95f21a4c2bac45a7b7715b38fa71cd8d5aa602ce11757ec4';
export const CARRATHOOL_GPFS_STANDALONE_FS_PAGES = 114;
export const CARRATHOOL_GPFS_FISCAL_YEAR = '2025-26';
export const CARRATHOOL_GPFS_SOURCE_DATASET = 'Carrathool Shire Council GPFS 2025-26';
export const CARRATHOOL_GPFS_LICENSE =
  '© Carrathool Shire Council. Published council documents used here for public-interest research; not an open-data licence grant.';
export const CARRATHOOL_GPFS_DATA_QUALITY_FLAG = 'provisional/local_government';
export const CARRATHOOL_GPFS_DELIVERY_ENTITY = 'Carrathool Shire Council';

/**
 * The council site returned HTTP 200 to a plain client on 2026-11-20. The
 * browser helper still tries headless Chromium first and falls back to this.
 */
export const CARRATHOOL_GPFS_REQUEST_HEADERS = {
  'user-agent': 'curl/8.5.0',
  accept: 'application/json,application/pdf,text/html;q=0.9,*/*;q=0.8',
} as const;

export const CARRATHOOL_GPFS_META = {
  id: CARRATHOOL_GPFS_ID,
  name: CARRATHOOL_GPFS_NAME,
  publisher: CARRATHOOL_GPFS_PUBLISHER,
  reportingUrl: CARRATHOOL_GPFS_REPORTING_URL,
  licence: CARRATHOOL_GPFS_LICENSE,
  fiscalYear: CARRATHOOL_GPFS_FISCAL_YEAR,
  dataQualityFlag: CARRATHOOL_GPFS_DATA_QUALITY_FLAG,
  sourceDataset: CARRATHOOL_GPFS_SOURCE_DATASET,
  jurisdiction: 'NSW',
  deliveryEntity: CARRATHOOL_GPFS_DELIVERY_ENTITY,
} as const;
