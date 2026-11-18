import {
  KU_RING_GAI_GPFS_ID,
  KU_RING_GAI_GPFS_NAME,
  KU_RING_GAI_GPFS_PUBLISHER,
  KU_RING_GAI_GPFS_FISCAL_YEAR,
  KU_RING_GAI_GPFS_DATA_QUALITY_FLAG,
} from './parse.js';

export * from './parse.js';

export const MODULE_META = {
  id: KU_RING_GAI_GPFS_ID,
  name: KU_RING_GAI_GPFS_NAME,
  publisher: KU_RING_GAI_GPFS_PUBLISHER,
  fiscalYear: KU_RING_GAI_GPFS_FISCAL_YEAR,
  dataQualityFlag: KU_RING_GAI_GPFS_DATA_QUALITY_FLAG,
} as const;
