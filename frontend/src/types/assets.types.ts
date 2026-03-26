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
  costoAdquisicion: number | null;
  vencimientoGarantia: string | null;
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
  ubicacionId?: string,
  page?: number;
  pageSize?: number;
};

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
