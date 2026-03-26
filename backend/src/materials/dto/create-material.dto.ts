import { IsString, IsNumber, IsOptional, Min, IsNotEmpty } from 'class-validator';

export class CreateMaterialDto {
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
  @Min(0)
  @IsNotEmpty()
  stockActual: number;

  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  stockMinimo: number;

  @IsString()
  @IsNotEmpty()
  categoriaId: string;
}
