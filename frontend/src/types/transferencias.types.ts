// Ubicación
export interface Ubicacion {
  id: string;
  nombre: string;
  descripcion?: string;
  edificio?: string;
  aula?: string;
  piso?: number;
  responsable?: string;
  activo: boolean;
}

// Asignación de activo
export interface AsignacionActivo {
  id: string;
  activoId: string;
  usuarioId: string;
  usuario?: {
    id: string;
    nombres: string;
    apellidos: string;
    correo: string;
  };
  ubicacionId: string;
  ubicacion?: Ubicacion;
  fechaAsignacion: Date;
  fechaTermino?: Date;
  observaciones?: string;
  tipoAsignacion: "permanente" | "temporal" | "temporal_especial";
  estado: "activa" | "finalizada" | "suspendida";
  documentoAutorizacion?: string;
}

// Transferencia de activo entre áreas
export interface TransferenciaActivo {
  id: string;
  activoId: string;
  activo?: {
    id: string;
    codigoActivo: string;
    nombre: string;
  };
  areaOrigenId: string;
  areaOrigenNombre?: string;
  areaDestinoId: string;
  areaDestinoNombre?: string;
  responsableOrigenId: string;
  responsableDestinoId: string;
  responsableDestino?: {
    id: string;
    nombres: string;
    apellidos: string;
    correo: string;
  };
  motivo: string;
  observaciones?: string;
  fechaSolicitud: Date;
  fechaAprobacion?: Date;
  fechaEjecucion?: Date;
  usarioSolicitante?: {
    id: string;
    nombres: string;
    apellidos: string;
  };
  usuarioAprobador?: {
    id: string;
    nombres: string;
    apellidos: string;
  };
  estado: "pendiente" | "aprobada" | "rechazada" | "completada";
  documentosAdjuntos?: string[];
}

// DTO para crear asignación
export interface CreateAsignacionDTO {
  activoId: string;
  usuarioId: string;
  ubicacionId: string;
  tipoAsignacion: "permanente" | "temporal" | "temporal_especial";
  observaciones?: string;
  documentoAutorizacion?: string;
}

// DTO para crear transferencia
export interface CreateTransferenciaDTO {
  activoId: string;
  areaDestinoId: string;
  responsableDestinoId: string;
  motivo: string;
  observaciones?: string;
}

// DTO para aprobar transferencia
export interface AprobarTransferenciaDTO {
  aprobada: boolean;
  observaciones?: string;
}

// Filtros para transferencias
export interface FiltrosTransferencias {
  estado?: "pendiente" | "aprobada" | "rechazada" | "completada";
  areaOrigen?: string;
  areaDestino?: string;
  fechaDesde?: Date;
  fechaHasta?: Date;
  busqueda?: string;
  pagina?: number;
  limite?: number;
}

// Resumen de operación
export interface ResumenOperacion {
  activosEnTransito: number;
  transferenciasEnEspera: number;
  asignacionesRecientes: number;
  ultimasTransferencias: TransferenciaActivo[];
}
