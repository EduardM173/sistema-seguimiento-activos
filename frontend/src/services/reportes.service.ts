import { apiClient } from './api.config';
import type { ReporteGenerado, ParametrosReporte, ReporteProgramado } from '../types/reportes.types';
import { tipoReporte } from '../types/reportes.types';
import type { PaginatedResponse, ApiResponse } from '../types';

export const reportesService = {
  // Generar reporte
  generar: async (parametros: ParametrosReporte) => {
    try {
      const response = await apiClient.post<ApiResponse<ReporteGenerado>>(
        '/reportes/generar',
        parametros
      );
      return response.data.data;
    } catch (error) {
      throw error;
    }
  },

  // Obtener reportes generados
  obtenerTodos: async (pagina?: number, limite?: number) => {
    try {
      const response = await apiClient.get<PaginatedResponse<ReporteGenerado>>(
        '/reportes',
        {
          params: { pagina, limite },
        }
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Obtener un reporte específico
  obtenerPorId: async (id: string) => {
    try {
      const response = await apiClient.get<ApiResponse<ReporteGenerado>>(
        `/reportes/${id}`
      );
      return response.data.data;
    } catch (error) {
      throw error;
    }
  },

  // Descargar reporte
  descargar: async (reporteId: string) => {
    try {
      const response = await apiClient.get(
        `/reportes/${reporteId}/descargar`,
        {
          responseType: 'blob',
        }
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Eliminar reporte
  eliminar: async (id: string) => {
    try {
      const response = await apiClient.delete<ApiResponse<void>>(
        `/reportes/${id}`
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Obtener tipos de reportes disponibles
  obtenerTipos: async () => {
    try {
      const tipos = Object.values(tipoReporte);
      return {
        success: true,
        data: tipos.map(tipo => ({
          valor: tipo,
          label: tipo.replace(/_/g, ' ').toUpperCase()
        }))
      };
    } catch (error) {
      throw error;
    }
  },

  // ===== REPORTES PROGRAMADOS =====

  // Obtener reportes programados
  obtenerProgramados: async () => {
    try {
      const response = await apiClient.get<PaginatedResponse<ReporteProgramado>>(
        '/reportes/programados'
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Crear reporte programado
  crearProgramado: async (datos: Partial<ReporteProgramado>) => {
    try {
      const response = await apiClient.post<ApiResponse<ReporteProgramado>>(
        '/reportes/programados',
        datos
      );
      return response.data.data;
    } catch (error) {
      throw error;
    }
  },

  // Actualizar reporte programado
  actualizarProgramado: async (id: string, datos: Partial<ReporteProgramado>) => {
    try {
      const response = await apiClient.put<ApiResponse<ReporteProgramado>>(
        `/reportes/programados/${id}`,
        datos
      );
      return response.data.data;
    } catch (error) {
      throw error;
    }
  },

  // Eliminar reporte programado
  eliminarProgramado: async (id: string) => {
    try {
      const response = await apiClient.delete<ApiResponse<void>>(
        `/reportes/programados/${id}`
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // ===== UTILIDADES =====

  // Obtener ejemplos de reportes
  obtenerEjemplos: async () => {
    try {
      const response = await apiClient.get<ApiResponse<any[]>>(
        '/reportes/ejemplos'
      );
      return response.data.data || [];
    } catch (error) {
      throw error;
    }
  },

  // Previsualizar reporte (sin generar archivo)
  previsualizar: async (parametros: ParametrosReporte) => {
    try {
      const response = await apiClient.post<ApiResponse<any>>(
        '/reportes/previsualizar',
        parametros
      );
      return response.data.data;
    } catch (error) {
      throw error;
    }
  },

  // Generar reporte en formato específico
  generarFormato: async (parametros: ParametrosReporte, formato: 'excel' | 'pdf' | 'csv' | 'json') => {
    try {
      // Ajustar parámetros con el formato
      const paramsConFormato = { ...parametros, formato };
      
      const response = await apiClient.post(
        '/reportes/generar-descarga',
        paramsConFormato,
        {
          responseType: 'blob',
        }
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Obtener estadísticas de reportes
  obtenerEstadisticas: async () => {
    try {
      const response = await apiClient.get<ApiResponse<any>>(
        '/reportes/estadisticas'
      );
      return response.data.data;
    } catch (error) {
      throw error;
    }
  },
};

export default reportesService;
