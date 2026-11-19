import {
  MOREE_GPFS_ID,
  MOREE_GPFS_NAME,
  MOREE_GPFS_PUBLISHER,
  MOREE_GPFS_FISCAL_YEAR,
  MOREE_GPFS_DATA_QUALITY_FLAG,
} from './parse.js';

export * from './parse.js';

export const MODULE_META = {
  id: MOREE_GPFS_ID,
  name: MOREE_GPFS_NAME,
  publisher: MOREE_GPFS_PUBLISHER,
  fiscalYear: MOREE_GPFS_FISCAL_YEAR,
  dataQualityFlag: MOREE_GPFS_DATA_QUALITY_FLAG,
} as const;
