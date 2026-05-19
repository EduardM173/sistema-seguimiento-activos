import { getAccessToken } from './auth.service';
import type {
  AuditoriaMsFiltros,
  AuditoriaMsListadoResponse,
  AuditoriaMsRegistro,
  AuditoriaMsResponse,
  AuditoriaMsUsuario,
} from '../types/auditoria-ms.types';

const AUDIT_API_URL = import.meta.env.VITE_AUDIT_API_URL || 'http://localhost:3002/api';

class AuditoriaMsError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AuditoriaMsError';
    this.status = status;
  }
}

async function request<T>(endpoint: string, params?: Record<string, unknown>): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const url = new URL(`${AUDIT_API_URL}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers,
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new AuditoriaMsError(payload?.message || 'Error en microservicio de auditoría', response.status);
  }

  return payload as T;
}

export const auditoriaMsService = {
  health: async () => {
    const response = await fetch((import.meta.env.VITE_AUDIT_API_URL || 'http://localhost:3002/api').replace('/api', '/health'));
    return response.ok;
  },

  obtenerUsuarios: async () => {
    return request<AuditoriaMsResponse<AuditoriaMsUsuario[]>>('/auditoria/usuarios');
  },

  obtenerRegistros: async (filtros?: AuditoriaMsFiltros) => {
    return request<AuditoriaMsListadoResponse>('/auditoria/registros', filtros);
  },

  obtenerRegistroPorId: async (id: string) => {
    return request<AuditoriaMsResponse<AuditoriaMsRegistro>>(`/auditoria/registros/${id}`);
  },
};

export { AuditoriaMsError };
