import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  EstadoNotificacion,
  Prisma,
  TipoNotificacion,
} from '../generated/prisma/client';
import { PrismaService } from '../common/prisma.service';
import { SearchNotificationsDto } from './dto/search-notifications.dto';

@Injectable()
export class AuditoriaService {
  constructor(private readonly prisma: PrismaService) {}

  async getNotifications(userId: string, query: SearchNotificationsDto) {
    await this.assertResponsibleAreaAccess(userId);

    const { page = 1, pageSize = 20, leidas } = query;
    const skip = (page - 1) * pageSize;

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: userId },
      select: { areaId: true },
    });

    const where: Prisma.NotificacionWhereInput = {
      OR: [
        { usuarioId: userId },
        ...(usuario?.areaId ? [{ areaId: usuario.areaId }] : []),
      ],
    };

    if (leidas !== undefined) {
      where.estado = leidas
        ? EstadoNotificacion.LEIDA
        : EstadoNotificacion.NO_LEIDA;
    }

    const [notifications, total] = await Promise.all([
      this.prisma.notificacion.findMany({
        where,
        include: {
          usuario: {
            select: {
              id: true,
              nombres: true,
              apellidos: true,
              correo: true,
            },
          },
          material: {
            select: {
              id: true,
              nombre: true,
            },
          },
        },
        orderBy: {
          creadoEn: 'desc',
        },
        skip,
        take: pageSize,
      }),
      this.prisma.notificacion.count({ where }),
    ]);

    return {
      data: notifications.map((notification) => ({
        id: notification.id,
        usuarioId: notification.usuarioId ?? userId,
        usuarioParaQuien: notification.usuario
          ? {
              id: notification.usuario.id,
              nombres: notification.usuario.nombres,
              apellidos: notification.usuario.apellidos,
              correo: notification.usuario.correo,
            }
          : undefined,
        tipo: this.mapNotificationType(notification.tipo),
        asunto: notification.titulo,
        contenido: notification.mensaje,
        referencias: notification.materialId
          ? {
              recursoTipo: 'material',
              recursoId: notification.materialId,
            }
          : undefined,
        leida: notification.estado === EstadoNotificacion.LEIDA,
        fechaCreacion: notification.creadoEn,
        fechaLectura: notification.leidoEn ?? undefined,
      })),
      total,
      pagina: page,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      hasMore: page * pageSize < total,
    };
  }

  async markAsRead(userId: string, notificationId: string) {
    await this.assertResponsibleAreaAccess(userId);

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: userId },
      select: { areaId: true },
    });

    const notification = await this.prisma.notificacion.findFirst({
      where: {
        id: notificationId,
        OR: [
          { usuarioId: userId },
          ...(usuario?.areaId ? [{ areaId: usuario.areaId }] : []),
        ],
      },
    });

    if (!notification) {
      throw new NotFoundException('Notificación no encontrada');
    }

    return this.prisma.notificacion.update({
      where: { id: notificationId },
      data: {
        estado: EstadoNotificacion.LEIDA,
        leidoEn: new Date(),
      },
    });
  }

  async markAllAsRead(userId: string) {
    await this.assertResponsibleAreaAccess(userId);

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: userId },
      select: { areaId: true },
    });

    const result = await this.prisma.notificacion.updateMany({
      where: {
        estado: EstadoNotificacion.NO_LEIDA,
        OR: [
          { usuarioId: userId },
          ...(usuario?.areaId ? [{ areaId: usuario.areaId }] : []),
        ],
      },
      data: {
        estado: EstadoNotificacion.LEIDA,
        leidoEn: new Date(),
      },
    });

    return { marcadas: result.count };
  }

  async deleteNotification(userId: string, notificationId: string) {
    await this.assertResponsibleAreaAccess(userId);

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: userId },
      select: { areaId: true },
    });

    const notification = await this.prisma.notificacion.findFirst({
      where: {
        id: notificationId,
        OR: [
          { usuarioId: userId },
          ...(usuario?.areaId ? [{ areaId: usuario.areaId }] : []),
        ],
      },
      select: { id: true },
    });

    if (!notification) {
      throw new NotFoundException('Notificación no encontrada');
    }

    await this.prisma.notificacion.delete({
      where: { id: notificationId },
    });
  }

  async getUnreadCount(userId: string) {
    await this.assertResponsibleAreaAccess(userId);

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: userId },
      select: { areaId: true },
    });

    const total = await this.prisma.notificacion.count({
      where: {
        estado: EstadoNotificacion.NO_LEIDA,
        OR: [
          { usuarioId: userId },
          ...(usuario?.areaId ? [{ areaId: usuario.areaId }] : []),
        ],
      },
    });

    return { total };
  }

  private mapNotificationType(type: TipoNotificacion) {
    switch (type) {
      case TipoNotificacion.ACTIVO_PENDIENTE_CONFIRMACION:
        return 'transferencia_pendiente';
      case TipoNotificacion.ACTIVO_RECHAZADO:
        return 'auditoria_pendiente';
      case TipoNotificacion.STOCK_BAJO:
        return 'stock_critico';
      case TipoNotificacion.ACTIVO_TRANSFERIDO:
      case TipoNotificacion.ACTIVO_ASIGNADO:
        return 'sistema';
      case TipoNotificacion.ALERTA_SISTEMA:
      default:
        return 'sistema';
    }
  }

  private async assertResponsibleAreaAccess(userId: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: userId },
      select: {
        rol: {
          select: {
            permisos: {
              select: {
                permiso: {
                  select: {
                    codigo: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const hasNotificationPermission = Boolean(
      usuario?.rol?.permisos?.some(
        (item) => item.permiso.codigo === 'NOTIFICATION_VIEW',
      ),
    );

    if (!hasNotificationPermission) {
      throw new ForbiddenException(
        'No tienes permisos para acceder a la bandeja de notificaciones',
      );
    }
  }
}
