import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ReassignAreaManagerDto {
  @ApiPropertyOptional({
    example: 'cmnusuario123',
    description:
      'Nuevo Responsable de Área. Si se omite o llega vacío, el área queda sin responsable.',
  })
  @IsOptional()
  @IsString()
  encargadoId?: string;
}
