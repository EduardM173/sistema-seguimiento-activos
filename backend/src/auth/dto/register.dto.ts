import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'Maria' })
  @IsString()
  @IsNotEmpty({ message: 'Los nombres son obligatorios' })
  nombres: string;

  @ApiProperty({ example: 'Gonzales' })
  @IsString()
  @IsNotEmpty({ message: 'Los apellidos son obligatorios' })
  apellidos: string;

  @ApiProperty({ example: 'maria.gonzales@universidad.edu' })
  @IsEmail({}, { message: 'El correo no tiene un formato valido' })
  correo: string;

  @ApiProperty({ example: 'mgonzales' })
  @IsString()
  @IsNotEmpty({ message: 'El nombre de usuario es obligatorio' })
  nombreUsuario: string;

  @ApiProperty({ minLength: 8, example: 'ClaveSegura123' })
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  password: string;

  @ApiPropertyOptional({ example: '76543210' })
  @IsOptional()
  @IsString()
  telefono?: string;
}
