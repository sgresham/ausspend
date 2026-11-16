import { z } from 'zod';

/**
 * Provenance links may be an absolute URL or an app-relative path (the
 * synthetic seed points at `/data-sources#synthetic-seed`).
 */
export const SourceUrlSchema = z.union([
  z.url(),
  z.string().regex(/^\/[^\s]*$/, 'must be an absolute URL or an app-relative path'),
]);

/**
 * Provenance for every data point: which source it came from, where to check
 * it, and whether a human has verified that link.
 */
export const SourceRefSchema = z.object({
  source_id: z.string().min(1),
  source_url: SourceUrlSchema,
  verified: z.boolean(),
});

export type SourceRef = z.infer<typeof SourceRefSchema>;
