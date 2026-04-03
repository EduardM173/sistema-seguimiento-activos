import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AssignAssetDto {
  @IsOptional()
  @IsString()
  usuarioAsignadoId?: string;

  @IsOptional()
  @IsString()
  areaAsignadaId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observaciones?: string;
}
