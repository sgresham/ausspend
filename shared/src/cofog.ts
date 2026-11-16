import { z } from 'zod';

/**
 * The ten COFOG divisions used by the app. Codes are the two-digit
 * Classification of the Functions of Government division codes.
 */
export const COFOG_DIVISIONS = [
  { code: '01', name: 'General public services' },
  { code: '02', name: 'Defence' },
  { code: '03', name: 'Public order and safety' },
  { code: '04', name: 'Economic affairs' },
  { code: '05', name: 'Environmental protection' },
  { code: '06', name: 'Housing and community amenities' },
  { code: '07', name: 'Health' },
  { code: '08', name: 'Recreation, culture and religion' },
  { code: '09', name: 'Education' },
  { code: '10', name: 'Social protection' },
] as const;

export const COFOGDivisionSchema = z.object({
  code: z.string().regex(/^(0[1-9]|10)$/),
  name: z.string().min(1),
});

export type COFOGDivision = z.infer<typeof COFOGDivisionSchema>;
