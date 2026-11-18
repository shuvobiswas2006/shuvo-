import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApiApp } from '../server/app.ts';

let appPromise: ReturnType<typeof createApiApp> | null = null;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!appPromise) {
    appPromise = createApiApp();
  }
  const app = await appPromise;
  return app(req as Parameters<typeof app>[0], res as Parameters<typeof app>[1]);
}
