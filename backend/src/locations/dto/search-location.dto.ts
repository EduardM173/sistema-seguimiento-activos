import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class SearchLocationsDto extends PaginationDto {
  @ApiPropertyOptional({
    example: 'oficina',
    description: 'Patrón de búsqueda por similitud sobre el nombre de la ubicación',
  })
  @IsOptional()
  @IsString()
  pattern?: string;

  @ApiPropertyOptional({ example: 'Bloque A', description: 'Filtrar por edificio' })
  @IsOptional()
  @IsString()
  edificio?: string;

  @ApiPropertyOptional({ example: '2', description: 'Filtrar por piso' })
  @IsOptional()
  @IsString()
  piso?: string;

  @ApiPropertyOptional({ example: '201', description: 'Filtrar por ambiente' })
  @IsOptional()
  @IsString()
  ambiente?: string;
}