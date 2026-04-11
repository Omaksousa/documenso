// This file is the entry point for the React Router SSR client server.
// It serves the built client assets and proxies API requests to the API server.
// ONLY USED IN PRODUCTION.
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import handle from 'hono-react-router-adapter/node';

import * as build from './index.js';

const serverUrl = process.env.SERVER_URL ?? 'http://localhost:3001';
const port = parseInt(process.env.PORT ?? '3000', 10);

const app = new Hono();

// Proxy ALL API requests to the API server. (Frontend -> Proxy -> API server)
// Return response from API server as is. Not touched.
app.all('/api/*', async (c) => {
  const url = new URL(c.req.url);
  const targetUrl = `${serverUrl}${url.pathname}${url.search}`;

  const response = await fetch(targetUrl, {
    method: c.req.method,
    headers: c.req.raw.headers,
    body: ['GET', 'HEAD'].includes(c.req.method) ? undefined : c.req.raw.body,
    duplex: 'half',
  });

  return new Response(response.body, {
    status: response.status,
    headers: response.headers,
  });
});

// Serve static files from the client build output.
app.use(
  serveStatic({
    root: 'build/client',
    onFound: (path, c) => {
      if (path.startsWith('build/client/assets')) {
        c.header('Cache-Control', 'public, immutable, max-age=31536000');
      } else {
        c.header('Cache-Control', 'public, max-age=0, stale-while-revalidate=86400');
      }
    },
  }),
);

const handler = handle(build, app);

serve({ fetch: handler.fetch, port }, (info) => {
  console.log(`Client server listening on http://localhost:${info.port}`);
});
