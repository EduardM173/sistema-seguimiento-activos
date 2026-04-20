// Categoría de material (CategoriaMaterial en el backend)
export interface CategoriaMaterial {
  id: string;
  nombre: string;
  descripcion?: string;
}

// Material (Material en el backend)
export interface Material {
  id: string;
  codigo: string;
  nombre: string;
  descripcion?: string;
  unidad: string;
  stockActual: number;
  stockMinimo: number;
  categoriaId?: string | null;
  categoria?: CategoriaMaterial | null;
  creadoEn: Date;
  actualizadoEn: Date;

  // Helper para UI (calculado en frontend si aplica)
  estado_critico?: boolean;
}

// DTO para crear material (CreateMaterialDTO en el backend)
export interface CreateMaterialDTO {
  codigo: string;
  nombre: string;
  descripcion?: string;
  unidad: string;
  stockActual: number;
  stockMinimo: number;
  categoriaId?: string;
}

// DTO para actualizar material (UpdateMaterialDTO en el backend)
export interface UpdateMaterialDTO {
  nombre?: string;
  descripcion?: string;
  unidad?: string;
  stockActual?: number;
  stockMinimo?: number;
  categoriaId?: string;
}

// Movimiento de inventario
export interface MovimientoInventario {
  id: string;
  materialId: string;
  material?: Material;
  tipo: "entrada" | "salida" | "ajuste" | "devolucion" | "perdida";
  cantidad: number;
  razon: string;
  usuarioId: string;
  usuario?: {
    id: string;
    nombres: string;
    apellidos: string;
  };
  departamento?: string;
  solicitante?: string;
  autorizante?: string;
  observaciones?: string;
  fecha: Date;
  createdAt: Date;
  updatedAt: Date;
}

// DTO para registrar movimiento de inventario
export interface CreateMovimientoInventarioDTO {
  materialId: string;
  tipo: "entrada" | "salida" | "ajuste" | "devolucion" | "perdida";
  cantidad: number;
  razon: string;
  departamento?: string;
  solicitante?: string;
  autorizante?: string;
  observaciones?: string;
}

// Filtros para inventario
export interface FiltrosInventario {
  q?: string;
  categoriaId?: string;
  estado?: 'CRITICO' | 'NORMAL';
  page?: number;
  pageSize?: number;
  sortBy?:
    | 'codigo'
    | 'nombre'
    | 'categoria'
    | 'stockActual'
    | 'stockMinimo'
    | 'unidad'
    | 'creadoEn';
  sortType?: 'ASC' | 'DESC';
}

export interface InventarioListResponse {
  data: Material[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Reporte de inventario
export interface ReporteInventario {
  totalMateriales: number;
  totalValor: number;
  materialesCriticos: Material[];
  reabastecimientosRequeridos: Material[];
  movimientosUltimosMeses: MovimientoInventario[];
}
