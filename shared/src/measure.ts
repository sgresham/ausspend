import { z } from 'zod';

/**
 * The measure types understood by the app. `actual`, `budget` and `estimate`
 * are budget measures; `contract` and `grant_award` are individual federal
 * procurement/grant records. They are not comparable, so consumers must keep
 * grouping by measure type and never add across types.
 */
export const MEASURE_TYPES = ['actual', 'budget', 'estimate', 'contract', 'grant_award'] as const;

export const MeasureTypeSchema = z.enum(MEASURE_TYPES);

export type MeasureType = z.infer<typeof MeasureTypeSchema>;
