export type AuditoriaMsUsuario = {
  id: string;
  correo: string;
  nombreUsuario: string;
  nombres: string;
  apellidos: string;
};

export type AuditoriaMsRegistro = {
  id: string;
  usuarioId: string | null;
  tipoEntidad: string;
  entidadId: string;
  accion: string;
  valoresAnteriores: Record<string, unknown> | null;
  valoresNuevos: Record<string, unknown> | null;
  direccionIp: string | null;
  userAgent: string | null;
  creadoEn: string;
  usuario: {
    id: string;
    nombres: string;
    apellidos: string;
    correo: string;
    nombreUsuario: string;
  } | null;
};

export type AuditoriaMsFiltros = {
  usuarioId?: string;
  tipoEntidad?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  q?: string;
  page?: number;
  pageSize?: number;
};

export type AuditoriaMsResponse<T> = {
  ok: boolean;
  data: T;
};

export type AuditoriaMsListadoResponse = AuditoriaMsResponse<AuditoriaMsRegistro[]> & {
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};
