import { IsOptional, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class SearchMaterialHistoryDTO {
  @ApiPropertyOptional({
    description: 'Fecha inicial del rango',
    example: '2026-04-01',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Fecha final del rango',
    example: '2026-04-19',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}