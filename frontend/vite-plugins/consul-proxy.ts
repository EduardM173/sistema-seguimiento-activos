/**
 * Vite plugin — Consul Proxy (resolución en runtime)
 *
 * Intercepta cada request entrante al dev server de Vite.
 * Si el primer segmento del path es un servicio "activos-*", consulta
 * Consul EN ESE MOMENTO para obtener la IP y puerto actuales, y hace
 * forward de la request.
 *
 * Patrón:
 *   /<consul_service_name>/<path>  →  http://<address>:<port>/<path>
 *
 * Cada resolución queda cacheada 10 segundos para no saturar Consul,
 * pero si un servicio cambia de IP/puerto, en ≤10s se actualiza solo.
 *
 * Variables de entorno:
 *   CONSUL_HOST  — hostname del servidor Consul (default: localhost)
 *   CONSUL_PORT  — puerto del servidor Consul  (default: 8500)
 */

import http from 'node:http';
import type { Plugin } from 'vite';

// Convención de nombres: todos los servicios internos tienen prefijo "activos-"
const ACTIVOS_SERVICE_PATTERN = /^\/(activos-[^/?#]+)(\/[^?#]*)?(\?.*)?$/;

interface ConsulHealthEntry {
  Service: { Address: string; Port: number };
}

/** Pregunta a Consul por una instancia saludable del servicio. */
function consulResolve(
  consulHost: string,
  consulPort: number,
  serviceName: string,
): Promise<string | null> {
  return new Promise((resolve) => {
    const req = http.get(
      {
        host:    consulHost,
        port:    consulPort,
        path:    `/v1/health/service/${encodeURIComponent(serviceName)}?passing=true`,
        timeout: 3_000,
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk: Buffer) => { raw += chunk.toString(); });
        res.on('end', () => {
          try {
            const entries: ConsulHealthEntry[] = JSON.parse(raw);
            if (!entries.length) { resolve(null); return; }
            // Round-robin básico: elige una instancia al azar entre las saludables
            const picked = entries[Math.floor(Math.random() * entries.length)];
            const { Address, Port } = picked.Service;
            resolve(`http://${Address}:${Port}`);
          } catch { resolve(null); }
        });
      },
    );
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

export function consulProxy(): Plugin {
  return {
    name: 'consul-proxy',

    configureServer(server) {
      const consulHostRaw = process.env.CONSUL_HOST;
      const consulPortRaw = process.env.CONSUL_PORT;

      if (!consulHostRaw) throw new Error('[consul-proxy] Falta la variable de entorno CONSUL_HOST');
      if (!consulPortRaw) throw new Error('[consul-proxy] Falta la variable de entorno CONSUL_PORT');

      const consulPort = parseInt(consulPortRaw, 10);
      if (isNaN(consulPort)) throw new Error(`[consul-proxy] CONSUL_PORT no es un número válido: "${consulPortRaw}"`);

      const consulHost: string = consulHostRaw;

      // Cache con TTL corto: dinámico pero sin martillar Consul en cada request
      const cache = new Map<string, { target: string; expiresAt: number }>();

      async function resolveTarget(serviceName: string): Promise<string | null> {
        const hit = cache.get(serviceName);
        if (hit && Date.now() < hit.expiresAt) return hit.target;

        const target = await consulResolve(consulHost, consulPort, serviceName);
        if (target) {
          cache.set(serviceName, { target, expiresAt: Date.now() + 10_000 });
        }
        return target;
      }

      // Middleware añadido ANTES de los internos de Vite (HMR, assets, etc.)
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? '/';
        const match = url.match(ACTIVOS_SERVICE_PATTERN);

        // Si no matchea el patrón activos-*, dejar pasar a Vite normalmente
        if (!match) return next();

        const [, serviceName, restPath = '/', queryString = ''] = match;

        // Resolver en Consul en tiempo real
        const target = await resolveTarget(serviceName);

        if (!target) {
          console.warn(`[consul-proxy] "${serviceName}" sin instancias saludables en Consul`);
          res.writeHead(502, { 'Content-Type': 'text/plain' });
          res.end(`[consul-proxy] Servicio "${serviceName}" no disponible`);
          return;
        }

        // Reescribir URL: quitar el prefijo /<service_name>
        req.url = restPath + queryString;

        const targetUrl = new URL(target);

        // Forward de la request al servicio real
        const proxyReq = http.request(
          {
            host:    targetUrl.hostname,
            port:    Number(targetUrl.port),
            method:  req.method,
            path:    req.url,
            headers: { ...req.headers, host: targetUrl.host },
          },
          (proxyRes) => {
            res.writeHead(proxyRes.statusCode ?? 200, proxyRes.headers);
            proxyRes.pipe(res, { end: true });
          },
        );

        proxyReq.on('error', (err) => {
          console.error(`[consul-proxy] Error conectando con ${target}:`, err.message);
          if (!res.headersSent) {
            res.writeHead(502, { 'Content-Type': 'text/plain' });
            res.end(`[consul-proxy] Error de conexión con "${serviceName}"`);
          }
        });

        req.pipe(proxyReq, { end: true });
      });
    },
  };
}
