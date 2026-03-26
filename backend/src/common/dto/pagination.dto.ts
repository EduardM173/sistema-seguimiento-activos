import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Reusable pagination query params.
 * Extend this in module-specific search DTOs or use directly.
 *
 * Usage: GET /api/assets?page=2&pageSize=10
 */
export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La página debe ser un número entero' })
  @Min(1, { message: 'La página mínima es 1' })
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El tamaño de página debe ser un número entero' })
  @Min(1, { message: 'El tamaño mínimo de página es 1' })
  @Max(100, { message: 'El tamaño máximo de página es 100' })
  pageSize: number = 20;
}
