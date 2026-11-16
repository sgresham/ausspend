import { z } from 'zod';

/**
 * Region levels understood by the app. `region` is reserved for future
 * sub-state regions; the curated seed has a national row and eight
 * state/territory rows.
 */
export const REGION_LEVELS = ['national', 'state', 'region'] as const;

export const RegionLevelSchema = z.enum(REGION_LEVELS);

export type RegionLevel = z.infer<typeof RegionLevelSchema>;

export const RegionSchema = z.object({
  _id: z.string().min(1),
  code: z.string().min(2),
  name: z.string().min(1),
  level: RegionLevelSchema,
  parent_code: z.string().min(2).optional(),
});

export type RegionRecord = z.infer<typeof RegionSchema>;

/**
 * The national row plus the eight Australian states and territories. Shared so
 * the seed, API and tests use one list. Codes are the standard state
 * abbreviations; the national row uses `AUS`.
 */
export const AUSTRALIAN_REGIONS = [
  { code: 'AUS', name: 'Australia', level: 'national' },
  { code: 'NSW', name: 'New South Wales', level: 'state' },
  { code: 'VIC', name: 'Victoria', level: 'state' },
  { code: 'QLD', name: 'Queensland', level: 'state' },
  { code: 'WA', name: 'Western Australia', level: 'state' },
  { code: 'SA', name: 'South Australia', level: 'state' },
  { code: 'TAS', name: 'Tasmania', level: 'state' },
  { code: 'ACT', name: 'Australian Capital Territory', level: 'state' },
  { code: 'NT', name: 'Northern Territory', level: 'state' },
] as const;

export type AustralianRegion = (typeof AUSTRALIAN_REGIONS)[number];

/**
 * The one local-government region added in S3. The `code` is a stable
 * state-prefixed identifier; `slug` is the short, case-insensitive handle used
 * by /regions/dubbo, /region/dubbo, /areas/dubbo and ?area=dubbo. The `_id` is
 * the same deterministic id the Dubbo adapter writes on every local row.
 */
export const DUBBO_REGION = {
  _id: '40d7a238d4b2cef48ae5f267',
  code: 'NSW-DUBBO',
  slug: 'dubbo',
  name: 'Dubbo',
  level: 'region',
  parent_code: 'NSW',
} as const;

/** Lower-case slug used by the area contract; other regions fall back to their code. */
export function regionSlug(region: { code: string; name: string; level: string }): string {
  if (region.code.toUpperCase() === DUBBO_REGION.code) return DUBBO_REGION.slug;
  return region.code.toLowerCase();
}
