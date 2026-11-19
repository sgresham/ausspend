import {
  BOURKE_GPFS_ID,
  BOURKE_GPFS_NAME,
  BOURKE_GPFS_PUBLISHER,
  BOURKE_GPFS_FISCAL_YEAR,
  BOURKE_GPFS_DATA_QUALITY_FLAG,
} from './parse.js';

export * from './parse.js';

export const MODULE_META = {
  id: BOURKE_GPFS_ID,
  name: BOURKE_GPFS_NAME,
  publisher: BOURKE_GPFS_PUBLISHER,
  fiscalYear: BOURKE_GPFS_FISCAL_YEAR,
  dataQualityFlag: BOURKE_GPFS_DATA_QUALITY_FLAG,
} as const;
