import 'dotenv/config';
import { createApp } from './app.js';
import { connectDatabase } from './config/db.js';
import { shutdownPuppeteerPool } from './config/puppeteerPool.js';

const PORT = Number(process.env.PORT) || 5000;

async function startServer() {
  const dbStatus = await connectDatabase();
  const app = createApp();

  const server = app.listen(PORT, () => {
    console.log(
      `[SmartTools Backend] Listening on http://localhost:${PORT} (inMemoryDB=${dbStatus.isInMemoryMode})`
    );
  });

  const gracefulExit = async () => {
    server.close();
    await shutdownPuppeteerPool();
    process.exit(0);
  };

  process.once('SIGINT', gracefulExit);
  process.once('SIGTERM', gracefulExit);
}

startServer().catch((err) => {
  console.error('Failed to start SmartTools Backend:', err);
  process.exit(1);
});
