import { IsString, IsOptional, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateLocationDto {
  @ApiProperty({ example: 'Oficina de Sistemas', description: 'Nombre de la ubicación', maxLength: 100 })
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre de la ubicación es obligatorio' })
  @MaxLength(100, { message: 'El nombre no puede exceder 100 caracteres' })
  nombre?: string;

  @ApiPropertyOptional({ example: 'Bloque A', description: 'Edificio donde se encuentra', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  edificio?: string;

  @ApiPropertyOptional({ example: '2', description: 'Piso del edificio', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  piso?: string;

  @ApiPropertyOptional({ example: '201', description: 'Ambiente o sala', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  ambiente?: string;

  @ApiPropertyOptional({ example: 'Oficina principal del área de sistemas', description: 'Descripción de la ubicación', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;
}