/**
 * Vite plugin — Deeplink API.
 *
 * Exposes the framework-agnostic `DeeplinkRegistry` over HTTP so an external
 * agent (LLM, browser extension, integration tests, etc.) can introspect the
 * navigable surface of the SPA without running a browser.
 *
 * Endpoints (mounted under `/__deeplink/*` to avoid clashing with the existing
 * `/api/*` proxy that targets the NestJS backend):
 *
 *   GET /__deeplink/navigation-map.json            — full navigation map
 *   GET /__deeplink/pages/:pageId.json             — submap for a single page
 *   GET /__deeplink/pages.json                     — flat list of page ids
 *   GET /__deeplink/build-url?pageId=...&modalId=...&<param>=...
 *                                                  — { url } for a target
 *   GET /__deeplink/parse?url=...                  — parsed DeeplinkLocation
 *   GET /__deeplink/openapi.json                   — minimal OpenAPI 3 spec
 *
 * In production (no Node server), the same `navigation-map.json` is also
 * emitted as a static file under `public/__deeplink/` during `vite build`,
 * so `GET /__deeplink/navigation-map.json` keeps working when the SPA is
 * served by any static host.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';

import '../src/deeplink/definitions'; // side-effect: registers all pages
import { deeplinkRegistry } from '../src/deeplink/registry';
import type { DeeplinkTarget } from '../src/deeplink/types';


const PREFIX = '/__deeplink';

function send(res: ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body, null, 2);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(json);
}

function parsePermissions(url: URL): string[] | undefined {
  const raw = url.searchParams.get('permissions');
  if (!raw) return undefined;
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function handle(req: IncomingMessage, res: ServerResponse): boolean {
  const rawUrl = req.url ?? '';
  if (!rawUrl.startsWith(PREFIX)) return false;

  const url = new URL(rawUrl, 'http://localhost');
  const pathname = url.pathname.slice(PREFIX.length) || '/';
  const permissions = parsePermissions(url);

  try {
    // GET /__deeplink/navigation-map.json
    if (pathname === '/navigation-map.json' || pathname === '/navigation-map') {
      send(res, 200, deeplinkRegistry.getNavigationMap({ permissions }));
      return true;
    }

    // GET /__deeplink/pages.json — flat list
    if (pathname === '/pages.json' || pathname === '/pages') {
      send(res, 200, {
        pages: deeplinkRegistry.listPages().map((p) => ({
          id: p.id,
          path: p.path,
          title: p.title,
          tags: p.tags,
          requiredPermission: p.requiredPermission,
        })),
      });
      return true;
    }

    // GET /__deeplink/pages/:pageId(.json)
    const pageMatch = /^\/pages\/([^/]+?)(?:\.json)?$/.exec(pathname);
    if (pageMatch) {
      const pageId = decodeURIComponent(pageMatch[1]);
      const map = deeplinkRegistry.getNavigationMap({ pageId, permissions });
      if (map.pages.length === 0) {
        send(res, 404, { error: 'page_not_found', pageId });
        return true;
      }
      send(res, 200, map);
      return true;
    }

    // GET /__deeplink/build-url?pageId=...&modalId=...&<param>=...
    if (pathname === '/build-url' || pathname === '/build-url.json') {
      const pageId = url.searchParams.get('pageId');
      if (!pageId) {
        send(res, 400, { error: 'missing_pageId' });
        return true;
      }
      const params: Record<string, string> = {};
      url.searchParams.forEach((v, k) => {
        if (k === 'pageId' || k === 'modalId' || k === 'permissions') return;
        params[k] = v;
      });
      const target: DeeplinkTarget = {
        pageId,
        modalId: url.searchParams.get('modalId') ?? undefined,
        params,
      };
      try {
        send(res, 200, { url: deeplinkRegistry.buildUrl(target), target });
      } catch (err) {
        send(res, 400, { error: 'invalid_target', message: String((err as Error).message) });
      }
      return true;
    }

    // GET /__deeplink/parse?url=/activos?modal=create-asset
    if (pathname === '/parse' || pathname === '/parse.json') {
      const target = url.searchParams.get('url');
      if (!target) {
        send(res, 400, { error: 'missing_url' });
        return true;
      }
      const parsed = new URL(target, 'http://localhost');
      send(res, 200, deeplinkRegistry.parseLocation(parsed.pathname, parsed.search));
      return true;
    }

    // GET /__deeplink/openapi.json
    if (pathname === '/openapi.json') {
      send(res, 200, buildOpenApiSpec());
      return true;
    }

    // GET /__deeplink/  — index of routes
    if (pathname === '/' || pathname === '') {
      send(res, 200, {
        endpoints: [
          'GET /__deeplink/navigation-map.json',
          'GET /__deeplink/pages.json',
          'GET /__deeplink/pages/:pageId.json',
          'GET /__deeplink/build-url?pageId=&modalId=&...',
          'GET /__deeplink/parse?url=...',
          'GET /__deeplink/openapi.json',
        ],
        query: { permissions: 'comma-separated permission codes (optional)' },
      });
      return true;
    }

    send(res, 404, { error: 'not_found', pathname });
    return true;
  } catch (err) {
    send(res, 500, { error: 'internal_error', message: String((err as Error).message) });
    return true;
  }
}

function buildOpenApiSpec(): unknown {
  return {
    openapi: '3.0.0',
    info: {
      title: 'Deeplink Engine API',
      version: '1.0.0',
      description:
        'Read-only introspection API exposing every page/modal/action in the SPA. Designed for AI tool-calling: a model can call `navigation-map.json` to discover what the app can do, then call `build-url` to obtain a deeplink to a target.',
    },
    servers: [{ url: '/__deeplink' }],
    paths: {
      '/navigation-map.json': {
        get: {
          summary: 'Full navigation map (every page, modal, action).',
          parameters: [
            {
              name: 'permissions',
              in: 'query',
              schema: { type: 'string' },
              description: 'Optional comma-separated permission codes; flags `accessible` per item.',
            },
          ],
          responses: { '200': { description: 'NavigationMap' } },
        },
      },
      '/pages.json': {
        get: { summary: 'Flat list of registered page ids.', responses: { '200': { description: 'OK' } } },
      },
      '/pages/{pageId}.json': {
        get: {
          summary: 'Submap scoped to a single page (with its modals/actions).',
          parameters: [{ name: 'pageId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'NavigationMap' }, '404': { description: 'Unknown page' } },
        },
      },
      '/build-url': {
        get: {
          summary: 'Build a deeplink URL for a (pageId, modalId?, params?) target.',
          parameters: [
            { name: 'pageId', in: 'query', required: true, schema: { type: 'string' } },
            { name: 'modalId', in: 'query', required: false, schema: { type: 'string' } },
          ],
          responses: { '200': { description: '{ url, target }' }, '400': { description: 'Invalid target' } },
        },
      },
      '/parse': {
        get: {
          summary: 'Parse an in-app URL into a structured DeeplinkLocation.',
          parameters: [{ name: 'url', in: 'query', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'DeeplinkLocation' } },
        },
      },
    },
  };
}

/** The plugin itself. */
export function deeplinkApi(): Plugin {
  return {
    name: 'deeplink-api',

    /** Dev/preview server: middleware. */
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!handle(req, res)) next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!handle(req, res)) next();
      });
    },

    /**
     * Build: emit static JSON snapshots so the same endpoints work in
     * production (when a static host is serving `dist/`).
     *
     * Note: emitted files are unauthenticated by definition (static). The
     * navigation map exposes only metadata about routes/modals — no user data.
     */
    async writeBundle(opts) {
      const outDir = opts.dir ?? 'dist';
      const targetDir = path.join(outDir, '__deeplink');
      await fs.mkdir(path.join(targetDir, 'pages'), { recursive: true });

      // Full map (no permission filter — caller-side concern).
      const fullMap = deeplinkRegistry.getNavigationMap();
      await fs.writeFile(
        path.join(targetDir, 'navigation-map.json'),
        JSON.stringify(fullMap, null, 2),
        'utf8',
      );

      // Pages index.
      await fs.writeFile(
        path.join(targetDir, 'pages.json'),
        JSON.stringify(
          {
            pages: deeplinkRegistry.listPages().map((p) => ({
              id: p.id,
              path: p.path,
              title: p.title,
              tags: p.tags,
              requiredPermission: p.requiredPermission,
            })),
          },
          null,
          2,
        ),
        'utf8',
      );

      // One file per page.
      for (const page of deeplinkRegistry.listPages()) {
        const submap = deeplinkRegistry.getNavigationMap({ pageId: page.id });
        await fs.writeFile(
          path.join(targetDir, 'pages', `${page.id}.json`),
          JSON.stringify(submap, null, 2),
          'utf8',
        );
      }

      await fs.writeFile(
        path.join(targetDir, 'openapi.json'),
        JSON.stringify(buildOpenApiSpec(), null, 2),
        'utf8',
      );
    },
  };
}
