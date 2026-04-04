import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MaterialResponseDTO {
  @ApiProperty({ example: 'cmnkmwwtx0000w4l6f9kkhyh1' })
  id: string;

  @ApiProperty({ example: 'MAT-001' })
  codigo: string;

  @ApiProperty({ example: 'Papel bond carta' })
  nombre: string;

  @ApiPropertyOptional({ example: 'Paquete de hojas tamaño carta' })
  descripcion?: string;

  @ApiProperty({ example: 'paquete' })
  unidad: string;

  @ApiProperty({ example: 15 })
  stockActual: number;

  @ApiProperty({ example: 10 })
  stockMinimo: number;

  @ApiPropertyOptional({ example: 'cmnkly3id000w2wl6qls04snz' })
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

  @ApiProperty({ example: '2026-04-04T17:56:54.453Z' })
  creadoEn: Date;

  @ApiProperty({ example: '2026-04-04T17:56:54.453Z' })
  actualizadoEn: Date;
}
