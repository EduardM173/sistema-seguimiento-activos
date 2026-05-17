import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EstadoNotificacion,
  Prisma,
  TipoNotificacion,
  TipoMovimientoActivo,
} from '../generated/prisma/client';
import { PrismaService } from '../common/prisma.service';
import { AssetTraceabilityQueryDto } from './dto/asset-traceability-query.dto';
import { SearchNotificationsDto } from './dto/search-notifications.dto';

@Injectable()
export class AuditoriaService {
  constructor(private readonly prisma: PrismaService) {}

  async getAssetTraceability(
    userId: string,
    assetId: string,
    query: AssetTraceabilityQueryDto = {},
  ) {
    await this.assertUserHasPermission(
      userId,
      'AUDIT_VIEW',
      'No tienes permisos para consultar la trazabilidad de activos',
    );

    const asset = await this.prisma.activo.findUnique({
      where: { id: assetId },
      select: {
        id: true,
        codigo: true,
        nombre: true,
        descripcion: true,
        estado: true,
        creadoEn: true,
        actualizadoEn: true,
        dadoDeBajaEn: true,
        motivoBaja: true,
        categoria: {
          select: {
            id: true,
            nombre: true,
          },
        },
        ubicacion: {
          select: {
            id: true,
            nombre: true,
          },
        },
        areaActual: {
          select: {
            id: true,
            nombre: true,
          },
        },
        responsableActual: {
          select: {
            id: true,
            nombres: true,
            apellidos: true,
          },
        },
      },
    });

    if (!asset) {
      throw new NotFoundException(
        `No se encontró el activo con ID: ${assetId}`,
      );
    }

    const dateRange = this.buildTraceabilityDateRange(query);

    const [movimientos, auditorias] = await Promise.all([
      this.prisma.movimientoActivo.findMany({
        where: {
          activoId: assetId,
          ...(dateRange ? { creadoEn: dateRange } : {}),
        },
        select: {
          id: true,
          tipo: true,
          areaOrigenId: true,
          areaDestinoId: true,
          usuarioOrigenId: true,
          usuarioDestinoId: true,
          asignacionId: true,
          detalle: true,
          creadoEn: true,
          realizadoPor: {
            select: {
              id: true,
              nombres: true,
              apellidos: true,
            },
          },
        },
        orderBy: {
          creadoEn: 'asc',
        },
      }),
      this.prisma.auditoria.findMany({
        where: {
          entidadId: assetId,
          ...(dateRange ? { creadoEn: dateRange } : {}),
          OR: [
            { tipoEntidad: 'activo' },
            { tipoEntidad: 'activos' },
            { tipoEntidad: 'Activo' },
            { tipoEntidad: 'ACTIVO' },
          ],
        },
        select: {
          id: true,
          accion: true,
          valoresAnteriores: true,
          valoresNuevos: true,
          creadoEn: true,
          direccionIp: true,
          userAgent: true,
          usuario: {
            select: {
              id: true,
              nombres: true,
              apellidos: true,
            },
          },
        },
        orderBy: {
          creadoEn: 'asc',
        },
      }),
    ]);

    const areaIds = [
      ...new Set(
        movimientos
          .flatMap((movimiento) => [
            movimiento.areaOrigenId,
            movimiento.areaDestinoId,
          ])
          .filter((areaId): areaId is string => Boolean(areaId)),
      ),
    ];

    const areas =
      areaIds.length > 0
        ? await this.prisma.area.findMany({
            where: {
              id: { in: areaIds },
            },
            select: {
              id: true,
              nombre: true,
            },
          })
        : [];

    const areaMap = Object.fromEntries(areas.map((area) => [area.id, area]));

    const usuarioIds = [
      ...new Set(
        movimientos
          .flatMap((movimiento) => [
            movimiento.usuarioOrigenId,
            movimiento.usuarioDestinoId,
          ])
          .filter((usuarioId): usuarioId is string => Boolean(usuarioId)),
      ),
    ];

    const usuarios =
      usuarioIds.length > 0
        ? await this.prisma.usuario.findMany({
            where: {
              id: { in: usuarioIds },
            },
            select: {
              id: true,
              nombres: true,
              apellidos: true,
            },
          })
        : [];

    const usuarioMap = Object.fromEntries(
      usuarios.map((usuario) => [usuario.id, usuario]),
    );

    const movimientosUnificados = movimientos.map((movimiento) => ({
      id: movimiento.id,
      fuente: 'MOVIMIENTO' as const,
      fecha: movimiento.creadoEn,
      tipo: movimiento.tipo,
      etiqueta: this.formatMovementType(movimiento.tipo),
      detalle: movimiento.detalle ?? 'Sin detalle registrado',
      areaOrigen: movimiento.areaOrigenId
        ? (areaMap[movimiento.areaOrigenId] ?? null)
        : null,
      areaDestino: movimiento.areaDestinoId
        ? (areaMap[movimiento.areaDestinoId] ?? null)
        : null,
      usuarioOrigen: movimiento.usuarioOrigenId
        ? this.mapUserSummary(usuarioMap[movimiento.usuarioOrigenId])
        : null,
      usuarioDestino: movimiento.usuarioDestinoId
        ? this.mapUserSummary(usuarioMap[movimiento.usuarioDestinoId])
        : null,
      usuarioOrigenId: movimiento.usuarioOrigenId,
      usuarioDestinoId: movimiento.usuarioDestinoId,
      asignacionId: movimiento.asignacionId,
      realizadoPor: this.mapUserSummary(movimiento.realizadoPor),
    }));

    const movimientosPorTipo = this.buildMovementTypeSummary(movimientos);

    const timeline = [
      ...movimientosUnificados,
      ...auditorias.map((registro) => ({
        id: registro.id,
        fuente: 'AUDITORIA' as const,
        fecha: registro.creadoEn,
        tipo: 'AUDITORIA',
        etiqueta: registro.accion,
        detalle: `Registro de auditoría: ${registro.accion}`,
        areaOrigen: null,
        areaDestino: null,
        usuarioOrigenId: null,
        usuarioDestinoId: null,
        asignacionId: null,
        realizadoPor: this.mapUserSummary(registro.usuario),
        auditoria: {
          accion: registro.accion,
          valoresAnteriores: registro.valoresAnteriores,
          valoresNuevos: registro.valoresNuevos,
          direccionIp: registro.direccionIp,
          userAgent: registro.userAgent,
        },
      })),
    ].sort((left, right) => {
      const leftTime = new Date(left.fecha).getTime();
      const rightTime = new Date(right.fecha).getTime();
      return leftTime - rightTime;
    });

    return {
      activo: {
        id: asset.id,
        codigo: asset.codigo,
        nombre: asset.nombre,
        descripcion: asset.descripcion,
        estado: asset.estado,
        creadoEn: asset.creadoEn,
        actualizadoEn: asset.actualizadoEn,
        dadoDeBajaEn: asset.dadoDeBajaEn,
        motivoBaja: asset.motivoBaja,
        categoria: asset.categoria,
        ubicacion: asset.ubicacion,
        areaActual: asset.areaActual,
        responsableActual: asset.responsableActual
          ? {
              id: asset.responsableActual.id,
              nombreCompleto: this.buildFullName(
                asset.responsableActual.nombres,
                asset.responsableActual.apellidos,
              ),
            }
          : null,
      },
      resumen: {
        totalEventos: timeline.length,
        totalMovimientos: movimientos.length,
        totalRegistrosAuditoria: auditorias.length,
        movimientosPorTipo,
      },
      movimientos: movimientosUnificados,
      timeline,
    };
  }

  async getNotifications(userId: string, query: SearchNotificationsDto) {
    const scope = await this.resolveNotificationScope(userId);

    const { page = 1, pageSize = 20, leidas } = query;
    const skip = (page - 1) * pageSize;

    const where: Prisma.NotificacionWhereInput = {
      OR: [
        { usuarioId: userId },
        ...scope.areaIds.map((areaId) => ({ areaId })),
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
      data: notifications.map((notification) => {
        const assetReference = this.extractAssetReference(notification.mensaje);

        return {
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
        contenido: this.cleanNotificationMessage(notification.mensaje),
        referencias: assetReference
          ? {
              recursoTipo: 'activo',
              recursoId: assetReference,
            }
          : notification.materialId
            ? {
                recursoTipo: 'material',
                recursoId: notification.materialId,
              }
            : undefined,
        accion: assetReference
          ? {
              label: 'Ver activo',
              url: `/activos/${assetReference}`,
            }
          : undefined,
        leida: notification.estado === EstadoNotificacion.LEIDA,
        fechaCreacion: notification.creadoEn,
        fechaLectura: notification.leidoEn ?? undefined,
      };
      }),
      total,
      pagina: page,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      hasMore: page * pageSize < total,
    };
  }

  async markAsRead(userId: string, notificationId: string) {
    const scope = await this.resolveNotificationScope(userId);

    const notification = await this.prisma.notificacion.findFirst({
      where: {
        id: notificationId,
        OR: [
          { usuarioId: userId },
          ...scope.areaIds.map((areaId) => ({ areaId })),
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
    const scope = await this.resolveNotificationScope(userId);

    const result = await this.prisma.notificacion.updateMany({
      where: {
        estado: EstadoNotificacion.NO_LEIDA,
        OR: [
          { usuarioId: userId },
          ...scope.areaIds.map((areaId) => ({ areaId })),
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
    const scope = await this.resolveNotificationScope(userId);

    const notification = await this.prisma.notificacion.findFirst({
      where: {
        id: notificationId,
        OR: [
          { usuarioId: userId },
          ...scope.areaIds.map((areaId) => ({ areaId })),
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
    const scope = await this.resolveNotificationScope(userId);

    const total = await this.prisma.notificacion.count({
      where: {
        estado: EstadoNotificacion.NO_LEIDA,
        OR: [
          { usuarioId: userId },
          ...scope.areaIds.map((areaId) => ({ areaId })),
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

  private formatMovementType(type: TipoMovimientoActivo) {
    switch (type) {
      case TipoMovimientoActivo.REGISTRO:
        return 'Registro';
      case TipoMovimientoActivo.ASIGNACION:
        return 'Asignación';
      case TipoMovimientoActivo.TRANSFERENCIA:
        return 'Transferencia';
      case TipoMovimientoActivo.DEVOLUCION:
        return 'Devolución';
      case TipoMovimientoActivo.BAJA:
        return 'Baja';
      case TipoMovimientoActivo.ACTUALIZACION:
        return 'Actualización';
      case TipoMovimientoActivo.INCIDENTE:
        return 'Incidente';
      default:
        return type;
    }
  }

  private buildFullName(nombres?: string | null, apellidos?: string | null) {
    return [nombres, apellidos].filter(Boolean).join(' ').trim();
  }

  private mapUserSummary(
    user?: { id: string; nombres: string; apellidos: string } | null,
  ) {
    if (!user) return null;

    return {
      id: user.id,
      nombreCompleto: this.buildFullName(user.nombres, user.apellidos),
    };
  }

  private buildMovementTypeSummary(
    movimientos: Array<{ tipo: TipoMovimientoActivo }>,
  ) {
    const initialSummary = Object.values(TipoMovimientoActivo).reduce(
      (summary, tipo) => ({
        ...summary,
        [tipo]: 0,
      }),
      {} as Record<TipoMovimientoActivo, number>,
    );

    return movimientos.reduce((summary, movimiento) => {
      summary[movimiento.tipo] += 1;
      return summary;
    }, initialSummary);
  }

  private buildTraceabilityDateRange(query: AssetTraceabilityQueryDto) {
    const range: Prisma.DateTimeFilter = {};
    const startDate = query.fechaDesde
      ? this.parseStartOfDay(query.fechaDesde)
      : null;
    const endDate = query.fechaHasta ? this.parseEndOfDay(query.fechaHasta) : null;

    if (startDate && endDate && startDate.getTime() > endDate.getTime()) {
      throw new BadRequestException(
        'La fecha desde no puede ser posterior a la fecha hasta',
      );
    }

    if (startDate) {
      range.gte = startDate;
    }

    if (endDate) {
      range.lte = endDate;
    }

    return Object.keys(range).length > 0 ? range : null;
  }

  private parseStartOfDay(value: string) {
    const date = new Date(value);
    date.setUTCHours(0, 0, 0, 0);
    return date;
  }

  private parseEndOfDay(value: string) {
    const date = new Date(value);
    date.setUTCHours(23, 59, 59, 999);
    return date;
  }

  private async assertUserHasPermission(
    userId: string,
    permissionCode: string,
    message = 'No tienes permisos para realizar esta acción',
  ) {
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

    const hasPermission = Boolean(
      usuario?.rol?.permisos?.some(
        (item) => item.permiso.codigo === permissionCode,
      ),
    );

    if (!hasPermission) {
      throw new ForbiddenException(message);
    }
  }

  private extractAssetReference(message: string) {
    const match = message.match(/\[ASSET_ID:([^\]]+)\]/);
    return match?.[1] ?? null;
  }

  private cleanNotificationMessage(message: string) {
    return message.replace(/\[ASSET_ID:[^\]]+\]\s*/g, '').trim();
  }

  private async resolveNotificationScope(userId: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: userId },
      select: {
        areaId: true,
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

    const managedAreas = await this.prisma.area.findMany({
      where: {
        encargadoId: userId,
      },
      select: {
        id: true,
      },
    });

    const areaIds = Array.from(
      new Set([
        ...(usuario?.areaId ? [usuario.areaId] : []),
        ...managedAreas.map((area) => area.id),
      ]),
    );

    return { areaIds };
  }
}
