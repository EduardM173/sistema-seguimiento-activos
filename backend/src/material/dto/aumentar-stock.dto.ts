import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min } from 'class-validator';

export class AumentarStockDTO {
  @ApiProperty({
    example: 15,
    description: 'Cantidad de unidades que ingresan al inventario',
    minimum: 1,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  cantidad!: number;
}
