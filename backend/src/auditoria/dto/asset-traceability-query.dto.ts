import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class AssetTraceabilityQueryDto {
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
