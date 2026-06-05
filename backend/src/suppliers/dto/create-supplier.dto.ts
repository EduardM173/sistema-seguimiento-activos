import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateSupplierDto {
  @IsString()
  @MaxLength(160)
  nombre: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  nit?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  contacto?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  telefono?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  correo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  direccion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  rubro?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observaciones?: string;
}
