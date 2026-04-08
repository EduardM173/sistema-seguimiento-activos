import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAssetDto {
  @IsString({ message: 'El código debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El código del activo es obligatorio' })
  @MaxLength(50, { message: 'El código no puede exceder 50 caracteres' })
  codigo: string;

  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre del activo es obligatorio' })
  @MaxLength(200, { message: 'El nombre no puede exceder 200 caracteres' })
  nombre: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'La descripción no puede exceder 500 caracteres' })
  descripcion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  marca?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  modelo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  numeroSerie?: string;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha de adquisición debe ser una fecha válida (ISO 8601)' })
  fechaAdquisicion?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'El costo de adquisición debe ser un número' })
  @IsPositive({ message: 'El costo de adquisición debe ser positivo' })
  costoAdquisicion?: number;

  @IsOptional()
  @IsDateString({}, { message: 'El vencimiento de garantía debe ser una fecha válida (ISO 8601)' })
  vencimientoGarantia?: string;

  @IsString({ message: 'El ID de categoría debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La categoría del activo es obligatoria' })
  categoriaId: string;

  @IsString({ message: 'El ID de ubicación debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La ubicación del activo es obligatoria' })
  ubicacionId: string;

  @IsOptional()
  @IsString()
  areaActualId?: string;

  @IsOptional()
  @IsString()
  responsableActualId?: string;
}
