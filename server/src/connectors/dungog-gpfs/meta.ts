import {
  DUNGOG_GPFS_ID,
  DUNGOG_GPFS_NAME,
  DUNGOG_GPFS_PUBLISHER,
  DUNGOG_GPFS_FISCAL_YEAR,
  DUNGOG_GPFS_DATA_QUALITY_FLAG,
} from './parse.js';

export * from './parse.js';

export const MODULE_META = {
  id: DUNGOG_GPFS_ID,
  name: DUNGOG_GPFS_NAME,
  publisher: DUNGOG_GPFS_PUBLISHER,
  fiscalYear: DUNGOG_GPFS_FISCAL_YEAR,
  dataQualityFlag: DUNGOG_GPFS_DATA_QUALITY_FLAG,
} as const;
