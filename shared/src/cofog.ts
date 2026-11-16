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

export const COFOGDivisionCodeSchema = z.string().regex(/^(0[1-9]|10)$/);

export const COFOGDivisionSchema = z.object({
  code: COFOGDivisionCodeSchema,
  name: z.string().min(1),
});

export type COFOGDivision = z.infer<typeof COFOGDivisionSchema>;

/**
 * Curated COFOG subdivisions. Codes are three digits: the first two are the
 * parent division, the third is the subdivision number. The set is a curated
 * subset of the standard COFOG second level, not an exhaustive list.
 */
const COFOG_SUBDIVISION_DATA = [
  {
    code: '011',
    name: 'Executive and legislative organs, financial and fiscal affairs',
    parent_code: '01',
  },
  { code: '013', name: 'General services', parent_code: '01' },
  { code: '017', name: 'Public debt transactions', parent_code: '01' },
  { code: '021', name: 'Military defence', parent_code: '02' },
  { code: '022', name: 'Civil defence', parent_code: '02' },
  { code: '031', name: 'Police services', parent_code: '03' },
  { code: '032', name: 'Fire-protection services', parent_code: '03' },
  { code: '033', name: 'Law courts', parent_code: '03' },
  { code: '034', name: 'Prisons', parent_code: '03' },
  { code: '041', name: 'General economic, commercial and labour affairs', parent_code: '04' },
  { code: '042', name: 'Agriculture, forestry, fishing and hunting', parent_code: '04' },
  { code: '043', name: 'Fuel and energy', parent_code: '04' },
  { code: '044', name: 'Mining, manufacturing and construction', parent_code: '04' },
  { code: '045', name: 'Transport', parent_code: '04' },
  { code: '046', name: 'Communication', parent_code: '04' },
  { code: '051', name: 'Waste management', parent_code: '05' },
  { code: '052', name: 'Water waste management', parent_code: '05' },
  { code: '053', name: 'Pollution abatement', parent_code: '05' },
  { code: '054', name: 'Protection of biodiversity and landscape', parent_code: '05' },
  { code: '061', name: 'Housing development', parent_code: '06' },
  { code: '062', name: 'Community development', parent_code: '06' },
  { code: '063', name: 'Water supply', parent_code: '06' },
  { code: '071', name: 'Medical products, appliances and equipment', parent_code: '07' },
  { code: '072', name: 'Outpatient services', parent_code: '07' },
  { code: '073', name: 'Hospital services', parent_code: '07' },
  { code: '074', name: 'Public health services', parent_code: '07' },
  { code: '075', name: 'R&D health', parent_code: '07' },
  { code: '081', name: 'Recreational and sporting services', parent_code: '08' },
  { code: '082', name: 'Cultural services', parent_code: '08' },
  { code: '083', name: 'Broadcasting and publishing services', parent_code: '08' },
  { code: '084', name: 'Religious and other community services', parent_code: '08' },
  { code: '091', name: 'Pre-primary and primary education', parent_code: '09' },
  { code: '092', name: 'Secondary education', parent_code: '09' },
  { code: '093', name: 'Post-secondary non-tertiary education', parent_code: '09' },
  { code: '094', name: 'Tertiary education', parent_code: '09' },
  { code: '095', name: 'Education not definable by level', parent_code: '09' },
  { code: '101', name: 'Sickness and disability', parent_code: '10' },
  { code: '102', name: 'Old age', parent_code: '10' },
  { code: '103', name: 'Survivors', parent_code: '10' },
  { code: '104', name: 'Family and children', parent_code: '10' },
  { code: '105', name: 'Unemployment', parent_code: '10' },
  { code: '106', name: 'Housing', parent_code: '10' },
  { code: '107', name: 'Social exclusion', parent_code: '10' },
] as const;

export const COFOG_SUBDIVISIONS = COFOG_SUBDIVISION_DATA.map((subdivision) => ({
  ...subdivision,
  level: 'subdivision' as const,
}));

export const COFOGSubdivisionSchema = z.object({
  code: z.string().regex(/^(0[1-9]|10)\d$/),
  name: z.string().min(1),
  parent_code: COFOGDivisionCodeSchema,
  level: z.literal('subdivision'),
});

export type COFOGSubdivision = z.infer<typeof COFOGSubdivisionSchema>;

export const FUNCTION_LEVELS = ['division', 'subdivision'] as const;

export const FunctionLevelSchema = z.enum(FUNCTION_LEVELS);

export type FunctionLevel = z.infer<typeof FunctionLevelSchema>;

export const FunctionSchema = z.object({
  code: z.string().min(2),
  name: z.string().min(1),
  level: FunctionLevelSchema,
  parent_code: z.string().min(2).optional(),
});

export type FunctionRecord = z.infer<typeof FunctionSchema>;
