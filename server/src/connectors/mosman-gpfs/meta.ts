import {
  MOSMAN_GPFS_ID,
  MOSMAN_GPFS_NAME,
  MOSMAN_GPFS_PUBLISHER,
  MOSMAN_GPFS_FISCAL_YEAR,
  MOSMAN_GPFS_DATA_QUALITY_FLAG,
} from './parse.js';

export * from './parse.js';

export const MODULE_META = {
  id: MOSMAN_GPFS_ID,
  name: MOSMAN_GPFS_NAME,
  publisher: MOSMAN_GPFS_PUBLISHER,
  fiscalYear: MOSMAN_GPFS_FISCAL_YEAR,
  dataQualityFlag: MOSMAN_GPFS_DATA_QUALITY_FLAG,
} as const;
