import { homedir } from 'node:os';
import path from 'node:path';
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.string().optional(),
  PORT: z.coerce.number().int().positive().default(3001),
  SERVER_PORT: z.coerce.number().int().positive().optional(),
  CLIENT_PORT: z.coerce.number().int().positive().optional(),
  MONGO_URL: z.string().min(1).default('mongodb://localhost:27017/ausspend_dev'),
  CLIENT_ORIGIN: z.url().default('http://localhost:5173'),
  AUSSPEND_SOURCE_ARCHIVE: z
    .string()
    .min(1)
    .default(path.join(homedir(), 'ausspend-source-archive')),
  AUSSPEND_BACKUP_ROOT: z.string().min(1).default(path.join(homedir(), 'ausspend-backups')),
  AUSSPEND_DEPLOY_ROOT: z.string().min(1).default(path.join(homedir(), 'ausspend')),
  AUSSPEND_TLS_DIR: z
    .string()
    .min(1)
    .default(path.join(homedir(), '.config', 'ausspend', 'tls')),
});

export type AppConfig = z.infer<typeof EnvSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const config = EnvSchema.parse(env);
  // Production must be explicit: no silent localhost fallback in a deployment.
  if (config.NODE_ENV === 'production' && !env.MONGO_URL?.trim()) {
    throw new Error('MONGO_URL is required in production');
  }
  return config;
}
