/**
 * P3 backfill: promote the NSW ArcGIS project metadata that is already present
 * in each `nsw-budget` project row's `notes` into the explicit structured
 * fields. This is a metadata-only update:
 *
 *   - it reads the existing rows (no re-download, no re-ingest, no deletes);
 *   - it never writes `amount_cents`, `natural_key`, `measure_type` or
 *     `fiscal_year`;
 *   - the 312 statement rows are counted and verified to carry none of the
 *     project fields, and are never updated;
 *   - a dry run is the default; `--apply` performs the update.
 *
 *   MONGO_URL=mongodb://localhost:27017/ausspend_dev \
 *     npx tsx scripts/backfill-nsw-project-fields.ts [--apply]
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { assertSeedTarget } from '../server/src/seed/guard.js';
import {
  nswProjectDimension,
  nswProjectRegion,
} from '../server/src/connectors/nsw-budget-open-data.js';

const PROJECT_FIELDS = [
  'project_id',
  'agency',
  'sector',
  'cluster',
  'electorate',
  'region',
  'lga',
  'status',
  'category',
  'budget_year',
] as const;

type ProjectField = (typeof PROJECT_FIELDS)[number];

interface MeasureDoc {
  _id: mongoose.Types.ObjectId;
  amount_cents: number;
  notes?: string;
  project_id?: string;
  source_url?: string;
}

function noteValue(notes: string | undefined, key: string): string | null {
  if (!notes) return null;
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = notes.match(new RegExp(`(?:^|; )${escaped} (.*?)(?=; |$)`));
  return match?.[1] ?? null;
}

function notNone(value: string | null): string | null {
  return value === null || value === '(none)' ? null : value;
}

export function projectFieldsFromNotes(
  notes: string | undefined,
): Partial<Record<ProjectField, string>> {
  const budgetYear = noteValue(notes, 'Budget_Year_FY_2025_26_000');
  if (!budgetYear) {
    throw new Error('project note is missing Budget_Year_FY_2025_26_000');
  }
  const cleaned: Record<ProjectField, string | undefined> = {
    project_id: nswProjectDimension(notNone(noteValue(notes, 'Project_ID'))) ?? undefined,
    agency: nswProjectDimension(notNone(noteValue(notes, 'agency'))) ?? undefined,
    sector: nswProjectDimension(notNone(noteValue(notes, 'sector'))) ?? undefined,
    cluster: nswProjectDimension(notNone(noteValue(notes, 'cluster'))) ?? undefined,
    electorate: nswProjectDimension(notNone(noteValue(notes, 'electorate'))) ?? undefined,
    region: nswProjectRegion(notNone(noteValue(notes, 'region'))) ?? undefined,
    lga: nswProjectDimension(notNone(noteValue(notes, 'LGA'))) ?? undefined,
    status: nswProjectDimension(notNone(noteValue(notes, 'status'))) ?? undefined,
    category: nswProjectDimension(notNone(noteValue(notes, 'category'))) ?? undefined,
    // The source field itself is `Budget_Year_FY_2025_26_000`; a row without
    // that note is not an ArcGIS project row and is rejected above.
    budget_year: '2025-26',
  };
  const present: Partial<Record<ProjectField, string>> = {};
  for (const [field, value] of Object.entries(cleaned) as Array<
    [ProjectField, string | undefined]
  >) {
    if (value !== undefined) present[field] = value;
  }
  return present;
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const mongoUrl = process.env.MONGO_URL;
  const databaseName = assertSeedTarget(mongoUrl);
  await mongoose.connect(mongoUrl as string, { serverSelectionTimeoutMS: 5_000 });

  try {
    const collection = mongoose.connection.db!.collection<MeasureDoc>('measures');
    const nswFilter = { source_id: 'nsw-budget' };
    const arcgisFilter = { source_id: 'nsw-budget', source_url: /arcgis/ };
    const statementFilter = {
      source_id: 'nsw-budget',
      source_url: /budget\.nsw\.gov\.au/,
    };

    const beforeCount = await collection.countDocuments(nswFilter);
    const beforeProjects = await collection.countDocuments(arcgisFilter);
    const beforeStatements = await collection.countDocuments(statementFilter);
    const beforeAmount = (
      await collection
        .aggregate([
          { $match: nswFilter },
          { $group: { _id: null, cents: { $sum: '$amount_cents' } } },
        ])
        .toArray()
    )[0]?.cents as number | undefined;
    if (beforeCount !== 1_115 || beforeProjects !== 803 || beforeStatements !== 312) {
      throw new Error(
        `unexpected nsw-budget shape: ${beforeCount} total / ${beforeProjects} projects / ${beforeStatements} statements`,
      );
    }

    const docs = await collection.find(arcgisFilter).toArray();
    const updates: Array<{
      updateOne: {
        filter: { _id: mongoose.Types.ObjectId };
        update: Record<string, unknown>;
      };
    }> = [];
    for (const doc of docs) {
      const fields = projectFieldsFromNotes(doc.notes);
      const set: Record<string, unknown> = { ...fields };
      const unset: Record<string, ''> = {};
      if (!fields.lga) {
        // A multi-LGA ("Various") project must not be pinned to one LGA.
        set.data_quality_flag = 'statewide_only';
        unset['location.lga_name'] = '';
      }
      updates.push({
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: set, ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}) },
        },
      });
    }
    const parsed = docs.map((doc) => projectFieldsFromNotes(doc.notes));
    if (parsed.length !== 803)
      throw new Error(`expected 803 parsed projects, got ${parsed.length}`);
    const missingProjectId = parsed.filter((fields) => !fields.project_id).length;
    const missingElectorate = parsed.filter((fields) => !fields.electorate).length;
    const missingLga = parsed.filter((fields) => !fields.lga).length;
    const missingRegion = parsed.filter((fields) => !fields.region).length;

    const statementWithProjectFields = await collection.countDocuments({
      ...statementFilter,
      $or: PROJECT_FIELDS.map((field) => ({ [field]: { $exists: true } })),
    });
    if (statementWithProjectFields !== 0) {
      throw new Error(
        `${statementWithProjectFields} statement rows already carry project fields; refusing to overwrite`,
      );
    }

    console.log(
      `[nsw-p3] target=${databaseName} nsw=${beforeCount} projects=${beforeProjects} statements=${beforeStatements} amount_cents=${beforeAmount}`,
    );
    console.log(
      `[nsw-p3] parsed ${updates.length}/803 project rows, sample=${JSON.stringify(updates[0]?.updateOne.update.$set)}`,
    );
    console.log(
      `[nsw-p3] absent (published placeholder/ambiguous, never guessed): project_id=${missingProjectId} electorate=${missingElectorate} lga=${missingLga} region=${missingRegion}`,
    );
    if (!apply) {
      console.log('[nsw-p3] dry run: pass --apply to write the 803 metadata updates');
      return;
    }

    const result = await collection.bulkWrite(updates, { ordered: true });
    const afterCount = await collection.countDocuments(nswFilter);
    const afterAmount = (
      await collection
        .aggregate([
          { $match: nswFilter },
          { $group: { _id: null, cents: { $sum: '$amount_cents' } } },
        ])
        .toArray()
    )[0]?.cents as number | undefined;
    const requiredFields = ['agency', 'sector', 'status', 'category', 'budget_year'] as const;
    const structured = await collection.countDocuments({
      ...arcgisFilter,
      ...Object.fromEntries(requiredFields.map((field) => [field, { $exists: true }])),
    });
    if (afterCount !== beforeCount || afterAmount !== beforeAmount) {
      throw new Error(
        `invariant broken: count ${beforeCount}->${afterCount}, amount ${beforeAmount}->${afterAmount}`,
      );
    }
    console.log(
      `[nsw-p3] updated=${result.modifiedCount} matched=${result.matchedCount} structured=${structured}/803 count=${afterCount} amount_cents=${afterAmount} (unchanged)`,
    );
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(`[nsw-p3] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
