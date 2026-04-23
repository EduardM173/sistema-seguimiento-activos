import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class SearchNotificationsDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filtra notificaciones leídas o no leídas',
    example: false,
  })
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' || value === '1' ? true : value === 'false' || value === '0' ? false : value,
  )
  @IsBoolean({ message: 'El filtro de lectura debe ser booleano' })
  leidas?: boolean;
}
