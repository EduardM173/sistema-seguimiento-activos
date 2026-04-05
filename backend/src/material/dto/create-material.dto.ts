import { IsString, IsNotEmpty, IsOptional, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMaterialDTO {
  @ApiProperty({ example: 'MAT-001', description: 'Código único del material' })
  @IsString()
  @IsNotEmpty()
  codigo: string;

  @ApiProperty({ example: 'Papel bond carta', description: 'Nombre del material' })
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @ApiPropertyOptional({
    example: 'Paquete de hojas tamaño carta',
    description: 'Descripción opcional del material',
  })
  @IsString()
  @IsOptional()
  descripcion?: string;

  @ApiProperty({ example: 'paquete', description: 'Unidad de medida del material' })
  @IsString()
  @IsNotEmpty()
  unidad: string;

  @ApiProperty({ example: 15, description: 'Cantidad actual disponible', minimum: 0.01 })
  @IsNumber()
  @Type(() => Number)
  @Min(0.01)
  stockActual: number;

  @ApiProperty({ example: 10, description: 'Cantidad mínima esperada en stock', minimum: 0.01 })
  @IsNumber()
  @Type(() => Number)
  @Min(0.01)
  stockMinimo: number;

  @ApiPropertyOptional({
    example: 'cmnkly3id000w2wl6qls04snz',
    description: 'ID de la categoría del material',
  })
  @IsString()
  @IsOptional()
  categoriaId?: string;
}
