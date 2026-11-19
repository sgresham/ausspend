import {
  LITHGOW_GPFS_ID,
  LITHGOW_GPFS_NAME,
  LITHGOW_GPFS_PUBLISHER,
  LITHGOW_GPFS_FISCAL_YEAR,
  LITHGOW_GPFS_DATA_QUALITY_FLAG,
} from './parse.js';

export * from './parse.js';

export const MODULE_META = {
  id: LITHGOW_GPFS_ID,
  name: LITHGOW_GPFS_NAME,
  publisher: LITHGOW_GPFS_PUBLISHER,
  fiscalYear: LITHGOW_GPFS_FISCAL_YEAR,
  dataQualityFlag: LITHGOW_GPFS_DATA_QUALITY_FLAG,
} as const;
