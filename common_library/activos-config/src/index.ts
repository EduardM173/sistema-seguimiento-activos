// Punto de entrada principal (Node.js).
// Exporta todo: enum + utilidades Consul + cliente HTTP.
export { ActivosService }                   from './services.enum';
export { getConsulClient,
         registerWithConsul,
         deregisterFromConsul }             from './consul';
export type { ConsulRegistrationOptions }   from './consul';
export { createServiceClient }              from './http.client';
export type { ServiceClientOptions }        from './http.client';
