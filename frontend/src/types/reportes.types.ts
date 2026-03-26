// Tipo de reporte
export const tipoReporte = {
  INVENTARIO_GENERAL: "inventario_general",
  DISPERSION_ACTIVOS: "dispersion_activos",
  MANTENIMIENTO_CRITICO: "mantenimiento_critico",
  ACTIVOS_POR_SEDE: "activos_por_sede",
  VALOR_ACTIVOS: "valor_activos",
  MOVIMIENTOS_ACTIVOS: "movimientos_activos",
  INVENTARIO_MATERIALES: "inventario_materiales",
  USUARIOS_PERMISOS: "usuarios_permisos",
  TRANSFERENCIAS: "transferencias",
  AUDITORIA_SISTEMA: "auditoria_sistema"
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
  duracionGeneracion?: number; // en segundos
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
  horaProgramacion: string; // HH:MM
  diasSemana?: number[]; // 0-6, si es semanal
  diaDelMes?: number; // si es mensual
  formatoSalida: "pdf" | "excel" | "csv" | "json";
  destinatarios?: string[]; // emails
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
