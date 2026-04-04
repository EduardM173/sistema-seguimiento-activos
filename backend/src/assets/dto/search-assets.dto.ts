import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

import { PaginationDto } from '../../common/dto/pagination.dto';
import { EstadoActivo } from '../../generated/prisma/client';

export class SearchAssetsDto extends PaginationDto {
  @ApiPropertyOptional({
    example: 'laptop hp',
    description: 'Texto de búsqueda por código, nombre, categoría, ubicación o responsable asignado',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    enum: EstadoActivo,
    example: EstadoActivo.OPERATIVO,
    description: 'Filtra activos por estado',
  })
  @IsOptional()
  @IsEnum(EstadoActivo, {
    message: `El estado debe ser uno de: ${Object.values(EstadoActivo).join(', ')}`,
  })
  estado?: EstadoActivo;

  @ApiPropertyOptional({
    example: 'cmnkly3gf000j2wl67vioxkws',
    description: 'ID de la categoría del activo',
  })
  @IsOptional()
  @IsString()
  categoriaId?: string;

  @ApiPropertyOptional({
    example: 'cmnkly39f000d2wl6qbcilxb2',
    description: 'ID de la ubicación del activo',
  })
  @IsOptional()
  @IsString()
  ubicacionId?: string;
}
