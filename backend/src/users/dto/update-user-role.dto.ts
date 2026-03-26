import { IsString, IsNotEmpty } from 'class-validator';

export class UpdateUserRoleDto {
  @IsString()
  @IsNotEmpty()
  rolId: string;
}
