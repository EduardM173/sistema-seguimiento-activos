/**
 * Utilidades de conexión a Consul.
 *
 * Lee CONSUL_HOST y CONSUL_PORT del entorno.
 * Todos los servicios usan este módulo para registrarse y
 * darse de baja limpiamente al apagar.
 */
import Consul from 'consul';
import { ActivosService } from './services.enum';

export interface ConsulRegistrationOptions {
  /** Nombre de este servicio en el enum ActivosService */
  service: ActivosService;
  /** Puerto real en el que escucha este proceso */
  port: number;
  /**
   * Dirección (hostname o IP) con la que otros contenedores
   * pueden alcanzar este servicio. En Docker Compose corresponde
   * al nombre del servicio en el compose (p.ej. "backend").
   * Se lee de SERVICE_ADDRESS si no se pasa.
   */
  address?: string;
  /** Ruta del endpoint de health check. Default: /health */
  healthPath?: string;
}

function buildClient(): Consul | null {
  const host = process.env.CONSUL_HOST;
  if (!host) return null;

  const portRaw = process.env.CONSUL_PORT;
  if (!portRaw) throw new Error('[activos-config] CONSUL_HOST está definido pero falta CONSUL_PORT');

  const port = parseInt(portRaw, 10);
  if (isNaN(port)) throw new Error(`[activos-config] CONSUL_PORT no es un número válido: "${portRaw}"`);

  return new Consul({ host, port });
}

/**
 * Devuelve un cliente Consul configurado con las variables de entorno.
 * Útil si necesitas acceso directo al cliente para casos avanzados.
 */
export function getConsulClient(): Consul {
  const client = buildClient();
  if (!client) throw new Error('[activos-config] CONSUL_HOST no está definido');
  return client;
}

/**
 * Registra este proceso en Consul con un health check HTTP.
 * Debe llamarse una vez que el servidor HTTP está escuchando.
 *
 * @returns El id de instancia registrado (necesario para deregister).
 */
export async function registerWithConsul(
  opts: ConsulRegistrationOptions,
): Promise<string | null> {
  const client = buildClient();

  if (!client) {
    console.warn('[Consul] CONSUL_HOST no definido — registro omitido (modo desarrollo local)');
    return null;
  }

  const address = opts.address ?? process.env.SERVICE_ADDRESS ?? '127.0.0.1';
  const healthPath = opts.healthPath ?? '/health';
  // El id incluye el hostname del contenedor para soportar múltiples instancias
  const instanceId = `${opts.service}-${process.env.HOSTNAME ?? 'local'}`;

  await client.agent.service.register({
    id:      instanceId,
    name:    opts.service,
    address,
    port:    opts.port,
    tags:    ['activos'],
    check: {
      name:                            'health',
      http:                            `http://${address}:${opts.port}${healthPath}`,
      interval:                        '10s',
      timeout:                         '5s',
      deregistercriticalserviceafter:  '30s',
    },
  });

  console.log(
    `[Consul] Registrado "${opts.service}" (${instanceId}) en ${address}:${opts.port}`,
  );

  return instanceId;
}

/**
 * Elimina este proceso del registro de Consul.
 * Llama en el shutdown hook del proceso para evitar tráfico a instancias muertas.
 */
export async function deregisterFromConsul(instanceId: string | null): Promise<void> {
  if (!instanceId) return;
  const client = buildClient();
  if (!client) return;
  await client.agent.service.deregister(instanceId);
  console.log(`[Consul] Dado de baja "${instanceId}"`);
}
