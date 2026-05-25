/**
 * Cliente HTTP Consul-aware para comunicación interna entre microservicios.
 *
 * Recibe un valor de ActivosService (MANDATORIO), consulta Consul para
 * obtener una instancia saludable y devuelve un AxiosInstance
 * preconfigurado con la baseURL resuelta.
 *
 * Este cliente es EXCLUSIVAMENTE para tráfico interno: nunca exponer
 * al exterior ni usar con URLs que vengan del usuario.
 */
import axios, { type AxiosInstance } from 'axios';
import { ActivosService } from './services.enum';
import { getConsulClient } from './consul';

export interface ServiceClientOptions {
  /** Timeout en ms para cada request. Default: 5000 */
  timeout?: number;
}

/**
 * Devuelve un AxiosInstance apuntando a una instancia saludable del servicio
 * indicado, eligiendo entre las disponibles en Consul con round-robin simple.
 *
 * @throws Error si no hay instancias saludables registradas en Consul.
 */
export async function createServiceClient(
  service: ActivosService,
  opts: ServiceClientOptions = {},
): Promise<AxiosInstance> {
  const consul = getConsulClient();

  // health.service devuelve solo instancias que pasan el health check
  const result = await consul.health.service({ service, passing: true });

  if (!result || result.length === 0) {
    throw new Error(
      `[Consul] No hay instancias saludables de "${service}". ` +
      `¿El servicio está corriendo y registrado en Consul?`,
    );
  }

  // Round-robin básico: elige una instancia al azar
  const node = result[Math.floor(Math.random() * result.length)];
  const { Address, Port } = node.Service as { Address: string; Port: number };

  const baseURL = `http://${Address}:${Port}`;

  console.log(`[Consul] Resolviendo "${service}" → ${baseURL}`);

  return axios.create({
    baseURL,
    timeout: opts.timeout ?? 5_000,
    headers: {
      'X-Internal-Service': 'true',
    },
  });
}
