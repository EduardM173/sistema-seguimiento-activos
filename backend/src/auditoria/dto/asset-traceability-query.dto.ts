import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { TipoMovimientoActivo } from '../../generated/prisma/client';

export class AssetTraceabilityQueryDto {
  @ApiPropertyOptional({
    description: 'Tipo de movimiento a filtrar',
    enum: TipoMovimientoActivo,
    example: TipoMovimientoActivo.TRANSFERENCIA,
  })
  @IsOptional()
  @IsEnum(TipoMovimientoActivo)
  tipoMovimiento?: TipoMovimientoActivo;

  @ApiPropertyOptional({
    description: 'Fecha inicial del rango de trazabilidad en formato ISO',
    example: '2026-05-01',
  })
  @IsOptional()
  @IsDateString()
  fechaDesde?: string;

  @ApiPropertyOptional({
    description: 'Fecha final del rango de trazabilidad en formato ISO',
    example: '2026-05-31',
  })
  @IsOptional()
  @IsDateString()
  fechaHasta?: string;
}
