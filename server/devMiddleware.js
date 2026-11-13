// Run the real serverless handlers during `npm run dev` without exposing
// service credentials to the browser or requiring a separate API deployment.
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
export function backendApi() {
  return {
    name: 'vistara-backend-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next();
        res.status = code => { res.statusCode = code; return res; };
        res.json = data => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); return res; };
        try {
          const chunks = [];
          let size = 0;
          for await (const chunk of req) {
            size += chunk.length;
            if (size > 9 * 1024 * 1024) return res.status(413).json({ error: 'Request body exceeds the upload limit.' });
            chunks.push(chunk);
          }
          const raw = Buffer.concat(chunks).toString('utf8');
          req.body = raw || undefined;
          req.query = Object.fromEntries(new URL(req.url, 'http://localhost').searchParams);
          const handlerUrl = pathToFileURL(resolve(server.config.root, 'api/[...route].js')).href;
          const { default: handler } = await import(handlerUrl);
          await handler(req, res);
        } catch (error) {
          console.error('[dev-api]', error.message);
          if (!res.headersSent) res.status(500).json({ error: 'Backend request failed. Check the server log.' });
        }
      });
    },
  };
}
