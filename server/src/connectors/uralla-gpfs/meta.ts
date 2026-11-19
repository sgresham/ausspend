import {
  URALLA_GPFS_ID,
  URALLA_GPFS_NAME,
  URALLA_GPFS_PUBLISHER,
  URALLA_GPFS_FISCAL_YEAR,
  URALLA_GPFS_DATA_QUALITY_FLAG,
} from './parse.js';

export * from './parse.js';

export const MODULE_META = {
  id: URALLA_GPFS_ID,
  name: URALLA_GPFS_NAME,
  publisher: URALLA_GPFS_PUBLISHER,
  fiscalYear: URALLA_GPFS_FISCAL_YEAR,
  dataQualityFlag: URALLA_GPFS_DATA_QUALITY_FLAG,
} as const;
