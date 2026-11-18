import {
  MID_COAST_GPFS_ID,
  MID_COAST_GPFS_NAME,
  MID_COAST_GPFS_PUBLISHER,
  MID_COAST_GPFS_FISCAL_YEAR,
  MID_COAST_GPFS_DATA_QUALITY_FLAG,
} from './parse.js';

export * from './parse.js';

export const MODULE_META = {
  id: MID_COAST_GPFS_ID,
  name: MID_COAST_GPFS_NAME,
  publisher: MID_COAST_GPFS_PUBLISHER,
  fiscalYear: MID_COAST_GPFS_FISCAL_YEAR,
  dataQualityFlag: MID_COAST_GPFS_DATA_QUALITY_FLAG,
} as const;
