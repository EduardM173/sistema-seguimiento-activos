import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class DisableAssetDto {
  @ApiProperty({
    description: 'Motivo del retiro o baja del activo',
    example: 'Equipo obsoleto, no cumple con requisitos mínimos',
    maxLength: 500,
  })
  @IsNotEmpty({ message: 'El motivo de baja es obligatorio' })
  @IsString({ message: 'El motivo debe ser texto' })
  @MaxLength(500, { message: 'El motivo no puede exceder 500 caracteres' })
  motivo: string;
}