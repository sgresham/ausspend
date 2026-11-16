import { z } from 'zod';

/**
 * Money is always represented as a non-negative integer number of cents.
 * Never use floating point dollars for stored spending values.
 */
export const MoneyCentsSchema = z.number().int().nonnegative();

export type MoneyCents = z.infer<typeof MoneyCentsSchema>;
