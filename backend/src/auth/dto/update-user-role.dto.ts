import { IsString, IsNotEmpty } from 'class-validator';

export class UpdateUserRoleDto {
  @IsString()
  @IsNotEmpty()
  rolId: string; // El ID del nuevo rol que vamos a asignar
}