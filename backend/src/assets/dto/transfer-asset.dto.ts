import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class TransferAssetDto {
  @ApiProperty({
    description: 'ID del área de destino a la que se transfiere el activo',
    example: 'cm1area124',
  })
  @IsString()
  @IsNotEmpty({ message: 'El área de destino es obligatoria' })
  areaDestinoId!: string;

  @ApiPropertyOptional({
    description: 'Observaciones opcionales de la transferencia',
    example: 'Transferencia registrada desde el área de Sistemas',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, {
    message: 'Las observaciones no pueden exceder 500 caracteres',
  })
  observaciones?: string;
}
