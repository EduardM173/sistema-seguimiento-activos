import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, Min } from 'class-validator';

export class ReducirStockDTO {
  @ApiProperty({
    example: 3,
    description: 'Cantidad de unidades que salen del inventario',
    minimum: 1,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  cantidad!: number;

  @ApiProperty({
    example: 'Entrega a laboratorio para práctica',
    description: 'Motivo de la salida de inventario',
  })
  @IsString()
  motivo!: string;
}
