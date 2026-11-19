export const HAY_GPFS_ID = 'hay-gpfs';
export const HAY_GPFS_NAME = 'Hay Shire Council — General Purpose Financial Statements';
export const HAY_GPFS_PUBLISHER = 'Hay Shire Council';

/**
 * Official reporting page. Hay publishes its documents as a chronological feed
 * on the combined "Council Meetings and Reports" page; that feed is where the
 * standalone Annual Financial Statements PDFs are listed. The dedicated
 * "Council Plans and Reports" page does not list the financial statements.
 */
export const HAY_GPFS_REPORTING_URL =
  'https://www.hay.nsw.gov.au/Inside-Hay-Shire-Council/Council-Meetings-and-Reports';
export const HAY_GPFS_PLANS_URL =
  'https://www.hay.nsw.gov.au/Inside-Hay-Shire-Council/Council-Plans-and-Reports';

/**
 * Documented official pin: the FY2025-26 General Purpose Financial Statements
 * (year ended 30 June 2026), linked from the reporting page as
 * "Hay Shire Council ANNUAL FINANCIAL STATEMENTS for the year ended 30 June 2026".
 */
export const HAY_GPFS_DOCUMENT_PIN =
  'https://www.hay.nsw.gov.au/Portals/0/Files/Annual_Financial_Statements-2026.pdf';
export const HAY_GPFS_STANDALONE_FS_BYTES = 1_345_435;
export const HAY_GPFS_STANDALONE_FS_SHA256 =
  '710fce7da5e69d93cc30fc943e122c8a20b28d840f9726cfb90aa926cc7a75ce';
export const HAY_GPFS_STANDALONE_FS_PAGES = 80;
export const HAY_GPFS_FISCAL_YEAR = '2025-26';
export const HAY_GPFS_SOURCE_DATASET = 'Hay Shire Council GPFS 2025-26';
export const HAY_GPFS_LICENSE =
  '© Hay Shire Council. Published council documents used here for public-interest research; not an open-data licence grant.';
export const HAY_GPFS_DATA_QUALITY_FLAG = 'provisional/local_government';
export const HAY_GPFS_DELIVERY_ENTITY = 'Hay Shire Council';

/**
 * The site returned HTTP 200 to a plain `curl/8.5.0` client on 2026-11-20 and is
 * not behind a WAF, so deterministic discovery uses the plain client UA. The
 * browser helper still tries headless Chromium first and falls back to this.
 */
export const HAY_GPFS_REQUEST_HEADERS = {
  'user-agent': 'curl/8.5.0',
  accept: 'application/pdf,text/html;q=0.9,*/*;q=0.8',
} as const;

export const HAY_GPFS_META = {
  id: HAY_GPFS_ID,
  name: HAY_GPFS_NAME,
  publisher: HAY_GPFS_PUBLISHER,
  reportingUrl: HAY_GPFS_REPORTING_URL,
  licence: HAY_GPFS_LICENSE,
  fiscalYear: HAY_GPFS_FISCAL_YEAR,
  dataQualityFlag: HAY_GPFS_DATA_QUALITY_FLAG,
  sourceDataset: HAY_GPFS_SOURCE_DATASET,
  jurisdiction: 'NSW',
  deliveryEntity: HAY_GPFS_DELIVERY_ENTITY,
} as const;
