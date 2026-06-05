import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EstadoSolicitudCompra,
  TipoSolicitudCompra,
} from '../generated/prisma/client';
import { PrismaService } from '../common/prisma.service';
import { CreatePurchaseRequestDto } from './dto/create-purchase-request.dto';

@Injectable()
export class PurchasesService {
  constructor(private readonly prisma: PrismaService) {}

  async searchCatalog(tipo: TipoSolicitudCompra, query = '') {
    const likeQuery = `%${query.trim()}%`;

    if (tipo === TipoSolicitudCompra.ACTIVO) {
      const rows = await this.prisma.$queryRawUnsafe<
        Array<{
          id: string;
          codigo: string;
          nombre: string;
          descripcion: string | null;
          categoria: string | null;
          detalle: string | null;
          estado: string;
        }>
      >(
        `
        SELECT
          a.id,
          a.codigo,
          a.nombre,
          a.descripcion,
          ca.nombre AS categoria,
          COALESCE(u.nombre, ar.nombre) AS detalle,
          a.estado::text AS estado
        FROM activos a
        LEFT JOIN categorias_activos ca ON ca.id = a."categoriaId"
        LEFT JOIN ubicaciones u ON u.id = a."ubicacionId"
        LEFT JOIN areas ar ON ar.id = a."areaActualId"
        WHERE ($1 = '%%' OR a.nombre ILIKE $1 OR a.codigo ILIKE $1 OR COALESCE(a.descripcion, '') ILIKE $1)
        ORDER BY a."creadoEn" DESC
        LIMIT 24
        `,
        likeQuery,
      );

      return rows.map((row) => ({
        ...row,
        kind: TipoSolicitudCompra.ACTIVO,
      }));
    }

    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        id: string;
        codigo: string;
        nombre: string;
        descripcion: string | null;
        categoria: string | null;
        detalle: string | null;
        estado: string;
      }>
    >(
      `
      SELECT
        m.id,
        m.codigo,
        m.nombre,
        m.descripcion,
        cm.nombre AS categoria,
        CONCAT(m."stockActual"::text, ' ', m.unidad) AS detalle,
        CASE WHEN m."stockActual" > 0 THEN 'Disponible' ELSE 'Sin stock' END AS estado
      FROM materiales m
      LEFT JOIN categorias_materiales cm ON cm.id = m."categoriaId"
      WHERE ($1 = '%%' OR m.nombre ILIKE $1 OR m.codigo ILIKE $1 OR COALESCE(m.descripcion, '') ILIKE $1)
      ORDER BY m."creadoEn" DESC
      LIMIT 24
      `,
      likeQuery,
    );

    return rows.map((row) => ({
      ...row,
      kind: TipoSolicitudCompra.MATERIAL,
    }));
  }

  async create(dto: CreatePurchaseRequestDto, userId: string) {
    await this.assertUserHasPermission(userId, 'PURCHASE_CREATE');

    if (dto.tipo === TipoSolicitudCompra.ACTIVO) {
      if (!dto.activoId) {
        throw new BadRequestException('Debe seleccionar un activo');
      }

      const activo = await this.prisma.activo.findUnique({
        where: { id: dto.activoId },
        select: { id: true },
      });

      if (!activo) {
        throw new NotFoundException('No se encontró el activo solicitado');
      }
    }

    if (dto.tipo === TipoSolicitudCompra.MATERIAL) {
      if (!dto.materialId) {
        throw new BadRequestException('Debe seleccionar un material');
      }

      const material = await this.prisma.material.findUnique({
        where: { id: dto.materialId },
        select: { id: true },
      });

      if (!material) {
        throw new NotFoundException('No se encontró el material solicitado');
      }
    }

    const solicitud = await this.prisma.solicitudCompra.create({
      data: {
        tipo: dto.tipo,
        cantidad: dto.cantidad ?? 1,
        nota: dto.nota?.trim() || null,
        solicitanteId: userId,
        activoId: dto.tipo === TipoSolicitudCompra.ACTIVO ? dto.activoId : null,
        materialId:
          dto.tipo === TipoSolicitudCompra.MATERIAL ? dto.materialId : null,
      },
      include: this.purchaseInclude(),
    });

    return this.mapPurchase(solicitud);
  }

  async findMine(userId: string) {
    await this.assertUserHasPermission(userId, 'PURCHASE_CREATE');

    const solicitudes = await this.prisma.solicitudCompra.findMany({
      where: { solicitanteId: userId },
      orderBy: { creadoEn: 'desc' },
      include: this.purchaseInclude(),
    });

    return solicitudes.map((solicitud) => this.mapPurchase(solicitud));
  }

  private async assertUserHasPermission(userId: string, permissionCode: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: userId },
      select: {
        rol: {
          select: {
            permisos: {
              where: { permiso: { codigo: permissionCode } },
              select: { permisoId: true },
            },
          },
        },
      },
    });

    if (!usuario?.rol.permisos.length) {
      throw new ForbiddenException('No tienes permiso para solicitar compras');
    }
  }

  private purchaseInclude() {
    return {
      activo: {
        select: {
          id: true,
          codigo: true,
          nombre: true,
          descripcion: true,
          estado: true,
          categoria: { select: { nombre: true } },
          ubicacion: { select: { nombre: true } },
        },
      },
      material: {
        select: {
          id: true,
          codigo: true,
          nombre: true,
          descripcion: true,
          unidad: true,
          stockActual: true,
          categoria: { select: { nombre: true } },
        },
      },
    } as const;
  }

  private mapPurchase(solicitud: {
    id: string;
    tipo: TipoSolicitudCompra;
    estado: EstadoSolicitudCompra;
    cantidad: number;
    nota: string | null;
    creadoEn: Date;
    actualizadoEn: Date;
    activo: {
      id: string;
      codigo: string;
      nombre: string;
      descripcion: string | null;
      estado: string;
      categoria: { nombre: string } | null;
      ubicacion: { nombre: string } | null;
    } | null;
    material: {
      id: string;
      codigo: string;
      nombre: string;
      descripcion: string | null;
      unidad: string;
      stockActual: unknown;
      categoria: { nombre: string } | null;
    } | null;
  }) {
    const item =
      solicitud.tipo === TipoSolicitudCompra.ACTIVO
        ? solicitud.activo && {
            id: solicitud.activo.id,
            codigo: solicitud.activo.codigo,
            nombre: solicitud.activo.nombre,
            descripcion: solicitud.activo.descripcion,
            categoria: solicitud.activo.categoria?.nombre ?? null,
            detalle: solicitud.activo.ubicacion?.nombre ?? solicitud.activo.estado,
          }
        : solicitud.material && {
            id: solicitud.material.id,
            codigo: solicitud.material.codigo,
            nombre: solicitud.material.nombre,
            descripcion: solicitud.material.descripcion,
            categoria: solicitud.material.categoria?.nombre ?? null,
            detalle: `${solicitud.material.stockActual} ${solicitud.material.unidad}`,
          };

    return {
      id: solicitud.id,
      tipo: solicitud.tipo,
      estado: solicitud.estado,
      cantidad: solicitud.cantidad,
      nota: solicitud.nota,
      item,
      creadoEn: solicitud.creadoEn,
      actualizadoEn: solicitud.actualizadoEn,
    };
  }
}
