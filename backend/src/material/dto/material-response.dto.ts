export class MaterialResponseDTO {
  id: string;
  codigo: string;
  nombre: string;
  descripcion?: string;
  unidad: string;
  stockActual: number;
  stockMinimo: number;
  categoriaId?: string;
  creadoEn: Date;
  actualizadoEn: Date;
}
