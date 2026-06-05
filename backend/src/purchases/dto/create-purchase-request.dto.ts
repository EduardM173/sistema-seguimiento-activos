import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { TipoSolicitudCompra } from '../../generated/prisma/client';

export class CreatePurchaseRequestDto {
  @IsEnum(TipoSolicitudCompra)
  tipo: TipoSolicitudCompra;

  @ValidateIf((dto: CreatePurchaseRequestDto) => dto.tipo === TipoSolicitudCompra.ACTIVO)
  @IsString()
  @IsNotEmpty()
  activoId?: string;

  @ValidateIf((dto: CreatePurchaseRequestDto) => dto.tipo === TipoSolicitudCompra.MATERIAL)
  @IsString()
  @IsNotEmpty()
  materialId?: string;

  @IsInt()
  @Min(1)
  @Max(9999)
  cantidad: number = 1;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  nota?: string;
}
