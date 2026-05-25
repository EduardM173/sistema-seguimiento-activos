/**
 * Enum canónico de servicios del sistema Activos.
 * El valor de cada entrada ES el nombre con el que el servicio
 * se registra en Consul. Úsalo como prefijo de ruta en el gateway.
 *
 * Este archivo es seguro para importar en el browser (sin deps de Node.js).
 */
export enum ActivosService {
  BACKEND   = 'activos-backend',
  REPORTS   = 'activos-reports',
  AUDITORIA = 'activos-auditoria',
  AGENT     = 'activos-agent',
}
