// backend/src/users/users.controller.ts
import { Body, Controller, Get, Patch, Param, Post, ForbiddenException, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get('roles')
  getRoles() {
    return this.usersService.getRoles();
  }

  @Patch(':id/role')
  async updateRole(
    @Param('id') id: string,
    @Body() updateUserRoleDto: UpdateUserRoleDto,
    @CurrentUser() currentUser: any,
  ) {
    // Verificar que solo ADMIN pueda asignar roles (PA: PROSIN-112)
    if (currentUser?.rol?.nombre !== 'ADMIN_GENERAL') {
      throw new ForbiddenException('Solo el administrador puede asignar roles');
    }
    return this.usersService.updateRole(id, updateUserRoleDto);
  }

  // --- RUTAS DE MATRIZ ---

  @Get('roles/:id/permissions')
  getRolePermissions(@Param('id') id: string) {
    return this.usersService.getPermissionsByRole(id);
  }

  @Patch('roles/:id/permissions/:modulo')
  updateMatrix(
    @Param('id') id: string,
    @Param('modulo') modulo: string,
    @Body() updateData: any
  ) {
    return this.usersService.updateMatrix(id, modulo, updateData);
  }
}