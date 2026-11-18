import {
  THE_HILLS_GPFS_ID,
  THE_HILLS_GPFS_NAME,
  THE_HILLS_GPFS_PUBLISHER,
  THE_HILLS_GPFS_FISCAL_YEAR,
  THE_HILLS_GPFS_DATA_QUALITY_FLAG,
} from './parse.js';

export * from './parse.js';

export const MODULE_META = {
  id: THE_HILLS_GPFS_ID,
  name: THE_HILLS_GPFS_NAME,
  publisher: THE_HILLS_GPFS_PUBLISHER,
  fiscalYear: THE_HILLS_GPFS_FISCAL_YEAR,
  dataQualityFlag: THE_HILLS_GPFS_DATA_QUALITY_FLAG,
} as const;
