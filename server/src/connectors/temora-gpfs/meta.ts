import {
  TEMORA_GPFS_ID,
  TEMORA_GPFS_NAME,
  TEMORA_GPFS_PUBLISHER,
  TEMORA_GPFS_FISCAL_YEAR,
  TEMORA_GPFS_DATA_QUALITY_FLAG,
} from './parse.js';

export * from './parse.js';

export const MODULE_META = {
  id: TEMORA_GPFS_ID,
  name: TEMORA_GPFS_NAME,
  publisher: TEMORA_GPFS_PUBLISHER,
  fiscalYear: TEMORA_GPFS_FISCAL_YEAR,
  dataQualityFlag: TEMORA_GPFS_DATA_QUALITY_FLAG,
} as const;
