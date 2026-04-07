import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateLocationDto {
  @ApiPropertyOptional({ example: 'Oficina de Sistemas', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nombre?: string;

  @ApiPropertyOptional({ example: 'Bloque A', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  edificio?: string;

  @ApiPropertyOptional({ example: '2', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  piso?: string;

  @ApiPropertyOptional({ example: '201', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  ambiente?: string;

  @ApiPropertyOptional({ example: 'Oficina principal del área de sistemas', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;
}