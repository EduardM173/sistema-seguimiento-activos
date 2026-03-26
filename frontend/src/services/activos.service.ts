import { http as apiClient } from './http.client';
import type { Activo, CreateActivoDTO, UpdateActivoDTO, FiltrosActivos, MovimientoActivo } from '../types/activos.types';
import type { PaginatedResponse, ApiResponse } from '../types';

export const activosService = {
  // Obtener lista de activos
  obtenerTodos: async (filtros?: FiltrosActivos) => {
    try {
      const response = await apiClient.get<PaginatedResponse<Activo>>('/assets', {
        params: filtros,
      });
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Obtener un activo específico
  obtenerPorId: async (id: string) => {
    try {
      const response = await apiClient.get<ApiResponse<Activo>>(`/assets/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Crear nuevo activo
  crear: async (datos: CreateActivoDTO) => {
    try {
      const response = await apiClient.post<ApiResponse<Activo>>('/assets', datos);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Actualizar activo
  actualizar: async (id: string, datos: UpdateActivoDTO) => {
    try {
      const response = await apiClient.put<ApiResponse<Activo>>(`/assets/${id}`, datos);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Eliminar/Dar de baja activo
  eliminar: async (id: string) => {
    try {
      const response = await apiClient.delete<ApiResponse<void>>(`/assets/${id}`);
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Obtener historial de movimientos
  obtenerHistorial: async (activoId: string) => {
    try {
      const response = await apiClient.get<ApiResponse<MovimientoActivo[]>>(
        `/assets/${activoId}/movimientos`
      );
      return response.data || [];
    } catch (error) {
      throw error;
    }
  },

  // Buscar activos
  buscar: async (termino: string) => {
    try {
      const response = await apiClient.get<PaginatedResponse<Activo>>('/assets/buscar', {
        params: { q: termino },
      });
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Exportar activos a Excel/CSV
  exportar: async (formato: 'excel' | 'csv', filtros?: FiltrosActivos) => {
    try {
      const response = await apiClient.get(`/assets/exportar/${formato}`, {
        params: filtros,
        responseType: 'blob',
      });
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Obtener estadísticas
  obtenerEstadisticas: async () => {
    try {
      const response = await apiClient.get<ApiResponse<any>>('/assets/estadisticas');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Obtener categorías de activos
  obtenerCategorias: async () => {
    try {
      const response = await apiClient.get<ApiResponse<any[]>>('/catalogs/categorias');
      return response.data || [];
    } catch (error) {
      throw error;
    }
  },

  // Obtener ubicaciones
  obtenerUbicaciones: async () => {
    try {
      const response = await apiClient.get<ApiResponse<any[]>>('/catalogs/ubicaciones');
      return response.data || [];
    } catch (error) {
      throw error;
    }
  },
};

export default activosService;
