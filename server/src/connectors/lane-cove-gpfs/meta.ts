import {
  LANE_COVE_GPFS_ID,
  LANE_COVE_GPFS_NAME,
  LANE_COVE_GPFS_PUBLISHER,
  LANE_COVE_GPFS_FISCAL_YEAR,
  LANE_COVE_GPFS_DATA_QUALITY_FLAG,
} from './parse.js';

export * from './parse.js';

export const MODULE_META = {
  id: LANE_COVE_GPFS_ID,
  name: LANE_COVE_GPFS_NAME,
  publisher: LANE_COVE_GPFS_PUBLISHER,
  fiscalYear: LANE_COVE_GPFS_FISCAL_YEAR,
  dataQualityFlag: LANE_COVE_GPFS_DATA_QUALITY_FLAG,
} as const;
