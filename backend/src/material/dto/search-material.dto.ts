import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export enum MaterialSortBy {
  CODIGO = 'codigo',
  NOMBRE = 'nombre',
  CATEGORIA = 'categoria',
  STOCK_ACTUAL = 'stockActual',
  STOCK_MINIMO = 'stockMinimo',
  UNIDAD = 'unidad',
  AREA = 'area',
  CREADO_EN = 'creadoEn',
}

export enum MaterialSortType {
  ASC = 'ASC',
  DESC = 'DESC',
}

export enum MaterialEstadoFilter {
  CRITICO = 'CRITICO',
  NORMAL = 'NORMAL',
}

export class SearchMaterialDTO {
  @ApiPropertyOptional({
    example: 'papel',
    description: 'Texto libre para buscar por código o nombre',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    example: 'cmnkly3id000w2wl6qls04snz',
    description: 'Filtra por categoría',
  })
  @IsOptional()
  @IsString()
  categoriaId?: string;

  @ApiPropertyOptional({
    example: 'cmnkly3id000a2wl6area1234',
    description: 'Filtra por area responsable',
  })
  @IsOptional()
  @IsString()
  areaId?: string;

  @ApiPropertyOptional({
    enum: MaterialEstadoFilter,
    description: 'Filtra por estado del stock',
    example: MaterialEstadoFilter.CRITICO,
  })
  @IsOptional()
  @IsEnum(MaterialEstadoFilter)
  estado?: MaterialEstadoFilter;

  @ApiPropertyOptional({
    enum: MaterialSortBy,
    description: 'Campo por el cual ordenar el listado',
    example: MaterialSortBy.NOMBRE,
  })
  @IsOptional()
  @IsEnum(MaterialSortBy)
  sortBy: MaterialSortBy = MaterialSortBy.CREADO_EN;

  @ApiPropertyOptional({
    enum: MaterialSortType,
    description: 'Dirección de ordenación',
    example: MaterialSortType.DESC,
  })
  @IsOptional()
  @IsEnum(MaterialSortType)
  sortType: MaterialSortType = MaterialSortType.DESC;

  @ApiPropertyOptional({
    example: 1,
    description: 'Número de página',
    minimum: 1,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({
    example: 10,
    description: 'Cantidad de resultados por página',
    minimum: 1,
    maximum: 100,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 10;

  @ApiPropertyOptional({
    example: 0,
    description: 'Compatibilidad con paginación basada en desplazamiento',
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  skip?: number;

  @ApiPropertyOptional({
    example: 20,
    description: 'Compatibilidad con cantidad máxima de resultados',
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number;
}
