import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

import { EstadoActivo } from '../../generated/prisma/client';

/**
 * Update asset DTO — all fields optional for partial updates.
 * Manually defined instead of PartialType to avoid dependency conflicts.
 */
export class UpdateAssetDto {
  @ApiPropertyOptional({
    example: 'ACT-9F3D2A1B',
    description: 'Nuevo código único del activo',
    maxLength: 50,
  })
  @IsOptional()
  @IsString({ message: 'El código debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El código del activo es obligatorio' })
  @MaxLength(50, { message: 'El código no puede exceder 50 caracteres' })
  codigo?: string;

  @ApiPropertyOptional({
    example: 'Laptop Dell Latitude 5420',
    description: 'Nuevo nombre del activo',
    maxLength: 200,
  })
  @IsOptional()
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre del activo es obligatorio' })
  @MaxLength(200, { message: 'El nombre no puede exceder 200 caracteres' })
  nombre?: string;

  @ApiPropertyOptional({
    example: 'Equipo actualizado del área administrativa',
    description: 'Nueva descripción del activo',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'La descripción no puede exceder 500 caracteres' })
  descripcion?: string;

  @ApiPropertyOptional({
    example: 'Dell',
    description: 'Nueva marca del activo',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  marca?: string;

  @ApiPropertyOptional({
    example: 'Latitude 7430',
    description: 'Nuevo modelo del activo',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  modelo?: string;

  @ApiPropertyOptional({
    example: 'SN-7430-0002',
    description: 'Nuevo número de serie',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  numeroSerie?: string;

  @ApiPropertyOptional({
    example: '2026-01-15',
    description: 'Nueva fecha de adquisición',
    format: 'date',
  })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha de adquisición debe ser una fecha válida (ISO 8601)' })
  fechaAdquisicion?: string;

  @ApiPropertyOptional({
    example: 8200,
    description: 'Nuevo costo de adquisición',
    minimum: 0.01,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'El costo de adquisición debe ser un número' })
  @IsPositive({ message: 'El costo de adquisición debe ser positivo' })
  costoAdquisicion?: number;

  @ApiPropertyOptional({
    example: '2028-01-15',
    description: 'Nuevo vencimiento de garantía',
    format: 'date',
  })
  @IsOptional()
  @IsDateString({}, { message: 'El vencimiento de garantía debe ser una fecha válida (ISO 8601)' })
  vencimientoGarantia?: string;

  @ApiPropertyOptional({
    enum: EstadoActivo,
    example: EstadoActivo.MANTENIMIENTO,
    description: 'Nuevo estado operativo del activo',
  })
  @IsOptional()
  @IsEnum(EstadoActivo, {
    message: `El estado debe ser uno de: ${Object.values(EstadoActivo).join(', ')}`,
  })
  estado?: EstadoActivo;

  @ApiPropertyOptional({
    example: 'cmnkly3gf000j2wl67vioxkws',
    description: 'Nueva categoría del activo',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'La categoría del activo es obligatoria' })
  categoriaId?: string;

  @ApiPropertyOptional({
    example: 'cmnkly39f000d2wl6qbcilxb2',
    description: 'Nueva ubicación del activo',
  })
  @IsOptional()
  @IsString()
  ubicacionId?: string;

  @ApiPropertyOptional({
    example: 'cmnarea123',
    description: 'Nueva área actual del activo',
  })
  @IsOptional()
  @IsString()
  areaActualId?: string;

  @ApiPropertyOptional({
    example: 'cmnuser123',
    description: 'Nuevo responsable actual del activo',
  })
  @IsOptional()
  @IsString()
  responsableActualId?: string;
}
