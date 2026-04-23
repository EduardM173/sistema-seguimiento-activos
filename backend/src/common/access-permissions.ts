import { PrismaService } from './prisma.service';

export const CORE_ACCESS_PERMISSIONS = [
  {
    codigo: 'TRANSFER_MANAGE',
    nombre: 'Gestionar transferencias',
    descripcion:
      'Permite acceder y registrar transferencias de activos entre áreas.',
    defaultRoleNames: ['USUARIO_OPERATIVO'],
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
