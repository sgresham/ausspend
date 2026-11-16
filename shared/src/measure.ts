import { z } from 'zod';

/**
 * The measure types currently understood by the app.
 * M1b may extend this union when the real spending dataset lands; consumers
 * should treat unknown future members as new cases, not silently map them.
 */
export const MEASURE_TYPES = ['actual', 'budget', 'estimate'] as const;

export const MeasureTypeSchema = z.enum(MEASURE_TYPES);

export type MeasureType = z.infer<typeof MeasureTypeSchema>;
