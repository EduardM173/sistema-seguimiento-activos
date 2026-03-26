import { apiClient } from './api.config';
import type { Activo, CreateActivoDTO, UpdateActivoDTO, FiltrosActivos, MovimientoActivo } from '../types/activos.types';
import type { PaginatedResponse, ApiResponse } from '../types';

export const activosService = {
  // Obtener lista de activos
  obtenerTodos: async (filtros?: FiltrosActivos) => {
    try {
      const response = await apiClient.get<PaginatedResponse<Activo>>('/activos', {
        params: filtros,
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Obtener un activo específico
  obtenerPorId: async (id: string) => {
    try {
      const response = await apiClient.get<ApiResponse<Activo>>(`/activos/${id}`);
      return response.data.data;
    } catch (error) {
      throw error;
    }
  },

  // Crear nuevo activo
  crear: async (datos: CreateActivoDTO) => {
    try {
      const response = await apiClient.post<ApiResponse<Activo>>('/activos', datos);
      return response.data.data;
    } catch (error) {
      throw error;
    }
  },

  // Actualizar activo
  actualizar: async (id: string, datos: UpdateActivoDTO) => {
    try {
      const response = await apiClient.put<ApiResponse<Activo>>(`/activos/${id}`, datos);
      return response.data.data;
    } catch (error) {
      throw error;
    }
  },

  // Eliminar/Dar de baja activo
  eliminar: async (id: string) => {
    try {
      const response = await apiClient.delete<ApiResponse<void>>(`/activos/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Obtener historial de movimientos
  obtenerHistorial: async (activoId: string) => {
    try {
      const response = await apiClient.get<ApiResponse<MovimientoActivo[]>>(
        `/activos/${activoId}/movimientos`
      );
      return response.data.data || [];
    } catch (error) {
      throw error;
    }
  },

  // Buscar activos
  buscar: async (termino: string) => {
    try {
      const response = await apiClient.get<PaginatedResponse<Activo>>('/activos/buscar', {
        params: { q: termino },
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Exportar activos a Excel/CSV
  exportar: async (formato: 'excel' | 'csv', filtros?: FiltrosActivos) => {
    try {
      const response = await apiClient.get(`/activos/exportar/${formato}`, {
        params: filtros,
        responseType: 'blob',
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Obtener estadísticas
  obtenerEstadisticas: async () => {
    try {
      const response = await apiClient.get<ApiResponse<any>>('/activos/estadisticas');
      return response.data.data;
    } catch (error) {
      throw error;
    }
  },

  // Obtener categorías de activos
  obtenerCategorias: async () => {
    try {
      const response = await apiClient.get<ApiResponse<any[]>>('/activos/categorias');
      return response.data.data || [];
    } catch (error) {
      throw error;
    }
  },

  // Obtener ubicaciones
  obtenerUbicaciones: async () => {
    try {
      const response = await apiClient.get<ApiResponse<any[]>>('/activos/ubicaciones');
      return response.data.data || [];
    } catch (error) {
      throw error;
    }
  },
};

export default activosService;
