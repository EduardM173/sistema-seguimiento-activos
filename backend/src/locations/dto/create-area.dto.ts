import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAreaDto {
  @ApiProperty({
    example: 'Sistemas',
    description: 'Nombre del área institucional',
    maxLength: 100,
  })
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre del área es obligatorio' })
  @MaxLength(100, { message: 'El nombre no puede exceder 100 caracteres' })
  nombre!: string;

  @ApiPropertyOptional({
    example: 'Área responsable de soporte tecnológico',
    description: 'Descripción breve del área',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;

  @ApiPropertyOptional({
    example: 'cmnubicacion123',
    description: 'Ubicación física asociada al área',
  })
  @IsOptional()
  @IsString()
  ubicacionId?: string;

  @ApiPropertyOptional({
    example: 'cmnusuario123',
    description: 'Usuario Responsable de Área asignado como encargado',
  })
  @IsOptional()
  @IsString()
  encargadoId?: string;
}
