/**
 * Vite plugin — FormMap API  (`/__formmap/:formId.json`)
 *
 * Exposes the registered form schemas to any HTTP client (including the
 * agent service) during development.  For select fields that have a live
 * `optionsSource`, the plugin marks them accordingly; the ChatWidget is
 * responsible for fetching live options from the backend using the user's
 * auth token and injecting them into `context.wizard_catalogs`.
 *
 * Routes:
 *   GET /__formmap                  → lists all registered form ids
 *   GET /__formmap/:formId.json     → returns the form schema
 */

import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';

// Side-effect: populate the registry before any request is handled.
// This import runs in Node.js (Vite plugin context), not the browser.
import '../src/formmap/definitions';
import { formMapRegistry } from '../src/formmap/registry';

const PREFIX = '/__formmap';

function send(res: ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body, null, 2);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(json);
}

export function formmapApi(): Plugin {
  return {
    name: 'vite-plugin-formmap-api',

    configureServer(server) {
      server.middlewares.use(
        async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
          const rawUrl = req.url ?? '';

          if (!rawUrl.startsWith(PREFIX)) {
            return next();
          }

          // Strip query string and leading slash after PREFIX
          const pathPart = rawUrl.slice(PREFIX.length).split('?')[0];
          const formId = pathPart.replace(/^\//, '').replace(/\.json$/, '');

          // List endpoint: GET /__formmap  or  /__formmap/
          if (!formId) {
            return send(res, 200, {
              forms: formMapRegistry.list().map((f) => ({
                formId: f.formId,
                title: f.title,
                fieldCount: f.fields.length,
              })),
            });
          }

          const definition = formMapRegistry.get(formId);
          if (!definition) {
            return send(res, 404, { error: `Form '${formId}' not found` });
          }

          // Return schema — options for dynamic select fields are NOT resolved
          // here (requires authenticated backend calls).  The ChatWidget fetches
          // live options and sends them via context.wizard_catalogs.
          return send(res, 200, {
            formId: definition.formId,
            title: definition.title,
            generatedAt: new Date().toISOString(),
            fields: definition.fields,
          });
        },
      );
    },
  };
}
