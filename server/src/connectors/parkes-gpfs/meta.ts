import {
  PARKES_GPFS_ID,
  PARKES_GPFS_NAME,
  PARKES_GPFS_PUBLISHER,
  PARKES_GPFS_FISCAL_YEAR,
  PARKES_GPFS_DATA_QUALITY_FLAG,
} from './parse.js';

export * from './parse.js';

export const MODULE_META = {
  id: PARKES_GPFS_ID,
  name: PARKES_GPFS_NAME,
  publisher: PARKES_GPFS_PUBLISHER,
  fiscalYear: PARKES_GPFS_FISCAL_YEAR,
  dataQualityFlag: PARKES_GPFS_DATA_QUALITY_FLAG,
} as const;
