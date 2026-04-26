// Estados posibles de un activo (alineado con backend Prisma)
export const estadoActivo = {
  OPERATIVO: "OPERATIVO",
  MANTENIMIENTO: "MANTENIMIENTO",
  FUERA_DE_SERVICIO: "FUERA_DE_SERVICIO",
  DADO_DE_BAJA: "DADO_DE_BAJA"
} as const;

export type EstadoActivo = typeof estadoActivo[keyof typeof estadoActivo];

// Para mostrar en UI (texto amigable)
export const estadoActivoDisplay: Record<EstadoActivo, string> = {
  OPERATIVO: "Operativo",
  MANTENIMIENTO: "En mantenimiento",
  FUERA_DE_SERVICIO: "Fuera de servicio",
  DADO_DE_BAJA: "Dado de baja"
};

// Categorías de activos
export interface CategoriaActivo {
  id: string;
  nombre: string;
  descripcion?: string;
  activo: boolean;
}

// Documento adjunto a un activo
export interface DocumentoActivo {
  id: string;
  activoId: string;
  nombre: string;
  tipo: string;
  url: string;
  fechaCarga: Date;
  usuarioId: string;
}

// Incidente de un activo
export interface IncidenteActivo {
  id: string;
  activoId: string;
  tipo: string;
  descripcion: string;
  fecha: Date;
  usuarioReportId: string;
  estado: "reportado" | "en_investigacion" | "resuelto";
}

// Activo principal
export interface Activo {
  id: string;
  codigoActivo: string;
  nombre: string;
  marca?: string;
  modelo?: string;
  numeroDeSerie?: string;
  categoriaActivoId: string;
  categoriaActivo?: CategoriaActivo;
  estado: EstadoActivo;
  ubicacionId: string;
  ubicacion?: {
    id: string;
    nombre: string;
    edificio?: string;
    aula?: string;
    piso?: number;
  };
  responsableId: string;
  responsable?: {
    id: string;
    nombres: string;
    apellidos: string;
    correo: string;
  };
  valorAdquisicion: number;
  fechaAdquisicion: Date;
  fechaVencimientoGarantia?: Date;
  proveedor?: string;
  observaciones?: string;
  documentos?: DocumentoActivo[];
  incidentes?: IncidenteActivo[];
  movimientos?: MovimientoActivo[];
  estado_de_salud?: string;
  proximo_mantenimiento?: Date;
  vencimiento_garantia?: Date;
  createdAt: Date;
  updatedAt: Date;
  
  // NUEVOS CAMPOS PARA BAJA DE ACTIVO (HU23)
  fechaBaja?: Date;
  motivoBaja?: string;
}

// Movimiento de activo (historial)
export interface MovimientoActivo {
  id: string;
  activoId: string;
  activo?: Activo;
  tipo: "asignacion_inicial" | "mantenimiento_preventivo" | "mantenimiento_correctivo" | "reparacion" | "transferencia_area" | "cambio_responsable" | "auditoria" | "ajuste_inventario";
  origen?: string;
  destino?: string;
  responsableAnterior?: string;
  responsablePosterior?: string;
  ubicacionAnterior?: string;
  ubicacionPosterior?: string;
  descripcion?: string;
  fecha: Date;
  usuarioId: string;
  usuario?: {
    id: string;
    nombres: string;
    apellidos: string;
  };
  observaciones?: string;
  createdAt: Date;
  updatedAt: Date;
}

// DTO para crear activo
export interface CreateActivoDTO {
  codigoActivo: string;
  nombre: string;
  marca?: string;
  modelo?: string;
  numeroDeSerie?: string;
  categoriaActivoId: string;
  estado: EstadoActivo;
  ubicacionId: string;
  responsableId: string;
  valorAdquisicion: number;
  fechaAdquisicion: Date;
  fechaVencimientoGarantia?: Date;
  proveedor?: string;
  observaciones?: string;
}

// DTO para actualizar activo
export interface UpdateActivoDTO {
  nombre?: string;
  marca?: string;
  modelo?: string;
  numeroDeSerie?: string;
  categoriaActivoId?: string;
  estado?: EstadoActivo;
  ubicacionId?: string;
  responsableId?: string;
  valorAdquisicion?: number;
  fechaAdquisicion?: Date;
  fechaVencimientoGarantia?: Date;
  proveedor?: string;
  observaciones?: string;
}

// Filtros para buscar activos
export interface FiltrosActivos {
  categoria?: string;
  estado?: EstadoActivo;
  ubicacion?: string;
  responsable?: string;
  estado_de_salud?: string;
  busqueda?: string;
  pagina?: number;
  limite?: number;
}

// NUEVO DTO para dar de baja un activo (HU23)
export interface DarDeBajaDTO {
  motivo: string;
}