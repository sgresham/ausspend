import { z } from 'zod';

/**
 * A state or territory subdivision. M1c will populate the real records;
 * this is only the shape later items share.
 */
export const SubdivisionSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  regionId: z.string().min(1),
});

export type Subdivision = z.infer<typeof SubdivisionSchema>;
