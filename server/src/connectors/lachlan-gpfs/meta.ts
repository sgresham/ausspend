import {
  LACHLAN_GPFS_ID,
  LACHLAN_GPFS_NAME,
  LACHLAN_GPFS_PUBLISHER,
  LACHLAN_GPFS_FISCAL_YEAR,
  LACHLAN_GPFS_DATA_QUALITY_FLAG,
} from './parse.js';

export * from './parse.js';

export const MODULE_META = {
  id: LACHLAN_GPFS_ID,
  name: LACHLAN_GPFS_NAME,
  publisher: LACHLAN_GPFS_PUBLISHER,
  fiscalYear: LACHLAN_GPFS_FISCAL_YEAR,
  dataQualityFlag: LACHLAN_GPFS_DATA_QUALITY_FLAG,
} as const;
