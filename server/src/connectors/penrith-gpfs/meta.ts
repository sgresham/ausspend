import {
  PENRITH_GPFS_ID,
  PENRITH_GPFS_NAME,
  PENRITH_GPFS_PUBLISHER,
  PENRITH_GPFS_FISCAL_YEAR,
  PENRITH_GPFS_DATA_QUALITY_FLAG,
} from './parse.js';

export * from './parse.js';

export const MODULE_META = {
  id: PENRITH_GPFS_ID,
  name: PENRITH_GPFS_NAME,
  publisher: PENRITH_GPFS_PUBLISHER,
  fiscalYear: PENRITH_GPFS_FISCAL_YEAR,
  dataQualityFlag: PENRITH_GPFS_DATA_QUALITY_FLAG,
} as const;
