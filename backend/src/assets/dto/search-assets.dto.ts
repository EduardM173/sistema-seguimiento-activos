import { IsEnum, IsOptional, IsString } from 'class-validator';

import { PaginationDto } from '../../common/dto/pagination.dto';
import { EstadoActivo } from '../../generated/prisma/client';

export class SearchAssetsDto extends PaginationDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsEnum(EstadoActivo, {
    message: `El estado debe ser uno de: ${Object.values(EstadoActivo).join(', ')}`,
  })
  estado?: EstadoActivo;

  @IsOptional()
  @IsString()
  categoriaId?: string;

  @IsOptional()
  @IsString()
  ubicacionId?: string;
}
