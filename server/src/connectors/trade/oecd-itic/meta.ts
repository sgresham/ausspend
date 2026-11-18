/**
 * OECD International Transport and Insurance Costs of merchandise trade
 * (ITIC) — the CIF/FOB margin dataset.
 *
 * A CIF/FOB margin is a *border cost*: (CIF - FOB) / CIF, i.e. the share of the
 * CIF import value consumed by international transport and insurance. It is not
 * profit, and it is not government spending.
 */
export const OECD_ITIC_SOURCE_ID = 'oecd-itic';
export const OECD_ITIC_NAME =
  'OECD International Transport and Insurance Costs of Merchandise Trade (ITIC)';
export const OECD_ITIC_PUBLISHER = 'Organisation for Economic Co-operation and Development';
export const OECD_ITIC_AGENCY = 'OECD.SDD.TPS';
export const OECD_ITIC_DATAFLOW = 'DSD_ITIC@DF_ITIC';
export const OECD_ITIC_VERSION = '1.1';
/** Data and constraint endpoints live on the public OECD SDMX endpoint. */
export const OECD_ITIC_BASE_URL = 'https://sdmx.oecd.org/sti-public/rest';
export const OECD_ITIC_DATAFLOW_URL = `https://sdmx.oecd.org/public/rest/dataflow/${OECD_ITIC_AGENCY}/${OECD_ITIC_DATAFLOW}`;
export const OECD_ITIC_SOURCE_URL = 'https://data-explorer.oecd.org/';
export const OECD_ITIC_SOURCE_DATASET = 'OECD ITIC';
export const OECD_ITIC_LICENSE =
  '© OECD. OECD data used under the OECD Terms and Conditions; the ITIC dataset is a combination of reported figures and model-based, derived and adjusted estimates. Not an open-data licence grant for third-party reuse.';

/** ITIC dimensions, in SDMX key order. */
export const OECD_ITIC_REF_AREA = 'AUS';
export const OECD_ITIC_MEASURE = 'C_F';
export const OECD_ITIC_PRODUCT_TYPE = 'C';
export const OECD_ITIC_FREQ = 'A';
/** "Percentage of imports (valued at the CIF price)". */
export const OECD_ITIC_UNIT_MEASURE = 'PT_IM_CIF';
export const OECD_ITIC_UNIT_MULT = 0;
export const OECD_ITIC_DECIMALS = 2;
export const OECD_ITIC_WORLD = 'W';
export const OECD_ITIC_TOTAL_COMMODITY = '_T';

/**
 * Years ingested by default. 2019 and 2022 are the two years in the requested
 * sanity check; 2020 and 2021 are included so the source is not a two-point
 * snapshot and so the observed/estimated distinction is exercised.
 */
export const OECD_ITIC_DEFAULT_YEARS = ['2019', '2020', '2021', '2022'] as const;

/**
 * Headline figures used only as a *sanity flag*. ITIC publishes product- and
 * partner-level margins; it does not publish an all-product World total, and it
 * carries no trade values. The headline is a CIF-import-value-weighted
 * aggregate, so the connector records an explicit unweighted diagnostic and
 * flags a mismatch instead of inventing weights or adjusting a published value.
 */
export const OECD_ITIC_SANITY_TARGETS = {
  '2019': 3.5,
  '2022': 6.4,
} as const;

export const OECD_ITIC_SANITY_TOLERANCE = 0.25;
