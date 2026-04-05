import { IsString, IsOptional, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateMaterialDTO {
  @ApiPropertyOptional({ example: 'Papel bond oficio', description: 'Nuevo nombre del material' })
  @IsString()
  @IsOptional()
  nombre?: string;

  @ApiPropertyOptional({ example: 'Descripción actualizada del material' })
  @IsString()
  @IsOptional()
  descripcion?: string;

  @ApiPropertyOptional({ example: 'resma', description: 'Nueva unidad de medida' })
  @IsString()
  @IsOptional()
  unidad?: string;

  @ApiPropertyOptional({ example: 20, description: 'Nuevo stock actual', minimum: 0 })
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  stockActual?: number;

  @ApiPropertyOptional({ example: 5, description: 'Nuevo stock mínimo', minimum: 0 })
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  stockMinimo?: number;

  @ApiPropertyOptional({
    example: 'cmnkly3id000w2wl6qls04snz',
    description: 'Nuevo ID de categoría del material',
  })
  @IsString()
  @IsOptional()
  categoriaId?: string;
}
