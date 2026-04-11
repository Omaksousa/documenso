import { serve } from '@hono/node-server';

import app from './router';

const port = parseInt(process.env.SERVER_PORT ?? '3001', 10);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`API server listening on http://localhost:${info.port}`);
});
