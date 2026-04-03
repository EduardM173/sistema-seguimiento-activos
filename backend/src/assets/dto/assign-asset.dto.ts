import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AssignAssetDto {
  @ApiPropertyOptional({
    description: 'ID del usuario al que se asigna el activo',
    example: 'cm1usuario123',
  })
  @IsOptional()
  @IsString()
  usuarioAsignadoId?: string;

  @ApiPropertyOptional({
    description: 'ID del área a la que se asigna el activo',
    example: 'cm1area123',
  })
  @IsOptional()
  @IsString()
  areaAsignadaId?: string;

  @ApiPropertyOptional({
    description: 'Observaciones opcionales sobre la asignación',
    example: 'Se entrega para uso operativo del área',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observaciones?: string;
}
