// backend/src/roles/roles.controller.ts
import { Controller, Get, Patch, Put, Param, Body, UseGuards } from '@nestjs/common';
import { RolesService } from './roles.service';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('roles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  // Obtener matriz de roles con permisos
  @Get('matrix')
  @Permissions({ modulo: 'Roles', acciones: ['ver'] })
  async getMatrix() {
    return this.rolesService.findAllWithPermissions();
  }

  // Obtener todos los roles con sus permisos (para la matriz de permisos)
  @Get('with-permissions')
  @Permissions({ modulo: 'Roles', acciones: ['ver'] })
  async findAllWithPermissions() {
    return this.rolesService.findAllWithPermissions();
  }

  // Obtener roles disponibles para el select
  @Get('select')
  @Permissions({ modulo: 'Roles', acciones: ['ver'] })
  async getRolesForSelect() {
    return this.rolesService.getRolesForSelect();
  }

  // Obtener permisos de un rol específico
  @Get(':id/permisos')
  @Permissions({ modulo: 'Roles', acciones: ['ver'] })
  async getPermisosByRol(@Param('id') id: string) {
    return this.rolesService.getPermisosByRol(id);
  }

  // Actualizar permisos completos de un rol
  @Put(':id/permisos')
  @Permissions({ modulo: 'Roles', acciones: ['actualizar'] })
  async updatePermisos(
    @Param('id') id: string,
    @Body() body: { permisos: any },
  ) {
    return this.rolesService.updatePermisos(id, body.permisos);
  }

  // Actualizar un permiso específico (mantener compatibilidad)
  @Patch(':rolId/permissions/:permisoId')
  @Permissions({ modulo: 'Roles', acciones: ['actualizar'] })
  async updatePermission(
    @Param('rolId') rolId: string,
    @Param('permisoId') permisoId: string,
    @Body() updateData: any,
  ) {
    return this.rolesService.updatePermission(rolId, permisoId, updateData);
  }
}