// backend/src/roles/roles.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  // Obtener todos los módulos disponibles
  async getModulosDisponibles() {
    const modulosExistentes = await this.prisma.rolPermiso.findMany({
      select: { modulo: true },
      distinct: ['modulo'],
      orderBy: { modulo: 'asc' },
    });

    const modulosBase = [
      'Dashboard',
      'Usuarios',
      'Roles',
      'Activos',
      'Asignaciones',
      'Inventario',
      'Reportes',
      'Auditoria',
    ];

    const todosModulos = [...new Set([...modulosBase, ...modulosExistentes.map(m => m.modulo)])];
    
    return todosModulos.sort();
  }

  // Obtener todos los roles con sus permisos
  async findAllWithPermissions() {
    const roles = await this.prisma.rol.findMany({
      include: {
        permisos: {
          orderBy: {
            modulo: 'asc',
          },
        },
      },
    });

    const modulos = await this.getModulosDisponibles();

    const rolesFormateados = roles.map(rol => {
      const permisosMap = new Map();
      
      modulos.forEach(modulo => {
        permisosMap.set(modulo, {
          ver: false,
          crear: false,
          actualizar: false,
          eliminar: false,
        });
      });

      rol.permisos.forEach(permiso => {
        permisosMap.set(permiso.modulo, {
          ver: permiso.ver,
          crear: permiso.crear,
          actualizar: permiso.actualizar,
          eliminar: permiso.eliminar,
        });
      });

      return {
        id: rol.id,
        nombre: rol.nombre,
        descripcion: rol.descripcion,
        permisos: Object.fromEntries(permisosMap),
      };
    });

    return {
      roles: rolesFormateados,
      modulos,
    };
  }

  // Obtener roles para el select
  async getRolesForSelect() {
    return this.prisma.rol.findMany({
      select: {
        id: true,
        nombre: true,
        descripcion: true,
      },
      orderBy: {
        nombre: 'asc',
      },
    });
  }

  // Obtener permisos de un rol específico
  async getPermisosByRol(rolId: string) {
    const rol = await this.prisma.rol.findUnique({
      where: { id: rolId },
      include: {
        permisos: true,
      },
    });

    if (!rol) {
      throw new NotFoundException(`Rol con ID ${rolId} no encontrado`);
    }

    const modulos = await this.getModulosDisponibles();
    const permisosMap = new Map();

    modulos.forEach(modulo => {
      permisosMap.set(modulo, {
        ver: false,
        crear: false,
        actualizar: false,
        eliminar: false,
      });
    });

    rol.permisos.forEach(permiso => {
      permisosMap.set(permiso.modulo, {
        ver: permiso.ver,
        crear: permiso.crear,
        actualizar: permiso.actualizar,
        eliminar: permiso.eliminar,
      });
    });

    return {
      rol: {
        id: rol.id,
        nombre: rol.nombre,
        descripcion: rol.descripcion,
      },
      permisos: Object.fromEntries(permisosMap),
    };
  }

  // Actualizar permisos completos de un rol
  async updatePermisos(rolId: string, permisos: any) {
    const rol = await this.prisma.rol.findUnique({
      where: { id: rolId },
    });

    if (!rol) {
      throw new NotFoundException(`Rol con ID ${rolId} no encontrado`);
    }

    const updates = Object.entries(permisos).map(async ([modulo, acciones]: [string, any]) => {
      return this.prisma.rolPermiso.upsert({
        where: {
          rolId_modulo: {
            rolId: rolId,
            modulo: modulo,
          },
        },
        update: {
          ver: acciones.ver || false,
          crear: acciones.crear || false,
          actualizar: acciones.actualizar || false,
          eliminar: acciones.eliminar || false,
        },
        create: {
          rolId: rolId,
          modulo: modulo,
          ver: acciones.ver || false,
          crear: acciones.crear || false,
          actualizar: acciones.actualizar || false,
          eliminar: acciones.eliminar || false,
        },
      });
    });

    await Promise.all(updates);

    return {
      message: 'Permisos actualizados correctamente',
      rolId,
    };
  }

  // Actualizar un permiso específico (para compatibilidad con el endpoint existente)
  async updatePermission(rolId: string, permisoId: string, updateData: any) {
    // Este método mantiene compatibilidad pero se recomienda usar updatePermisos
    const rol = await this.prisma.rol.findUnique({
      where: { id: rolId },
    });

    if (!rol) {
      throw new NotFoundException(`Rol con ID ${rolId} no encontrado`);
    }

    // Buscar el permiso por ID
    const permiso = await this.prisma.rolPermiso.findUnique({
      where: { id: permisoId },
    });

    if (!permiso) {
      throw new NotFoundException(`Permiso con ID ${permisoId} no encontrado`);
    }

    const updatedPermiso = await this.prisma.rolPermiso.update({
      where: { id: permisoId },
      data: updateData,
    });

    return {
      message: 'Permiso actualizado correctamente',
      permiso: updatedPermiso,
    };
  }
}