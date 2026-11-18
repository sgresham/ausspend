/**
 * Blacktown layout config. The line specs stay in `parse.ts` because the
 * income statement's label/number ordering is a Blacktown-specific escape
 * hatch; page anchors are recorded here for discovery and diagnostics.
 */
export {
  BLACKTOWN_GPFS_LINES,
  type BlacktownGpfsLineSpec,
  type BlacktownGpfsSection,
} from './parse.js';

export const BLACKTOWN_GPFS_PAGE_MARKERS = {
  income_statement: 'Consolidated Income Statement',
  comprehensive_income: 'Consolidated Statement of Comprehensive Income',
  functions: 'Functions or activities – income, expenses and assets',
  special_schedule: 'Report on infrastructure assets as at 30 June 2025',
} as const;
