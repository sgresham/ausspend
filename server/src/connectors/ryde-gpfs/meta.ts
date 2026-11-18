import {
  RYDE_GPFS_ID,
  RYDE_GPFS_NAME,
  RYDE_GPFS_PUBLISHER,
  RYDE_GPFS_FISCAL_YEAR,
  RYDE_GPFS_DATA_QUALITY_FLAG,
} from './parse.js';

export * from './parse.js';

export const MODULE_META = {
  id: RYDE_GPFS_ID,
  name: RYDE_GPFS_NAME,
  publisher: RYDE_GPFS_PUBLISHER,
  fiscalYear: RYDE_GPFS_FISCAL_YEAR,
  dataQualityFlag: RYDE_GPFS_DATA_QUALITY_FLAG,
} as const;
