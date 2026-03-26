import { http as apiClient } from './http.client';
import type { AsignacionActivo, TransferenciaActivo, CreateAsignacionDTO, CreateTransferenciaDTO, FiltrosTransferencias, ResumenOperacion, AprobarTransferenciaDTO } from '../types/transferencias.types';
import type { PaginatedResponse, ApiResponse } from '../types';

export const transferenciasService = {
  // ===== ASIGNACIONES =====

  // Obtener asignaciones
  obtenerAsignaciones: async () => {
    try {
      const response = await apiClient.get<PaginatedResponse<AsignacionActivo>>(
        '/transferencias/asignaciones'
      );
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Crear asignación
  crearAsignacion: async (datos: CreateAsignacionDTO) => {
    try {
      const response = await apiClient.post<ApiResponse<AsignacionActivo>>(
        '/transferencias/asignaciones',
        datos
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Terminar asignación
  terminarAsignacion: async (asignacionId: string) => {
    try {
      const response = await apiClient.post<ApiResponse<AsignacionActivo>>(
        `/transferencias/asignaciones/${asignacionId}/terminar`
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // ===== TRANSFERENCIAS =====

  // Obtener transferencias
  obtenerTransferencias: async (filtros?: FiltrosTransferencias) => {
    try {
      const response = await apiClient.get<PaginatedResponse<TransferenciaActivo>>(
        '/transferencias',
        {
          params: filtros,
        }
      );
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Obtener una transferencia específica
  obtenerPorId: async (id: string) => {
    try {
      const response = await apiClient.get<ApiResponse<TransferenciaActivo>>(
        `/transferencias/${id}`
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Crear transferencia
  crear: async (datos: CreateTransferenciaDTO) => {
    try {
      const response = await apiClient.post<ApiResponse<TransferenciaActivo>>(
        '/transferencias',
        datos
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Aprobar transferencia
  aprobar: async (id: string, datos: AprobarTransferenciaDTO) => {
    try {
      const response = await apiClient.post<ApiResponse<TransferenciaActivo>>(
        `/transferencias/${id}/aprobar`,
        datos
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Rechazar transferencia
  rechazar: async (id: string, motivo?: string) => {
    try {
      const response = await apiClient.post<ApiResponse<TransferenciaActivo>>(
        `/transferencias/${id}/rechazar`,
        { motivo }
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Completar transferencia
  completar: async (id: string) => {
    try {
      const response = await apiClient.post<ApiResponse<TransferenciaActivo>>(
        `/transferencias/${id}/completar`
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Obtener transferencias pendientes
  obtenerPendientes: async () => {
    try {
      const response = await apiClient.get<PaginatedResponse<TransferenciaActivo>>(
        '/transferencias/pendientes'
      );
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Obtener transferencias por usuario
  obtenerPorUsuario: async (usuarioId: string) => {
    try {
      const response = await apiClient.get<PaginatedResponse<TransferenciaActivo>>(
        `/transferencias/usuario/${usuarioId}`
      );
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Obtener resumen de operaciones
  obtenerResumen: async () => {
    try {
      const response = await apiClient.get<ApiResponse<ResumenOperacion>>(
        '/transferencias/resumen'
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Exportar transferencias
  exportar: async (formato: 'excel' | 'csv', filtros?: FiltrosTransferencias) => {
    try {
      const response = await apiClient.get(`/transferencias/exportar/${formato}`, {
        params: filtros,
        responseType: 'blob',
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Obtener áreas disponibles
  obtenerAreas: async () => {
    try {
      const response = await apiClient.get<ApiResponse<any[]>>('/transferencias/areas');
      return response.data.data || [];
    } catch (error) {
      throw error;
    }
  },

  // Generar acta de transferencia
  generarActa: async (transferanciaId: string) => {
    try {
      const response = await apiClient.post(
        `/transferencias/${transferanciaId}/generar-acta`,
        {},
        { responseType: 'blob' }
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },
};

export default transferenciasService;
