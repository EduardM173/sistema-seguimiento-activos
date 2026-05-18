// Tipo de reporte
export const tipoReporte = {
  INVENTARIO_GENERAL: "inventario_general",
  CATEGORIA_ACTIVOS: "categoria_activos",
  RESPONSABLE_ACTIVOS: "responsable_activos",
  DISPERSION_ACTIVOS: "dispersion_activos",
  MANTENIMIENTO_CRITICO: "mantenimiento_critico",
  ACTIVOS_POR_SEDE: "activos_por_sede",
  VALOR_ACTIVOS: "valor_activos",
  MOVIMIENTOS_ACTIVOS: "movimientos_activos",
  INVENTARIO_MATERIALES: "inventario_materiales",
  USUARIOS_PERMISOS: "usuarios_permisos",
  TRANSFERENCIAS: "transferencias",
  AUDITORIA_SISTEMA: "auditoria_sistema",
} as const;

export type TipoReporte = typeof tipoReporte[keyof typeof tipoReporte];

// Reporte generado
export interface ReporteGenerado {
  id: string;
  nombre: string;
  tipo: TipoReporte;
  descripcion?: string;
  usuarioSolicitante?: {
    id: string;
    nombres: string;
    apellidos: string;
    correo: string;
  };
  fechaGeneracion: Date;
  fechaDesde?: Date;
  fechaHasta?: Date;
  filtros?: Record<string, any>;
  formato: "pdf" | "excel" | "csv" | "json";
  urlDescarga?: string;
  estado: "generando" | "completado" | "error" | "descargado";
  cantidadRegistros?: number;
  tamanioArchivo?: number;
  duracionGeneracion?: number;
  errorMensaje?: string;
  programado: boolean;
  proximasEjecuciones?: Date[];
  frecuencia?: "diaria" | "semanal" | "mensual";
  createdAt: Date;
  updatedAt: Date;
}

// Parámetros para generar reporte
export interface ParametrosReporte {
  tipo: TipoReporte;
  formato: "pdf" | "excel" | "csv" | "json";
  fechaDesde?: Date;
  fechaHasta?: Date;
  incluir?: {
    detalles?: boolean;
    graficos?: boolean;
    totales?: boolean;
    comparativas?: boolean;
  };
  filtros?: {
    categoria?: string;
    estado?: string;
    ubicacion?: string;
    usuario?: string;
    areaId?: string;
    [key: string]: any;
  };
  ordenarPor?: string;
  descendente?: boolean;
  pagina?: number;
  limitePorPagina?: number;
}

// Datos para reporte de inventario general
export interface DatosReporteInventario {
  totalActivos: number;
  totalValor: number;
  distribucionPorCategoria: Array<{
    categoria: string;
    cantidad: number;
    valor: number;
    porcentaje: number;
  }>;
  distribucionPorEstado: Array<{
    estado: string;
    cantidad: number;
    porcentaje: number;
  }>;
  distribucionPorUbicacion: Array<{
    ubicacion: string;
    cantidad: number;
    valor: number;
  }>;
  activosCriticos: Array<{
    id: string;
    codigo: string;
    nombre: string;
    estado: string;
    razon: string;
  }>;
  detalleActivos?: Array<any>;
}

// Datos para reporte de movimientos
export interface DatosReporteMovimientos {
  totalMovimientos: number;
  distribucionPorTipo: Record<string, number>;
  movimientosPorMes: Array<{
    mes: string;
    cantidad: number;
  }>;
  usuariosMasActivos: Array<{
    usuario: string;
    movimientos: number;
  }>;
  detalleMovimientos?: Array<any>;
}

// Datos para reporte de usuarios
export interface DatosReporteUsuarios {
  totalUsuarios: number;
  usuariosActivos: number;
  usuariosInactivos: number;
  distribucionPorRol: Record<string, number>;
  distribucionPorArea: Record<string, number>;
  ultimasActividades: Array<{
    usuario: string;
    ultimaConexion: Date;
    accion: string;
  }>;
  detalleUsuarios?: Array<any>;
}

// Configuración de reportes programados
export interface ReporteProgramado {
  id: string;
  nombre: string;
  tipo: TipoReporte;
  frecuencia: "diaria" | "semanal" | "mensual";
  horaProgramacion: string;
  diasSemana?: number[];
  diaDelMes?: number;
  formatoSalida: "pdf" | "excel" | "csv" | "json";
  destinatarios?: string[];
  activo: boolean;
  ultimaEjecucion?: Date;
  proximaEjecucion?: Date;
  parametros: ParametrosReporte;
  createdAt: Date;
  updatedAt: Date;
}

// Plantilla de reporte personalizado
export interface PlantillaReporte {
  id: string;
  nombre: string;
  descripcion?: string;
  tipo: TipoReporte;
  parametrosPredefinidos: ParametrosReporte;
  esPublica: boolean;
  creadorId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── HU27 ────────────────────────────────────────────────────────────────────

export interface InventarioEstadoReporte {
  status: "OPERATIVO" | "MANTENIMIENTO" | "FUERA_DE_SERVICIO" | "DADO_DE_BAJA";
  label: string;
  quantity: number;
}

export interface ReporteInventarioGeneral {
  generatedAt: string;
  assets: {
    total: number;
    byStatus: InventarioEstadoReporte[];
  };
  materials: {
    total: number;
    lowStock: number;
  };
  downloadReady: boolean;
}

// ─── HU28 ────────────────────────────────────────────────────────────────────

export interface CategoriaSummary {
  id: string;
  name: string;
  total: number;
  percentage: number;
}

export interface ReporteCategoria {
  generatedAt: string;
  totalAssets: number;
  categories: CategoriaSummary[];
  downloadReady: boolean;
}

export interface ActivoDetalleCategoria {
  id: string;
  codigo: string;
  nombre: string;
  estado: string;
  estadoLabel: string;
  ubicacion: string;
}

export interface ReporteCategoriaDetalle {
  categoryId: string;
  categoryName: string;
  assets: ActivoDetalleCategoria[];
  total: number;
}

// ─── HU47 ────────────────────────────────────────────────────────────────────

/** Resumen de un responsable en el listado general (PA1) */
export interface ResponsableSummary {
  id: string;
  name: string;
  total: number;
  percentage: number;
}

/** Respuesta GET /reports/inventory/responsable — PA1 */
export interface ReporteResponsable {
  generatedAt: string;
  totalAssets: number;
  responsables: ResponsableSummary[];
  downloadReady: boolean;
}

/** Activo en el detalle de un responsable — PA3: código, nombre, categoría, estado, ubicación */
export interface ActivoDetalleResponsable {
  id: string;
  codigo: string;
  nombre: string;
  categoria: string;
  estado: string;
  estadoLabel: string;
  ubicacion: string;
}

/** Respuesta GET /reports/inventory/responsable/:id/assets — PA2/PA3/PA4/PA5 */
export interface ReporteResponsableDetalle {
  responsableId: string;
  responsableName: string;
  assets: ActivoDetalleResponsable[];
  total: number;
}