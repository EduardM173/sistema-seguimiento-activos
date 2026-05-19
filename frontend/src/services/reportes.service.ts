import { http as apiClient } from './http.client';
import type {
  ReporteGenerado,
  ParametrosReporte,
  ReporteProgramado,
  ReporteInventarioGeneral,
  ReporteCategoria,
  ReporteCategoriaDetalle,
  ReporteResponsable,
  ReporteResponsableDetalle,
} from '../types/reportes.types';
import { tipoReporte } from '../types/reportes.types';
import type { PaginatedResponse, ApiResponse } from '../types';

const REPORTS_API_URL = import.meta.env.VITE_REPORTS_API_URL || '/reports-api';

async function requestReports<T>(endpoint: string, init?: RequestInit): Promise<T> {
  const url = `${REPORTS_API_URL}${endpoint}`;
  const response = await fetch(url, init);

  if (!response.ok) {
    const errorText = await response.text();
    const error = parseErrorBody(errorText);
    throw new Error(
      error?.message ||
        errorText ||
        `Error al consultar el microservicio de reportes (${response.status})`,
    );
  }

  return response.json() as Promise<T>;
}

function parseErrorBody(errorText: string) {
  try {
    return JSON.parse(errorText) as { message?: string };
  } catch {
    return null;
  }
}

function getFilenameFromDisposition(disposition: string | null, fallback: string) {
  const match = disposition?.match(/filename="?([^"]+)"?/i);
  return match?.[1] || fallback;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export const reportesService = {

  // ═══════════════════════════════════════════════════════════════════════════
  // HU27 — Reporte general del inventario
  // ═══════════════════════════════════════════════════════════════════════════

  obtenerInventarioGeneral: async () => {
    return requestReports<ReporteInventarioGeneral>('/reports/inventory/general');
  },

  descargarInventarioGeneral: async (formato: 'pdf' | 'excel', generatedById?: string) => {
    const params = new URLSearchParams();
    if (generatedById) params.set('generatedById', generatedById);

    const suffix = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(
      `${REPORTS_API_URL}/reports/inventory/general/download/${formato}${suffix}`,
    );

    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(error?.message || 'No se pudo descargar el reporte');
    }

    const blob = await response.blob();
    const fallback = `reporte-general-inventario.${formato === 'pdf' ? 'pdf' : 'xls'}`;
    const filename = getFilenameFromDisposition(
      response.headers.get('Content-Disposition'),
      fallback,
    );

    downloadBlob(blob, filename);
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // HU28 — Reporte por categoría de activos
  // ═══════════════════════════════════════════════════════════════════════════

  obtenerReporteCategoria: async () => {
    return requestReports<ReporteCategoria>('/reports/inventory/category');
  },

  obtenerActivosPorCategoria: async (categoryId: string) => {
    return requestReports<ReporteCategoriaDetalle>(
      `/reports/inventory/category/${categoryId}/assets`,
    );
  },

  descargarReporteCategoria: async (formato: 'pdf' | 'excel', generatedById?: string) => {
    const params = new URLSearchParams();
    if (generatedById) params.set('generatedById', generatedById);

    const suffix = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(
      `${REPORTS_API_URL}/reports/inventory/category/download/${formato}${suffix}`,
    );

    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(error?.message || 'No se pudo descargar el reporte por categoria');
    }

    const blob = await response.blob();
    const fallback = `reporte-por-categoria.${formato === 'pdf' ? 'pdf' : 'xls'}`;
    const filename = getFilenameFromDisposition(
      response.headers.get('Content-Disposition'),
      fallback,
    );

    downloadBlob(blob, filename);
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // HU47 — Reporte por responsable actual
  // ═══════════════════════════════════════════════════════════════════════════

  /** PA1 — Cantidad de activos agrupados por responsable actual */
  obtenerReporteResponsable: async () => {
    return requestReports<ReporteResponsable>('/reports/inventory/responsable');
  },

  /** PA2/PA3/PA4/PA5 — Activos del responsable seleccionado */
  obtenerActivosPorResponsable: async (responsableId: string) => {
    return requestReports<ReporteResponsableDetalle>(
      `/reports/inventory/responsable/${responsableId}/assets`,
    );
  },

  /** HU47 + HU30 — Descarga PDF o Excel del resumen por responsable */
  descargarReporteResponsable: async (formato: 'pdf' | 'excel', generatedById?: string) => {
    const params = new URLSearchParams();
    if (generatedById) params.set('generatedById', generatedById);

    const suffix = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(
      `${REPORTS_API_URL}/reports/inventory/responsable/download/${formato}${suffix}`,
    );

    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(error?.message || 'No se pudo descargar el reporte por responsable');
    }

    const blob = await response.blob();
    const fallback = `reporte-por-responsable.${formato === 'pdf' ? 'pdf' : 'xls'}`;
    const filename = getFilenameFromDisposition(
      response.headers.get('Content-Disposition'),
      fallback,
    );

    downloadBlob(blob, filename);
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Utilidades generales
  // ═══════════════════════════════════════════════════════════════════════════

  verificarMicroservicio: async () => {
    return requestReports<{ status: string; message: string; timestamp: string }>('/health');
  },

  generar: async (parametros: ParametrosReporte) => {
    try {
      const response = await apiClient.post<ApiResponse<ReporteGenerado>>(
        '/reportes/generar',
        parametros,
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  obtenerTodos: async (pagina?: number, limite?: number) => {
    try {
      const response = await apiClient.get<PaginatedResponse<ReporteGenerado>>('/reportes', {
        params: { pagina, limite },
      });
      return response;
    } catch (error) {
      throw error;
    }
  },

  obtenerPorId: async (id: string) => {
    try {
      const response = await apiClient.get<ApiResponse<ReporteGenerado>>(`/reportes/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  descargar: async (reporteId: string) => {
    try {
      const response = await apiClient.get(`/reportes/${reporteId}/descargar`, {
        responseType: 'blob',
      });
      return response;
    } catch (error) {
      throw error;
    }
  },

  eliminar: async (id: string) => {
    try {
      const response = await apiClient.delete<ApiResponse<void>>(`/reportes/${id}`);
      return response;
    } catch (error) {
      throw error;
    }
  },

  obtenerTipos: async () => {
    try {
      const tipos = Object.values(tipoReporte);
      return {
        success: true,
        data: tipos.map((tipo) => ({
          valor: tipo,
          label: tipo.replace(/_/g, ' ').toUpperCase(),
        })),
      };
    } catch (error) {
      throw error;
    }
  },

  obtenerProgramados: async () => {
    try {
      const response =
        await apiClient.get<PaginatedResponse<ReporteProgramado>>('/reportes/programados');
      return response;
    } catch (error) {
      throw error;
    }
  },

  crearProgramado: async (datos: Partial<ReporteProgramado>) => {
    try {
      const response = await apiClient.post<ApiResponse<ReporteProgramado>>(
        '/reportes/programados',
        datos,
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  actualizarProgramado: async (id: string, datos: Partial<ReporteProgramado>) => {
    try {
      const response = await apiClient.put<ApiResponse<ReporteProgramado>>(
        `/reportes/programados/${id}`,
        datos,
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  eliminarProgramado: async (id: string) => {
    try {
      const response = await apiClient.delete<ApiResponse<void>>(
        `/reportes/programados/${id}`,
      );
      return response;
    } catch (error) {
      throw error;
    }
  },

  obtenerEjemplos: async () => {
    try {
      const response = await apiClient.get<ApiResponse<any[]>>('/reportes/ejemplos');
      return response.data || [];
    } catch (error) {
      throw error;
    }
  },

  previsualizar: async (parametros: ParametrosReporte) => {
    try {
      const response = await apiClient.post<ApiResponse<any>>(
        '/reportes/previsualizar',
        parametros,
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  generarFormato: async (
    parametros: ParametrosReporte,
    formato: 'excel' | 'pdf' | 'csv' | 'json',
  ) => {
    try {
      const paramsConFormato = { ...parametros, formato };
      const response = await apiClient.post('/reportes/generar-descarga', paramsConFormato, {
        responseType: 'blob',
      });
      return response;
    } catch (error) {
      throw error;
    }
  },

  obtenerEstadisticas: async () => {
    try {
      const response = await apiClient.get<ApiResponse<any>>('/reportes/estadisticas');
      return response.data;
    } catch (error) {
      throw error;
    }
  },
};

export default reportesService;
