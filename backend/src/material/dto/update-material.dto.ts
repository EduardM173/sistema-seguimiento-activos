import { IsString, IsOptional, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateMaterialDTO {
  @IsString()
  @IsOptional()
  nombre?: string;

  @IsString()
  @IsOptional()
  descripcion?: string;

  @IsString()
  @IsOptional()
  unidad?: string;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  stockActual?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  stockMinimo?: number;

  @IsString()
  @IsOptional()
  categoriaId?: string;
}
