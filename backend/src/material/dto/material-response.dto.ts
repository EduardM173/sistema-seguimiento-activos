import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MaterialResponseDTO {
  @ApiProperty({ example: 'cmnkmwwtx0000w4l6f9kkhyh1', description: 'ID único del material' })
  id: string;

  @ApiProperty({ example: 'MAT-001', description: 'Código único del material o recurso' })
  codigo: string;

  @ApiProperty({ example: 'Papel bond carta', description: 'Nombre del material o recurso' })
  nombre: string;

  @ApiPropertyOptional({ example: 'Paquete de hojas tamaño carta', description: 'Descripción opcional del material' })
  descripcion?: string;

  @ApiProperty({ example: 'paquete', description: 'Unidad de medida del material' })
  unidad: string;

  @ApiProperty({ example: 15, description: 'Stock disponible actual del material' })
  stockActual: number;

  @ApiProperty({ example: 10, description: 'Nivel mínimo de stock definido para el material' })
  stockMinimo: number;

  @ApiPropertyOptional({ example: 'cmnkly3id000w2wl6qls04snz', description: 'ID de la categoría asociada' })
  categoriaId?: string;

  @ApiPropertyOptional({
    example: {
      id: 'cmnkly3id000w2wl6qls04snz',
      nombre: 'Papelería',
      descripcion: 'Materiales de oficina',
    },
  })
  categoria?: {
    id: string;
    nombre: string;
    descripcion?: string;
  };

  @ApiProperty({ example: '2026-04-04T17:56:54.453Z', description: 'Fecha de creación del material' })
  creadoEn: Date;

  @ApiProperty({ example: '2026-04-04T17:56:54.453Z', description: 'Fecha de última actualización del material' })
  actualizadoEn: Date;
}
