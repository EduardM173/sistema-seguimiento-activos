// Exportar todos los tipos desde un lugar central
export * from "./auth.types";
export * from "./activos.types";
export * from "./inventario.types";
export * from "./transferencias.types";
export * from "./usuarios.types";
export * from "./auditoria.types";
export * from "./reportes.types";

// Tipos comunes
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  pagina: number;
  totalPages: number;
  hasMore: boolean;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  statusCode?: number;
}

export interface ApiError {
  statusCode: number;
  message: string;
  error: string;
  timestamp?: string;
}

export interface EntityStats {
  total: number;
  activos: number;
  inactivos: number;
  pendientes?: number;
  criticos?: number;
  ultimas24Horas?: number;
}
