import {
  WEDDIN_GPFS_ID,
  WEDDIN_GPFS_NAME,
  WEDDIN_GPFS_PUBLISHER,
  WEDDIN_GPFS_FISCAL_YEAR,
  WEDDIN_GPFS_DATA_QUALITY_FLAG,
} from './parse.js';

export * from './parse.js';

export const MODULE_META = {
  id: WEDDIN_GPFS_ID,
  name: WEDDIN_GPFS_NAME,
  publisher: WEDDIN_GPFS_PUBLISHER,
  fiscalYear: WEDDIN_GPFS_FISCAL_YEAR,
  dataQualityFlag: WEDDIN_GPFS_DATA_QUALITY_FLAG,
} as const;
