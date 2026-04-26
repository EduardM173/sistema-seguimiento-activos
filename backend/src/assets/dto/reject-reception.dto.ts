import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RejectReceptionDto {
  @ApiProperty({
    description: 'Motivo del rechazo de la recepción',
    example: 'El activo llegó con daños visibles en la pantalla',
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty({ message: 'El motivo del rechazo es obligatorio' })
  @MaxLength(500, {
    message: 'El motivo no puede exceder 500 caracteres',
  })
  motivoRechazo!: string;
}