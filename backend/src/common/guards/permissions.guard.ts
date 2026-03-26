// backend/src/common/guards/permissions.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma.service';
import { PERMISSIONS_KEY, PermissionRequirements } from '../decorators/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requirements = this.reflector.getAllAndOverride<PermissionRequirements>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Si no hay requisitos de permisos, permitir acceso
    if (!requirements) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Usuario no autenticado');
    }

    // Obtener los permisos del rol del usuario
    const rolPermisos = await this.prisma.rolPermiso.findUnique({
      where: {
        rolId_modulo: {
          rolId: user.rolId,
          modulo: requirements.modulo,
        },
      },
    });

    if (!rolPermisos) {
      throw new ForbiddenException(`No tienes permisos para acceder a ${requirements.modulo}`);
    }

    // Verificar cada acción requerida
    for (const accion of requirements.acciones) {
      if (!rolPermisos[accion]) {
        throw new ForbiddenException(
          `No tienes permiso para ${accion} en ${requirements.modulo}`,
        );
      }
    }

    return true;
  }
}