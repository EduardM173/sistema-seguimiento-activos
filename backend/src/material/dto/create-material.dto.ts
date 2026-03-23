import { IsString, IsNotEmpty, IsOptional, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateMaterialDTO {
  @IsString()
  @IsNotEmpty()
  codigo: string;

  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsString()
  @IsOptional()
  descripcion?: string;

  @IsString()
  @IsNotEmpty()
  unidad: string;

  @IsNumber()
  @Type(() => Number)
  stockActual: number;

  @IsNumber()
  @Type(() => Number)
  stockMinimo: number;

  @IsString()
  @IsOptional()
  categoriaId?: string;
}
