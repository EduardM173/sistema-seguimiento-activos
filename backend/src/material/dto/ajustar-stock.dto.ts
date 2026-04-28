import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, Min } from 'class-validator';

export class AjustarStockDTO {
  @ApiProperty({
    example: 15,
    description: 'Cantidad registrada actualmente en el sistema',
    minimum: 0,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cantidadRegistrada!: number;

  @ApiProperty({
    example: 12,
    description: 'Cantidad física contada durante el ajuste',
    minimum: 0,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cantidadFisica!: number;

  @ApiProperty({
    example: 'Ajuste por conteo físico mensual',
    description: 'Motivo del ajuste de inventario',
  })
  @IsString()
  motivo!: string;
}
