import {
  KEMPSEY_GPFS_ID,
  KEMPSEY_GPFS_NAME,
  KEMPSEY_GPFS_PUBLISHER,
  KEMPSEY_GPFS_FISCAL_YEAR,
  KEMPSEY_GPFS_DATA_QUALITY_FLAG,
} from './parse.js';

export * from './parse.js';

export const MODULE_META = {
  id: KEMPSEY_GPFS_ID,
  name: KEMPSEY_GPFS_NAME,
  publisher: KEMPSEY_GPFS_PUBLISHER,
  fiscalYear: KEMPSEY_GPFS_FISCAL_YEAR,
  dataQualityFlag: KEMPSEY_GPFS_DATA_QUALITY_FLAG,
} as const;
