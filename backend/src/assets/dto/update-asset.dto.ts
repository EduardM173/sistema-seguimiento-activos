import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

import { EstadoActivo } from '../../generated/prisma/client';

/**
 * Update asset DTO — all fields optional for partial updates.
 * Manually defined instead of PartialType to avoid dependency conflicts.
 */
export class UpdateAssetDto {
  @IsOptional()
  @IsString({ message: 'El código debe ser una cadena de texto' })
  @MaxLength(50, { message: 'El código no puede exceder 50 caracteres' })
  codigo?: string;

  @IsOptional()
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @MaxLength(200, { message: 'El nombre no puede exceder 200 caracteres' })
  nombre?: string;

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

  @IsOptional()
  @IsEnum(EstadoActivo, {
    message: `El estado debe ser uno de: ${Object.values(EstadoActivo).join(', ')}`,
  })
  estado?: EstadoActivo;

  @IsOptional()
  @IsString()
  categoriaId?: string;

  @IsOptional()
  @IsString()
  ubicacionId?: string;

  @IsOptional()
  @IsString()
  areaActualId?: string;

  @IsOptional()
  @IsString()
  responsableActualId?: string;
}
