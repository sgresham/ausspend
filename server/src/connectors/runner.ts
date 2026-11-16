import mongoose from 'mongoose';
import type { SpendingRecord } from '@ausspend/shared';
import { DataSourceModel, IngestionLogModel, MeasureModel } from '../models/index.js';
import { CONNECTORS } from './registry.js';
import type { Connector, ConnectorStatus } from './types.js';

export interface ConnectorRunResult {
  source_id: string;
  name: string;
  status: ConnectorStatus | 'error';
  log_status: 'success' | 'partial' | 'error' | 'skipped';
  records_fetched: number;
  records_upserted: number;
  errors: string[];
}

export interface IngestionRunResult {
  started_at: string;
  finished_at: string;
  results: ConnectorRunResult[];
}

export interface RunIngestionOptions {
  connectors?: readonly Connector[];
  now?: () => Date;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function measureDocument(record: SpendingRecord): Record<string, unknown> {
  const doc: Record<string, unknown> = { ...record };
  // Store absent rather than null for the optional taxonomy links, so no
  // placeholder region/function is ever invented.
  if (doc.region_id === null) delete doc.region_id;
  if (doc.function_code === null) delete doc.function_code;
  if (typeof doc.region_id === 'string') {
    doc.region_id = new mongoose.Types.ObjectId(doc.region_id);
  }
  return doc;
}

async function upsertRecord(record: SpendingRecord): Promise<void> {
  if (!record.natural_key) {
    throw new Error('transformed record has no natural_key');
  }
  await MeasureModel.updateOne(
    { natural_key: record.natural_key },
    { $set: measureDocument(record) },
    { upsert: true },
  );
}

async function recordSourceState(
  connector: Connector,
  status: ConnectorStatus,
  at: Date,
  recordsUpserted: number,
  errors: string[],
): Promise<void> {
  await DataSourceModel.updateOne(
    { source_id: connector.id },
    {
      $set: {
        status,
        last_ingested_at: at,
        records_ingested: recordsUpserted,
        errors,
      },
      $setOnInsert: {
        name: connector.name,
        publisher: connector.publisher,
        source_url: connector.source_url,
        retrieved_at: at.toISOString(),
        license: 'Not yet verified — see connector metadata',
        verified: false,
        notes: 'Registered by the ausspend ingestion runner.',
      },
    },
    { upsert: true },
  );
}

/**
 * Run every connector sequentially. A stub is logged as skipped, and a source
 * error is logged and marked degraded without aborting the rest of the run.
 */
export async function runIngestion(options: RunIngestionOptions = {}): Promise<IngestionRunResult> {
  const connectors = options.connectors ?? CONNECTORS;
  const now = options.now ?? (() => new Date());
  const runStartedAt = now();
  const results: ConnectorRunResult[] = [];

  for (const connector of connectors) {
    const startedAt = now();

    if (connector.status === 'stub') {
      const message = 'stub — not wired; skipped';
      await IngestionLogModel.create({
        source_id: connector.id,
        started_at: startedAt,
        finished_at: now(),
        status: 'skipped',
        records_fetched: 0,
        records_upserted: 0,
        errors: [],
        message,
      });
      await recordSourceState(connector, 'stub', now(), 0, []);
      results.push({
        source_id: connector.id,
        name: connector.name,
        status: 'stub',
        log_status: 'skipped',
        records_fetched: 0,
        records_upserted: 0,
        errors: [],
      });
      continue;
    }

    try {
      const raw = await connector.fetch();
      const records = connector.transform(raw);
      let upserted = 0;
      for (const record of records) {
        await upsertRecord(record);
        upserted += 1;
      }

      const errors = [...connector.metadata.errors];
      const logStatus = errors.length > 0 ? 'partial' : 'success';
      const finishedAt = now();
      connector.metadata.lastFetchedAt = finishedAt.toISOString();
      connector.metadata.recordsIngested = upserted;
      connector.metadata.errors = errors;

      await IngestionLogModel.create({
        source_id: connector.id,
        started_at: startedAt,
        finished_at: finishedAt,
        status: logStatus,
        records_fetched: raw.length,
        records_upserted: upserted,
        errors,
        message:
          errors.length > 0
            ? 'completed with errors; other sources continue'
            : 'completed successfully',
      });
      await recordSourceState(
        connector,
        errors.length > 0 ? 'degraded' : 'active',
        finishedAt,
        upserted,
        errors,
      );
      results.push({
        source_id: connector.id,
        name: connector.name,
        status: errors.length > 0 ? 'degraded' : 'active',
        log_status: logStatus,
        records_fetched: raw.length,
        records_upserted: upserted,
        errors,
      });
    } catch (error) {
      const message = errorMessage(error);
      const finishedAt = now();
      connector.metadata.lastFetchedAt = finishedAt.toISOString();
      connector.metadata.errors = [message];

      await IngestionLogModel.create({
        source_id: connector.id,
        started_at: startedAt,
        finished_at: finishedAt,
        status: 'error',
        records_fetched: 0,
        records_upserted: 0,
        errors: [message],
        message: 'source failed; run continues with the next connector',
      });
      await recordSourceState(connector, 'degraded', finishedAt, 0, [message]);
      results.push({
        source_id: connector.id,
        name: connector.name,
        status: 'error',
        log_status: 'error',
        records_fetched: 0,
        records_upserted: 0,
        errors: [message],
      });
    }
  }

  return {
    started_at: runStartedAt.toISOString(),
    finished_at: now().toISOString(),
    results,
  };
}
