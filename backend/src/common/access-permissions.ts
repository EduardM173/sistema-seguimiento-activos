import { PrismaService } from './prisma.service';

export const CORE_ACCESS_PERMISSIONS = [
  {
    codigo: 'USER_MANAGE',
    nombre: 'Gestionar usuarios',
    descripcion: 'Crear, editar, desactivar y consultar usuarios.',
    defaultRoleNames: ['ADMIN_GENERAL', 'ADMIN'],
  },
  {
    codigo: 'ROLE_ASSIGN',
    nombre: 'Asignar roles',
    descripcion: 'Administrar la matriz de roles y permisos.',
    defaultRoleNames: ['ADMIN_GENERAL', 'ADMIN'],
  },
  {
    codigo: 'ASSET_CREATE',
    nombre: 'Registrar activos',
    descripcion: 'Permite crear nuevos activos en el sistema.',
    defaultRoleNames: ['ADMIN_GENERAL', 'ADMIN', 'USUARIO_OPERATIVO'],
  },
  {
    codigo: 'ASSET_UPDATE',
    nombre: 'Actualizar activos',
    descripcion: 'Permite editar información de activos existentes.',
    defaultRoleNames: ['ADMIN_GENERAL', 'ADMIN', 'USUARIO_OPERATIVO'],
  },
  {
    codigo: 'ASSET_VIEW',
    nombre: 'Ver activos',
    descripcion: 'Permite consultar el listado y detalle de activos.',
    defaultRoleNames: [
      'ADMIN_GENERAL',
      'ADMIN',
      'USUARIO_OPERATIVO',
      'RESPONSABLE_DE_AREA',
      'RESPONSABLE_AREA',
    ],
  },
  {
    codigo: 'ASSET_ASSIGN',
    nombre: 'Asignar activos',
    descripcion: 'Permite asignar activos a usuarios o áreas.',
    defaultRoleNames: ['ADMIN_GENERAL', 'ADMIN', 'USUARIO_OPERATIVO'],
  },
  {
    codigo: 'INVENTORY_MANAGE',
    nombre: 'Gestionar inventario',
    descripcion: 'Permite administrar el inventario de materiales.',
    defaultRoleNames: ['ADMIN_GENERAL', 'ADMIN', 'USUARIO_OPERATIVO'],
  },
  {
    codigo: 'REPORT_VIEW',
    nombre: 'Ver reportes',
    descripcion: 'Permite acceder al módulo de reportes.',
    defaultRoleNames: [
      'ADMIN_GENERAL',
      'ADMIN',
      'RESPONSABLE_DE_AREA',
      'RESPONSABLE_AREA',
    ],
  },
  {
    codigo: 'AUDIT_VIEW',
    nombre: 'Ver auditoría',
    descripcion: 'Permite consultar el módulo de auditoría.',
    defaultRoleNames: ['ADMIN_GENERAL', 'ADMIN'],
  },
  {
    codigo: 'TRANSFER_MANAGE',
    nombre: 'Gestionar transferencias',
    descripcion:
      'Permite acceder y registrar transferencias de activos entre áreas.',
    defaultRoleNames: ['ADMIN_GENERAL', 'ADMIN', 'USUARIO_OPERATIVO'],
  },
  {
    codigo: 'NOTIFICATION_VIEW',
    nombre: 'Ver notificaciones',
    descripcion:
      'Permite acceder a la bandeja de notificaciones del Responsable de Área.',
    defaultRoleNames: ['RESPONSABLE_DE_AREA', 'RESPONSABLE_AREA'],
  },
] as const;

function normalizeRoleName(roleName: string) {
  return roleName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_\s]+/g, ' ')
    .trim()
    .toUpperCase();
}

export async function ensureCoreAccessPermissions(prisma: PrismaService) {
  const existingPermissions = await prisma.permiso.findMany({
    where: {
      codigo: {
        in: CORE_ACCESS_PERMISSIONS.map((permission) => permission.codigo),
      },
    },
    select: {
      id: true,
      codigo: true,
    },
  });

  const existingCodes = new Set(
    existingPermissions.map((permission) => permission.codigo),
  );

  const missingPermissions = CORE_ACCESS_PERMISSIONS.filter(
    (permission) => !existingCodes.has(permission.codigo),
  );

  if (missingPermissions.length > 0) {
    await prisma.permiso.createMany({
      data: missingPermissions.map((permission) => ({
        codigo: permission.codigo,
        nombre: permission.nombre,
        descripcion: permission.descripcion,
      })),
      skipDuplicates: true,
    });
  }

  const permissions = await prisma.permiso.findMany({
    where: {
      codigo: {
        in: CORE_ACCESS_PERMISSIONS.map((permission) => permission.codigo),
      },
    },
    select: {
      id: true,
      codigo: true,
    },
  });

  const permissionByCode = new Map(
    permissions.map((permission) => [permission.codigo, permission]),
  );

  const roles = await prisma.rol.findMany({
    select: {
      id: true,
      nombre: true,
      permisos: {
        select: {
          permisoId: true,
        },
      },
    },
  });

  for (const permission of CORE_ACCESS_PERMISSIONS) {
    const persistedPermission = permissionByCode.get(permission.codigo);

    if (!persistedPermission) {
      continue;
    }

    for (const role of roles) {
      const normalizedRoleName = normalizeRoleName(role.nombre);
      const shouldReceivePermission = permission.defaultRoleNames.some(
        (roleName) => normalizeRoleName(roleName) === normalizedRoleName,
      );

      if (!shouldReceivePermission) {
        continue;
      }

      const alreadyAssigned = role.permisos.some(
        (rolePermission) => rolePermission.permisoId === persistedPermission.id,
      );

      if (alreadyAssigned) {
        continue;
      }

      await prisma.rolPermiso.create({
        data: {
          rolId: role.id,
          permisoId: persistedPermission.id,
        },
      });
    }
  }
}
