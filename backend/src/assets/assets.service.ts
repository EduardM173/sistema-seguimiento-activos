import { Injectable } from '@nestjs/common';

import { PrismaService } from '../common/prisma.service';

@Injectable()
export class AssetsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const activos = await this.prisma.activo.findMany({
      select: {
        id: true,
        codigo: true,
        nombre: true,
        estado: true,
        ubicacion: {
          select: {
            nombre: true,
          },
        },
      },
      orderBy: {
        creadoEn: 'desc',
      },
    });

    return activos.map((activo) => ({
      id: activo.id,
      codigo: activo.codigo,
      nombre: activo.nombre,
      estado: this.formatEstado(activo.estado),
      ubicacion: activo.ubicacion?.nombre ?? 'Sin ubicación asignada',
    }));
  }

  private formatEstado(estado: string): string {
    const estados: Record<string, string> = {
      OPERATIVO: 'Operativo',
      MANTENIMIENTO: 'Mantenimiento',
      FUERA_DE_SERVICIO: 'Fuera de servicio',
      DADO_DE_BAJA: 'Dado de baja',
    };

    return estados[estado] ?? estado;
  }
}