import 'dotenv/config';
import path from 'node:path';
import express from 'express';
import { createApiApp } from './server/app.ts';
import { loadDatabase, saveDatabase } from './server/db.ts';
import { runFeeAutomationRules } from './server/automation.ts';

const PORT = Number(process.env.PORT || 3000);

async function startServer() {
  const app = await createApiApp();

  // Periodic hourly check for 10th reminder & 15th fine rules
  setInterval(async () => {
    try {
      const db = loadDatabase();
      await runFeeAutomationRules(db);
      saveDatabase(db);
    } catch (err) {
      console.error('Scheduled automation check error:', err);
    }
  }, 60 * 60 * 1000);

  // Mount Vite dev middleware or serve production build
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Ghasphul Study Point server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
