// Registro de auditoría del sistema
export interface Auditoria {
  id: string;
  usuarioId: string;
  usuario?: {
    id: string;
    nombres: string;
    apellidos: string;
    correo: string;
  };
  accion: "crear" | "actualizar" | "eliminar" | "descargar" | "acceder" | "modificar_rol" | "exportar";
  modulo: "activos" | "inventario" | "usuarios" | "transferencias" | "reportes" | "configuracion";
  recursoTipo: string; // El tipo de recurso afectado (Activo, Usuario, etc)
  recursoId: string; // ID del recurso afectado
  cambiosAnteriores?: Record<string, any>; // Valores anteriores si es UPDATE
  cambiosNuevos?: Record<string, any>; // Valores nuevos
  descripcion: string;
  fechaHora: Date;
  direccionIP?: string;
  userAgent?: string;
  resultado: "exitoso" | "fallido";
  codigoError?: string;
  detallesError?: string;
  createdAt: Date;
}

export type TipoMovimientoTrazabilidad =
  | "REGISTRO"
  | "ASIGNACION"
  | "TRANSFERENCIA"
  | "DEVOLUCION"
  | "BAJA"
  | "ACTUALIZACION"
  | "INCIDENTE";

export interface TrazabilidadResumenPersona {
  id: string;
  nombreCompleto: string;
}

export interface TrazabilidadResumenArea {
  id: string;
  nombre: string;
}

export interface TrazabilidadMovimiento {
  id: string;
  fuente: "MOVIMIENTO";
  fecha: string;
  tipo: TipoMovimientoTrazabilidad;
  etiqueta: string;
  detalle: string;
  activo?: {
    id: string;
    codigo: string;
    nombre: string;
    estado: string;
    areaActual: TrazabilidadResumenArea | null;
  };
  areaOrigen: TrazabilidadResumenArea | null;
  areaDestino: TrazabilidadResumenArea | null;
  usuarioOrigen: TrazabilidadResumenPersona | null;
  usuarioDestino: TrazabilidadResumenPersona | null;
  usuarioOrigenId: string | null;
  usuarioDestinoId: string | null;
  asignacionId: string | null;
  realizadoPor: TrazabilidadResumenPersona | null;
}

export interface TrazabilidadActivo {
  activo: {
    id: string;
    codigo: string;
    nombre: string;
    descripcion: string | null;
    estado: string;
    categoria: TrazabilidadResumenArea | null;
    ubicacion: TrazabilidadResumenArea | null;
    areaActual: TrazabilidadResumenArea | null;
    responsableActual: TrazabilidadResumenPersona | null;
  };
  resumen: {
    totalEventos: number;
    totalMovimientos: number;
    totalRegistrosAuditoria: number;
    movimientosPorTipo: Record<TipoMovimientoTrazabilidad, number>;
  };
  movimientos: TrazabilidadMovimiento[];
  timeline: Array<TrazabilidadMovimiento | Record<string, unknown>>;
}

export interface TrazabilidadDepartamental {
  areaIds: string[];
  resumen: {
    totalMovimientos: number;
    totalActivos: number;
    movimientosPorTipo: Record<TipoMovimientoTrazabilidad, number>;
  };
  movimientos: TrazabilidadMovimiento[];
}

// Notificación del sistema
export interface Notificacion {
  id: string;
  usuarioId: string;
  usuarioParaQuien?: {
    id: string;
    nombres: string;
    apellidos: string;
    correo: string;
  };
  tipo: "transferencia_pendiente" | "activo_mantenimiento" | "stock_critico" | "auditoria_pendiente" | "aprobacion_requerida" | "sistema";
  asunto: string;
  contenido: string;
  referencias?: {
    recursoTipo: string;
    recursoId: string;
  };
  leida: boolean;
  fechaCreacion: Date;
  fechaLectura?: Date;
  accion?: {
    label: string;
    url: string;
  };
}

// Filtros para auditoría
export interface FiltrosAuditoria {
  usuario?: string;
  accion?: "crear" | "actualizar" | "eliminar" | "descargar" | "acceder" | "modificar_rol" | "exportar";
  modulo?: "activos" | "inventario" | "usuarios" | "transferencias" | "reportes" | "configuracion";
  resultado?: "exitoso" | "fallido";
  fechaDesde?: Date;
  fechaHasta?: Date;
  recursoId?: string;
  busqueda?: string;
  pagina?: number;
  limite?: number;
}

// Resumen de auditoría
export interface ResumenAuditoria {
  totalEventos: number;
  eventosHoy: number;
  eventosExitosos: number;
  eventosFallidos: number;
  usuariosActivos: number;
  ultimosEventos: Auditoria[];
  distribucionPorAccion: Record<string, number>;
  distribucionPorModulo: Record<string, number>;
}

// Política de retención
export interface PoliticaRetencion {
  diasRetencion: number;
  limpiezaAutomatica: boolean;
  ultimasEjecuciones?: Date[];
  proximaEjecucion?: Date;
}

// Configuración de auditoría
export interface ConfiguracionAuditoria {
  registrarAccesos: boolean;
  registrarChangios: boolean;
  nivelDetalle: "basico" | "detallado" | "completo";
  politicaRetencion: PoliticaRetencion;
  notificacionesActivas: boolean;
  emailNotificaciones?: string[];
}
