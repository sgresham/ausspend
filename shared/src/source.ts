import { z } from 'zod';

/**
 * Provenance for every data point: which source it came from, where to check
 * it, and whether a human has verified that link.
 */
export const SourceRefSchema = z.object({
  source_id: z.string().min(1),
  source_url: z.url(),
  verified: z.boolean(),
});

export type SourceRef = z.infer<typeof SourceRefSchema>;
