import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RechazarRecepcionDTO {
  @ApiProperty({
    description: 'Motivo del rechazo',
    example: 'DETERIORO',
    enum: ['DETERIORO', 'INCOMPLETO', 'NO_CORRESPONDE', 'DOCUMENTACION', 'OTRO'],
  })
  @IsNotEmpty()
  @IsString()
  motivo: string;

  @ApiPropertyOptional({
    description: 'Observaciones adicionales sobre el rechazo',
    example: 'El activo llegó con daños en la carcasa',
  })
  @IsOptional()
  @IsString()
  observaciones?: string;
}