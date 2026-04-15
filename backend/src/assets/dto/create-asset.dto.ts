import {
  IsEnum,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EstadoActivo } from '../../generated/prisma/client';

export class CreateAssetDto {
  @ApiProperty({
    example: 'ACT-9F3D2A1B',
    description: 'Código único institucional del activo',
    maxLength: 50,
  })
  @IsString({ message: 'El código debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El código del activo es obligatorio' })
  @MaxLength(50, { message: 'El código no puede exceder 50 caracteres' })
  codigo: string;

  @ApiProperty({
    example: 'Laptop Dell Latitude 5420',
    description: 'Nombre identificador del activo',
    maxLength: 200,
  })
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre del activo es obligatorio' })
  @MaxLength(200, { message: 'El nombre no puede exceder 200 caracteres' })
  nombre: string;

  @ApiPropertyOptional({
    example: 'Equipo asignado al área administrativa',
    description: 'Descripción adicional del activo',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'La descripción no puede exceder 500 caracteres' })
  descripcion?: string;

  @ApiPropertyOptional({
    example: 'Dell',
    description: 'Marca comercial del activo',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  marca?: string;

  @ApiPropertyOptional({
    example: 'Latitude 5420',
    description: 'Modelo del activo',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  modelo?: string;

  @ApiPropertyOptional({
    example: 'SN-5420-0001',
    description: 'Número de serie del activo',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  numeroSerie?: string;

  @ApiPropertyOptional({
    example: '2026-01-15',
    description: 'Fecha de adquisición del activo',
    format: 'date',
  })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha de adquisición debe ser una fecha válida (ISO 8601)' })
  fechaAdquisicion?: string;

  @ApiPropertyOptional({
    example: 8200,
    description: 'Costo de adquisición del activo',
    minimum: 0.01,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'El costo de adquisición debe ser un número' })
  @IsPositive({ message: 'El costo de adquisición debe ser positivo' })
  costoAdquisicion?: number;

  @ApiPropertyOptional({
    example: '2028-01-15',
    description: 'Fecha de vencimiento de la garantía',
    format: 'date',
  })
  @IsOptional()
  @IsDateString({}, { message: 'El vencimiento de garantía debe ser una fecha válida (ISO 8601)' })
  vencimientoGarantia?: string;

  @ApiProperty({
    example: 'cmnkly3gf000j2wl67vioxkws',
    description: 'ID de la categoría del activo',
  })
  @IsString({ message: 'El ID de categoría debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La categoría del activo es obligatoria' })
  categoriaId: string;

  @ApiProperty({
    example: 'cmnkly39f000d2wl6qbcilxb2',
    description: 'ID de la ubicación donde se registrará el activo',
  })
  @IsString({ message: 'El ID de ubicación debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La ubicación del activo es obligatoria' })
  ubicacionId: string;

  @ApiPropertyOptional({
    example: 'cmnarea123',
    description: 'ID del área actual asociada al activo',
  })
  @IsOptional()
  @IsString()
  areaActualId?: string;

  @ApiPropertyOptional({
    example: 'cmnuser123',
    description: 'ID del responsable actual del activo',
  })
  @IsOptional()
  @IsString()
  responsableActualId?: string;

  @ApiPropertyOptional({
    enum: EstadoActivo,
    example: EstadoActivo.OPERATIVO,
    description: 'Estado operativo inicial del activo',
  })
  @IsOptional()
  @IsEnum(EstadoActivo, {
    message:
      'El estado debe ser uno de los siguientes valores: OPERATIVO, MANTENIMIENTO, FUERA_DE_SERVICIO, DADO_DE_BAJA',
  })
  estado?: EstadoActivo;

}
