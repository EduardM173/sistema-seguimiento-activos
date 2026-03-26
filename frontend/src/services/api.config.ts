// Configuración centralizada de la API - re-exporta el cliente HTTP unificado
// El cliente fetch en http.client.ts es la única implementación.

export { http as apiClient, http, HttpError } from './http.client';
export type { RequestOptions } from './http.client';
export { http as default } from './http.client';
