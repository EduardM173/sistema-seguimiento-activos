import { http as apiClient } from './http.client';
import type { Auditoria, FiltrosAuditoria, ResumenAuditoria, Notificacion, ConfiguracionAuditoria } from '../types/auditoria.types';
import type { PaginatedResponse, ApiResponse } from '../types';

export const auditoriaService = {
  // Obtener registros de auditoría
  obtenerRegistros: async (filtros?: FiltrosAuditoria) => {
    try {
      const response = await apiClient.get<PaginatedResponse<Auditoria>>('/auditoria', {
        params: filtros,
      });
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Obtener un registro específico
  obtenerPorId: async (id: string) => {
    try {
      const response = await apiClient.get<ApiResponse<Auditoria>>(`/auditoria/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Obtener resumen de auditoría
  obtenerResumen: async () => {
    try {
      const response = await apiClient.get<ApiResponse<ResumenAuditoria>>('/auditoria/resumen');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Obtener historial de cambios de un recurso
  obtenerHistorialRecurso: async (recursoTipo: string, recursoId: string) => {
    try {
      const response = await apiClient.get<PaginatedResponse<Auditoria>>(
        `/auditoria/recurso/${recursoTipo}/${recursoId}`
      );
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Obtener historial de usuario
  obtenerHistorialUsuario: async (usuarioId: string) => {
    try {
      const response = await apiClient.get<PaginatedResponse<Auditoria>>(
        `/auditoria/usuario/${usuarioId}`
      );
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Exportar auditoría
  exportar: async (formato: 'excel' | 'csv' | 'pdf', filtros?: FiltrosAuditoria) => {
    try {
      const response = await apiClient.get(`/auditoria/exportar/${formato}`, {
        params: filtros,
        responseType: 'blob',
      });
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Obtener configuración de auditoría
  obtenerConfiguracion: async () => {
    try {
      const response = await apiClient.get<ApiResponse<ConfiguracionAuditoria>>(
        '/auditoria/configuracion'
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Actualizar configuración de auditoría
  actualizarConfiguracion: async (datos: Partial<ConfiguracionAuditoria>) => {
    try {
      const response = await apiClient.put<ApiResponse<ConfiguracionAuditoria>>(
        '/auditoria/configuracion',
        datos
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Limpiar registros antiguos
  limpiarRegistros: async (diasAntiguedad: number) => {
    try {
      const response = await apiClient.post<ApiResponse<{
        registrosBorrados: number;
        fechaEjecucion: Date;
      }>>('/auditoria/limpiar', { diasAntiguedad });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // ===== NOTIFICACIONES =====

  // Obtener notificaciones del usuario
  obtenerNotificaciones: async (leidas?: boolean) => {
    try {
      const response = await apiClient.get<PaginatedResponse<Notificacion>>(
        '/auditoria/notificaciones',
        {
          params: leidas !== undefined ? { leidas } : {},
        }
      );
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Obtener notificaciones del usuario autenticado
  obtenerMisNotificaciones: async (params?: {
    leidas?: boolean;
    page?: number;
    pageSize?: number;
  }) => {
    try {
      const response = await apiClient.get<PaginatedResponse<Notificacion>>(
        '/auditoria/notificaciones/mias',
        {
          params: {
            ...(params?.leidas !== undefined ? { leidas: params.leidas } : {}),
            ...(params?.page !== undefined ? { page: params.page } : {}),
            ...(params?.pageSize !== undefined ? { pageSize: params.pageSize } : {}),
          },
        }
      );
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Marcar notificación como leída
  marcarLeida: async (notificacionId: string) => {
    try {
      const response = await apiClient.post<ApiResponse<Notificacion>>(
        `/auditoria/notificaciones/${notificacionId}/marcar-leida`
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Marcar todas las notificaciones como leídas
  marcarTodasLeidas: async () => {
    try {
      const response = await apiClient.post<ApiResponse<{ marcadas: number }>>(
        '/auditoria/notificaciones/marcar-todas-leidas'
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Eliminar notificación
  eliminarNotificacion: async (notificacionId: string) => {
    try {
      const response = await apiClient.delete<ApiResponse<void>>(
        `/auditoria/notificaciones/${notificacionId}`
      );
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Obtener contador de notificaciones no leídas
  obtenerContador: async () => {
    try {
      const response = await apiClient.get<ApiResponse<{ total: number }>>(
        '/auditoria/notificaciones/contador'
      );
      return response.data?.total || 0;
    } catch (error) {
      throw error;
    }
  },
};

export default auditoriaService;
