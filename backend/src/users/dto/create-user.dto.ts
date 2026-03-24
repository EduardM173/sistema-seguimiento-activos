import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  nombres: string;

  @IsString()
  @IsNotEmpty()
  apellidos: string;

  @IsEmail()
  correo: string;

  @IsString()
  @IsNotEmpty()
  nombreUsuario: string;

  @IsString()
  @MinLength(6)
  password: string;
}