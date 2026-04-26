import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { ConfirmarRecepcionDTO, RechazarRecepcionDTO } from './dto';

@Injectable()
export class AsignacionesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Obtener asignaciones pendientes por área
   */
  async findPendientesByArea(
    areaId: string,
    page: number = 1,
    pageSize: number = 100,
  ) {
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const where = {
      areaAsignadaId: areaId,
      estado: 'PENDIENTE',
    };

    const [data, total] = await Promise.all([
      this.prisma.asignacionActivo.findMany({
        where,
        skip,
        take,
        orderBy: { asignadoEn: 'desc' },
        include: {
          activo: {
            select: {
              id: true,
              codigoActivo: true,
              nombre: true,
              marca: true,
              modelo: true,
              estado: true,
            },
          },
          areaAsignada: true,
          usuarioAsignado: {
            select: {
              id: true,
              nombres: true,
              apellidos: true,
            },
          },
          asignadoPor: {
            select: {
              id: true,
              nombres: true,
              apellidos: true,
            },
          },
          recibidoPor: {
            select: {
              id: true,
              nombres: true,
              apellidos: true,
            },
          },
        },
      }),
      this.prisma.asignacionActivo.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Confirmar recepción de activo (PROSIN-294, PROSIN-360)
   */
  async confirmarRecepcion(
    id: string,
    usuarioId: string,
    data: ConfirmarRecepcionDTO,
  ) {
    try {
      // Verificar que la asignación existe
      const asignacion = await this.prisma.asignacionActivo.findUnique({
        where: { id },
        include: {
          areaAsignada: true,
          activo: true,
        },
      });

      if (!asignacion) {
        throw new NotFoundException('Asignación no encontrada');
      }

      // Verificar que está pendiente
      if (asignacion.estado !== 'PENDIENTE') {
        throw new BadRequestException(
          `La asignación ya fue ${asignacion.estado === 'RECIBIDO' ? 'recibida' : 'rechazada'}`,
        );
      }

      // Actualizar la asignación
      const updated = await this.prisma.asignacionActivo.update({
        where: { id },
        data: {
          estado: 'RECIBIDO',
          recibidoPorId: usuarioId,
          recibidoEn: new Date(),
          observaciones: data.observaciones,
        },
        include: {
          activo: true,
          areaAsignada: true,
        },
      });

      // Actualizar el área actual del activo
      await this.prisma.activo.update({
        where: { id: asignacion.activoId },
        data: {
          areaActualId: asignacion.areaAsignadaId,
        },
      });

      // Registrar movimiento en el historial
      await this.prisma.movimientoActivo.create({
        data: {
          activoId: asignacion.activoId,
          tipo: 'ASIGNACION',
          areaDestinoId: asignacion.areaAsignadaId,
          realizadoPorId: usuarioId,
          asignacionId: id,
          detalle: `Recepción confirmada por el responsable del área. ${data.observaciones || ''}`,
        },
      });

      return updated;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Error al confirmar la recepción: ' + error.message,
      );
    }
  }

  /**
   * Rechazar recepción de activo (PROSIN-329, PROSIN-369, PROSIN-370)
   */
  async rechazarRecepcion(
    id: string,
    usuarioId: string,
    data: RechazarRecepcionDTO,
  ) {
    try {
      // Verificar que la asignación existe
      const asignacion = await this.prisma.asignacionActivo.findUnique({
        where: { id },
        include: {
          areaAsignada: true,
          activo: true,
        },
      });

      if (!asignacion) {
        throw new NotFoundException('Asignación no encontrada');
      }

      // Verificar que está pendiente
      if (asignacion.estado !== 'PENDIENTE') {
        throw new BadRequestException(
          `La asignación ya fue ${asignacion.estado === 'RECIBIDO' ? 'recibida' : 'rechazada'}`,
        );
      }

      // Actualizar la asignación
      const updated = await this.prisma.asignacionActivo.update({
        where: { id },
        data: {
          estado: 'RECHAZADO',
          recibidoPorId: usuarioId,
          recibidoEn: new Date(),
          motivoRechazo: data.motivo,
          observaciones: data.observaciones,
        },
        include: {
          activo: true,
          areaAsignada: true,
        },
      });

      // Registrar movimiento en el historial
      await this.prisma.movimientoActivo.create({
        data: {
          activoId: asignacion.activoId,
          tipo: 'DEVOLUCION',
          areaOrigenId: asignacion.areaAsignadaId,
          realizadoPorId: usuarioId,
          asignacionId: id,
          detalle: `Recepción rechazada. Motivo: ${data.motivo}. ${data.observaciones || ''}`,
        },
      });

      return updated;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Error al rechazar la recepción: ' + error.message,
      );
    }
  }

  /**
   * Verificar si un usuario es responsable del área destino
   */
  async verificarResponsableArea(usuarioId: string, areaId: string): Promise<boolean> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { areaId: true },
    });

    return usuario?.areaId === areaId;
  }
}