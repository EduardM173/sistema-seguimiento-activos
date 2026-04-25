export type PaginationMeta = {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type ApiResponse<T> = {
  success: boolean;
  data: T;
  message?: string;
  meta?: PaginationMeta;
  errors?: string[];
};

export type AssetListItem = {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  marca: string | null;
  modelo: string | null;
  estado: EstadoActivo;
  estadoLabel: string;
  creadoEn: string;
  categoria: { id: string; nombre: string } | null;
  ubicacion: { id: string; nombre: string } | null;
  area: { id: string; nombre: string } | null;
  responsable: { id: string; nombreCompleto: string } | null;
};

export type AssetDetail = AssetListItem & {
  numeroSerie: string | null;
  fechaAdquisicion: string | null;
  costoAdquisicion: number | string | null;
  vencimientoGarantia: string | null;
  actualizadoEn: string;
  areaActual: {
    id: string;
    nombre: string;
  } | null;
  responsableActual: {
    id: string;
    nombres: string;
    apellidos: string;
    correo: string;
    nombreCompleto: string;
  } | null;
  creadoPor: {
    id: string;
    nombreCompleto: string;
  } | null;
  actualizadoPor: {
    id: string;
    nombreCompleto: string;
  } | null;
  historialTransferencias: {
    id: string;
    fecha: string;
    detalle: string | null;
    areaOrigen: {
      id: string;
      nombre: string;
    } | null;
    areaDestino: {
      id: string;
      nombre: string;
    } | null;
    realizadoPor: {
      id: string;
      nombreCompleto: string;
    } | null;
  }[];
};

export type CreateAssetPayload = {
  codigo: string;
  nombre: string;
  descripcion?: string;
  marca?: string;
  modelo?: string;
  numeroSerie?: string;
  fechaAdquisicion?: string;
  costoAdquisicion?: number;
  vencimientoGarantia?: string;
  categoriaId: string;
  ubicacionId?: string;
  estado?: EstadoActivo;
  areaActualId?: string;
  responsableActualId?: string;
};

export type UpdateAssetPayload = Partial<CreateAssetPayload> & {
  estado?: EstadoActivo;
};

export type EstadoActivo =
  | 'OPERATIVO'
  | 'MANTENIMIENTO'
  | 'FUERA_DE_SERVICIO'
  | 'DADO_DE_BAJA';

export type SearchAssetsParams = {
  q?: string;
  estado?: EstadoActivo | '';
  categoriaId?: string;
  ubicacionId?: string;
  soloTransferibles?: boolean;
  sortBy?: AssetSortBy;
  sortType?: SortType;
  page?: number;
  pageSize?: number;
};

export type AssetSortBy =
  | 'codigo'
  | 'nombre'
  | 'categoria'
  | 'ubicacion'
  | 'responsable'
  | 'estado'
  | 'creadoEn';

export type SortType = 'ASC' | 'DESC';

export type Categoria = {
  id: string;
  nombre: string;
  descripcion?: string;
};

export type Ubicacion = {
  id: string;
  nombre: string;
  edificio?: string;
  piso?: string;
  ambiente?: string;
};

export type Area = {
  id: string;
  nombre: string;
};

export type UsuarioResumen = {
  id: string;
  nombres: string;
  apellidos: string;
  nombreCompleto: string;
  correo: string;
  area: { id: string; nombre: string } | null;
};

export type AssignAssetPayload = {
  usuarioAsignadoId?: string;
  areaAsignadaId?: string;
  observaciones?: string;
};

export type AssignAssetResponse = {
  message: string;
  asignacion: {
    id: string;
    estado: string;
    asignadoEn: string;
    observaciones: string | null;
    usuarioAsignado: { id: string; nombreCompleto: string } | null;
    areaAsignada: { id: string; nombre: string } | null;
  };
  asset: AssetDetail;
};

export type TransferAssetPayload = {
  areaDestinoId: string;
  observaciones?: string;
};

// HU41 – Registro de transferencia pendiente de recepción
export type PendienteRecepcion = {
  id: string;
  fechaEnvio: string;
  observaciones: string | null;
  activo: { id: string; codigo: string; nombre: string };
  areaDestino: { id: string; nombre: string } | null;
  areaOrigen: { id: string; nombre: string } | null;
  registradoPor: { id: string; nombreCompleto: string } | null;
};

export type SolicitudEnviada = {
  id: string;
  estado: string;
  fechaEnvio: string;
  observaciones: string | null;
  activo: { id: string; codigo: string; nombre: string };
  areaOrigen: { id: string; nombre: string } | null;
  areaDestino: { id: string; nombre: string } | null;
  registradoPor: { id: string; nombreCompleto: string } | null;
};

export type TransferAssetResponse = {
  message: string;
  transferencia: {
    id: string;
    estado: string;
    asignadoEn: string;
    observaciones: string | null;
    areaOrigen: { id: string; nombre: string };
    areaDestino: { id: string; nombre: string };
    registradoPorId: string;
  };
  asset: AssetDetail;
};
