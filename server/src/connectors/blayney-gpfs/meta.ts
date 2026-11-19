import {
  BLAYNEY_GPFS_ID,
  BLAYNEY_GPFS_NAME,
  BLAYNEY_GPFS_PUBLISHER,
  BLAYNEY_GPFS_FISCAL_YEAR,
  BLAYNEY_GPFS_DATA_QUALITY_FLAG,
} from './parse.js';

export * from './parse.js';

export const MODULE_META = {
  id: BLAYNEY_GPFS_ID,
  name: BLAYNEY_GPFS_NAME,
  publisher: BLAYNEY_GPFS_PUBLISHER,
  fiscalYear: BLAYNEY_GPFS_FISCAL_YEAR,
  dataQualityFlag: BLAYNEY_GPFS_DATA_QUALITY_FLAG,
} as const;
