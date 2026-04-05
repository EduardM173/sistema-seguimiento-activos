import { http as apiClient } from './http.client';
import type { Material, CreateMaterialDTO, UpdateMaterialDTO, FiltrosInventario, MovimientoInventario, CreateMovimientoInventarioDTO, ReporteInventario } from '../types/inventario.types';
import type { PaginatedResponse, ApiResponse } from '../types';

export const inventarioService = {
  // Obtener lista de materiales
  obtenerTodos: async (filtros?: FiltrosInventario) => {
    try {
      const response = await apiClient.get<PaginatedResponse<Material>>('/inventory-items', {
        params: filtros,
      });
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Obtener un material específico
  obtenerPorId: async (id: string) => {
    try {
      const response = await apiClient.get<Material>(`/inventory-items/${id}`);
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Crear nuevo material
  crear: async (datos: CreateMaterialDTO) => {
    try {
      const response = await apiClient.post<Material>('/inventory-items', datos);
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Actualizar material
  actualizar: async (id: string, datos: UpdateMaterialDTO) => {
    try {
      const response = await apiClient.put<Material>(`/inventory-items/${id}`, datos);
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Eliminar material
  eliminar: async (id: string) => {
    try {
      const response = await apiClient.delete<ApiResponse<void>>(`/inventory-items/${id}`);
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Registrar movimiento de inventario
  registrarMovimiento: async (datos: CreateMovimientoInventarioDTO) => {
    try {
      const response = await apiClient.post<ApiResponse<MovimientoInventario>>(
        '/inventario/movimientos',
        datos
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Obtener historial de movimientos
  obtenerMovimientos: async (materialId?: string) => {
    try {
      const response = await apiClient.get<PaginatedResponse<MovimientoInventario>>(
        '/inventario/movimientos',
        {
          params: materialId ? { materialId } : {},
        }
      );
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Obtener materiales críticos
  obtenerMaterialesCriticos: async () => {
    try {
      const response = await apiClient.get<ApiResponse<Material[]>>('/inventario/materiales/criticos');
      return response.data || [];
    } catch (error) {
      throw error;
    }
  },

  // Obtener materiales que requieren reabastecimiento
  obtenerParaReabastecer: async () => {
    try {
      const response = await apiClient.get<ApiResponse<Material[]>>(
        '/inventario/materiales/reabastecer'
      );
      return response.data || [];
    } catch (error) {
      throw error;
    }
  },

  // Obtener reporte de inventario
  obtenerReporte: async () => {
    try {
      const response = await apiClient.get<ApiResponse<ReporteInventario>>(
        '/inventario/reporte'
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Obtener categorías de materiales
  obtenerCategorias: async () => {
    try {
      const response = await apiClient.get<any>('/inventory-items/categorias');
      // Aceptar tanto el formato con wrapper { data: [...] } como el array directo
      return response?.data ?? response ?? [];
    } catch (error) {
      throw error;
    }
  },

  // Buscar materiales
  buscar: async (termino: string) => {
    try {
      const response = await apiClient.get<PaginatedResponse<Material>>('/inventario/materiales/buscar', {
        params: { q: termino },
      });
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Exportar inventario
  exportar: async (formato: 'excel' | 'csv') => {
    try {
      const response = await apiClient.get(`/inventario/exportar/${formato}`, {
        responseType: 'blob',
      });
      return response;
    } catch (error) {
      throw error;
    }
  },
};

export default inventarioService;
