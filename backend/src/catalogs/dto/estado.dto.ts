import { ApiProperty } from '@nestjs/swagger';

export class EstadoDto {
  @ApiProperty({
    example: 'OPERATIVO',
    description: 'Valor interno del estado (coincide con enum del backend)'
  })
  valor: string;

  @ApiProperty({
    example: 'Operativo',
    description: 'Nombre legible del estado para mostrar en UI'
  })
  label: string;

  @ApiProperty({
    example: 'Activo funcionando correctamente',
    description: 'Descripción del estado'
  })
  descripcion: string;
}