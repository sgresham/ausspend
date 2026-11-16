import cors from 'cors';
import express, { type ErrorRequestHandler, type RequestHandler } from 'express';
import { pingDatabase, type DbStatus } from './db.js';

export interface AppOptions {
  pingDb?: () => Promise<DbStatus>;
  clientOrigin?: string;
}

export function createApp(options: AppOptions = {}): express.Express {
  const app = express();
  const clientOrigin = options.clientOrigin ?? process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';

  app.disable('x-powered-by');
  app.use(cors({ origin: clientOrigin }));
  app.use(express.json());

  const healthHandler: RequestHandler = async (_req, res, next) => {
    try {
      const db = await (options.pingDb ?? pingDatabase)();
      res.status(200).json({ ok: true, db });
    } catch (error) {
      next(error);
    }
  };

  app.get('/api/health', healthHandler);

  app.use((req, res) => {
    res.status(404).json({ ok: false, error: 'Not found', path: req.path });
  });

  const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    console.error('[api] request failed', error);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  };
  app.use(errorHandler);

  return app;
}
