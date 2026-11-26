import 'dotenv/config';
import './config/env.js';
import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { shutdownPuppeteerPool } from './config/puppeteerPool.js';
import { seedAdmin } from './scripts/seedAdmin.js';

const PORT = Number(process.env.PORT) || 5000;
const HOST = process.env.HOST || '0.0.0.0';

async function startServer() {
  const dbStatus = await connectDatabase();

  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    try {
      await seedAdmin();
    } catch (err) {
      console.warn('[SmartTools Backend] Non-fatal admin bootstrap warning:', err.message);
    }
  }

  const app = createApp();

  const server = app.listen(PORT, HOST, () => {
    console.log(
      `[SmartTools Backend] Listening on http://${HOST}:${PORT} (db=${dbStatus.dbName}, inMemoryDB=${dbStatus.isInMemoryMode})`
    );
  });

  const gracefulExit = async () => {
    server.close();
    await Promise.allSettled([shutdownPuppeteerPool(), disconnectDatabase()]);
    process.exit(0);
  };

  process.once('SIGINT', gracefulExit);
  process.once('SIGTERM', gracefulExit);
}

startServer().catch((err) => {
  console.error('Failed to start SmartTools Backend:', err);
  process.exit(1);
});
