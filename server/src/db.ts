import mongoose from 'mongoose';

export type DbStatus = 'connected' | 'unavailable';

/**
 * Connect to the application Mongo database. A missing database must not stop
 * the skeleton server from starting; /api/health reports the live state.
 */
export async function connectDatabase(mongoUrl: string | undefined): Promise<void> {
  if (!mongoUrl) {
    console.warn('[db] MONGO_URL is not set; starting without a database connection');
    return;
  }

  try {
    await mongoose.connect(mongoUrl, { serverSelectionTimeoutMS: 2_000 });
    console.log('[db] connected');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[db] unavailable: ${message}`);
  }
}

export async function pingDatabase(): Promise<DbStatus> {
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
    return 'unavailable';
  }

  try {
    await mongoose.connection.db.admin().ping();
    return 'connected';
  } catch {
    return 'unavailable';
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
