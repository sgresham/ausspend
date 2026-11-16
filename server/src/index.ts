import 'dotenv/config';
import { createApp } from './app.js';
import { connectDatabase } from './db.js';
import { loadConfig } from './config.js';

const config = loadConfig();

await connectDatabase(config.MONGO_URL);

const app = createApp({ clientOrigin: config.CLIENT_ORIGIN });

app.listen(config.PORT, () => {
  console.log(`[api] listening on http://localhost:${config.PORT}`);
});
