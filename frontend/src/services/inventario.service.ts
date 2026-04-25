import { http as apiClient } from './http.client';
import type {
  Material,
  CreateMaterialDTO,
  UpdateMaterialDTO,
  FiltrosInventario,
  InventarioListResponse,
  MovimientoInventario,
  CreateMovimientoInventarioDTO,
  ReporteInventario,
} from '../types/inventario.types';
import type { PaginatedResponse, ApiResponse } from '../types';

export const inventarioService = {
  // Obtener lista de materiales
  obtenerTodos: async (filtros?: FiltrosInventario) => {
    try {
      const response = await apiClient.get<InventarioListResponse>('/inventory-items', {
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

  // Aumntar stock
  aumentarStock: async (id: string, cantidad: number) => {
    try {
      const response = await apiClient.patch<
        ApiResponse<{
          message: string;
          material: Material;
          movimiento: {
            id: string;
            tipo: string;
            cantidad: number;
            stockAnterior: number;
            stockNuevo: number;
            motivo: string | null;
            creadoEn: string;
          };
        }>
      >(`/inventory-items/${id}/aumentar-stock`, {
        cantidad,
      });
      return response;
    } catch (error) {
      throw error;
    }
  },

  ajustarStock: async (
    id: string,
    payload: {
      cantidadRegistrada: number;
      cantidadFisica: number;
      motivo: string;
    },
  ) => {
    try {
      const response = await apiClient.patch<
        ApiResponse<{
          message: string;
          material: Material;
          movimiento: {
            id: string;
            tipo: string;
            cantidad: number;
            stockAnterior: number;
            stockNuevo: number;
            motivo: string | null;
            creadoEn: string;
          };
        }>
      >(`/inventory-items/${id}/ajustar-stock`, payload);
      return response;
    } catch (error) {
      throw error;
    }
  },

  crearDemo: async (count = 100) => {
    try {
      const response = await apiClient.post<ApiResponse<{ inserted: number }>>(
        `/inventory-items/dev/fake-bulk?count=${encodeURIComponent(String(count))}`,
        {},
      );
      return response;
    } catch (error) {
      throw error;
    }
  },

  eliminarDemo: async () => {
    try {
      const response = await apiClient.delete<ApiResponse<{ deleted: number }>>(
        '/inventory-items/dev/fake-bulk',
      );
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

  obtenerHistorialMaterial: async (
    materialId: string,
    filtros?: { startDate?: string; endDate?: string }
  ) => {
    const response = (await apiClient.get(
      `/inventory-items/${materialId}/history`,
      { params: filtros }
    )) as any;
    if (Array.isArray(response)) {
      return response;
    }
    return response?.data ?? [];
  },
};

export default inventarioService;
