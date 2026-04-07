import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';

import { PrismaService } from '../common/prisma.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { SearchAssetsDto } from './dto/search-assets.dto';
import { AssignAssetDto } from './dto/assign-asset.dto';
import { EstadoActivo, Prisma } from '../generated/prisma/client';

@Injectable()
export class AssetsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Paginated list of all assets with optional filters.
   */
  async findAll(query: SearchAssetsDto) {
    const { page, pageSize, q, estado, categoriaId, ubicacionId } = query;
    const skip = (page - 1) * pageSize;

    const where: Prisma.ActivoWhereInput = {};

    // Search by asset data, category, location or responsible person
    if (q) {
      const searchTerms = q
        .trim()
        .split(/\s+/)
        .filter(Boolean);

      where.OR = [
        { nombre: { contains: q, mode: 'insensitive' } },
        { codigo: { contains: q, mode: 'insensitive' } },
        {
          categoria: {
            is: {
              OR: [
                { nombre: { contains: q, mode: 'insensitive' } },
                { descripcion: { contains: q, mode: 'insensitive' } },
              ],
            },
          },
        },
        {
          ubicacion: {
            is: {
              OR: [
                { nombre: { contains: q, mode: 'insensitive' } },
                { edificio: { contains: q, mode: 'insensitive' } },
                { piso: { contains: q, mode: 'insensitive' } },
                { ambiente: { contains: q, mode: 'insensitive' } },
                { descripcion: { contains: q, mode: 'insensitive' } },
              ],
            },
          },
        },
        {
          responsableActual: {
            is: {
              AND: searchTerms.map((term) => ({
                OR: [
                  { nombres: { contains: term, mode: 'insensitive' } },
                  { apellidos: { contains: term, mode: 'insensitive' } },
                  { correo: { contains: term, mode: 'insensitive' } },
                  { nombreUsuario: { contains: term, mode: 'insensitive' } },
                ],
              })),
            },
          },
        },
      ];
    }

    // Filter by status
    if (estado) {
      where.estado = estado;
    }

    // Filter by category
    if (categoriaId) {
      where.categoriaId = categoriaId;
    }


    // Filter by location
    if(ubicacionId) {
      where.ubicacionId = ubicacionId;
    }

    const [activos, total] = await Promise.all([
      this.prisma.activo.findMany({
        where,
        select: {
          id: true,
          codigo: true,
          nombre: true,
          descripcion: true,
          marca: true,
          modelo: true,
          estado: true,
          creadoEn: true,
          categoria: {
            select: { id: true, nombre: true },
          },
          ubicacion: {
            select: { id: true, nombre: true },
          },
          areaActual: {
            select: { id: true, nombre: true },
          },
          responsableActual: {
            select: { id: true, nombres: true, apellidos: true },
          },
        },
        orderBy: { creadoEn: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.activo.count({ where }),
    ]);

    const data = activos.map((activo) => ({
      id: activo.id,
      codigo: activo.codigo,
      nombre: activo.nombre,
      descripcion: activo.descripcion,
      marca: activo.marca,
      modelo: activo.modelo,
      estado: activo.estado,
      estadoLabel: this.formatEstado(activo.estado),
      creadoEn: activo.creadoEn,
      categoria: activo.categoria,
      ubicacion: activo.ubicacion
        ? activo.ubicacion
        : null,
      area: activo.areaActual
        ? activo.areaActual
        : null,
      responsable: activo.responsableActual
        ? {
            id: activo.responsableActual.id,
            nombreCompleto: `${activo.responsableActual.nombres} ${activo.responsableActual.apellidos}`,
          }
        : null,
    }));

    return { data, total, page, pageSize };
  }

  /**
   * Get a single asset with full details.
   */
  async findOne(id: string) {
    const activo = await this.prisma.activo.findUnique({
      where: { id },
      include: {
        categoria: true,
        ubicacion: true,
        areaActual: true,
        responsableActual: {
          select: {
            id: true,
            nombres: true,
            apellidos: true,
            correo: true,
          },
        },
        creadoPor: {
          select: {
            id: true,
            nombres: true,
            apellidos: true,
          },
        },
        actualizadoPor: {
          select: {
            id: true,
            nombres: true,
            apellidos: true,
          },
        },
      },
    });

    if (!activo) {
      throw new NotFoundException(`No se encontró el activo con ID: ${id}`);
    }

    return {
      ...activo,
      estadoLabel: this.formatEstado(activo.estado),
      area: activo.areaActual
        ? {
            id: activo.areaActual.id,
            nombre: activo.areaActual.nombre,
          }
        : null,
      responsable: activo.responsableActual
        ? {
            id: activo.responsableActual.id,
            nombreCompleto: this.buildFullName(
              activo.responsableActual.nombres,
              activo.responsableActual.apellidos,
            ),
          }
        : null,
      responsableActual: activo.responsableActual
        ? {
            ...activo.responsableActual,
            nombreCompleto: this.buildFullName(
              activo.responsableActual.nombres,
              activo.responsableActual.apellidos,
            ),
          }
        : null,
      creadoPor: activo.creadoPor
        ? {
            ...activo.creadoPor,
            nombreCompleto: this.buildFullName(
              activo.creadoPor.nombres,
              activo.creadoPor.apellidos,
            ),
          }
        : null,
      actualizadoPor: activo.actualizadoPor
        ? {
            ...activo.actualizadoPor,
            nombreCompleto: this.buildFullName(
              activo.actualizadoPor.nombres,
              activo.actualizadoPor.apellidos,
            ),
          }
        : null,
    };
  }

  /**
   * Create a new asset.
   * Validates code uniqueness and category existence.
   */
  async create(dto: CreateAssetDto, userId: string) {
    // Validate code uniqueness
    const existingByCode = await this.prisma.activo.findUnique({
      where: { codigo: dto.codigo },
    });

    if (existingByCode) {
      throw new ConflictException(
        `Ya existe un activo registrado con el código: ${dto.codigo}`,
      );
    }

    // Validate serial number uniqueness (if provided)
    if (dto.numeroSerie) {
      const existingBySerie = await this.prisma.activo.findUnique({
        where: { numeroSerie: dto.numeroSerie },
      });

      if (existingBySerie) {
        throw new ConflictException(
          `Ya existe un activo registrado con el número de serie: ${dto.numeroSerie}`,
        );
      }
    }

    // Validate category exists
    const categoria = await this.prisma.categoriaActivo.findUnique({
      where: { id: dto.categoriaId },
    });

    if (!categoria) {
      throw new NotFoundException(
        `No se encontró la categoría con ID: ${dto.categoriaId}`,
      );
    }

    // Validate ubicacion exists (if provided)
    if (dto.ubicacionId) {
      const ubicacion = await this.prisma.ubicacion.findUnique({
        where: { id: dto.ubicacionId },
      });
      if (!ubicacion) {
        throw new NotFoundException(
          `No se encontró la ubicación con ID: ${dto.ubicacionId}`,
        );
      }
    }

    // Validate area exists (if provided)
    if (dto.areaActualId) {
      const area = await this.prisma.area.findUnique({
        where: { id: dto.areaActualId },
      });
      if (!area) {
        throw new NotFoundException(
          `No se encontró el área con ID: ${dto.areaActualId}`,
        );
      }
    }

    const activo = await this.prisma.activo.create({
      data: {
        codigo: dto.codigo,
        nombre: dto.nombre,
        descripcion: dto.descripcion,
        marca: dto.marca,
        modelo: dto.modelo,
        numeroSerie: dto.numeroSerie,
        fechaAdquisicion: dto.fechaAdquisicion
          ? new Date(dto.fechaAdquisicion)
          : undefined,
        costoAdquisicion: dto.costoAdquisicion,
        vencimientoGarantia: dto.vencimientoGarantia
          ? new Date(dto.vencimientoGarantia)
          : undefined,
        categoriaId: dto.categoriaId,
        ubicacionId: dto.ubicacionId,
        areaActualId: dto.areaActualId,
        responsableActualId: dto.responsableActualId,
        creadoPorId: userId,
        actualizadoPorId: userId,
      },
      include: {
        categoria: true,
        ubicacion: true,
        areaActual: true,
      },
    });

    return activo;
  }

  /**
   * Update an existing asset.
   * Validates code uniqueness if the code is changing.
   */
  async update(id: string, dto: UpdateAssetDto, userId: string) {
    // Verify asset exists
    const existing = await this.prisma.activo.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`No se encontró el activo con ID: ${id}`);
    }

    // Validate code uniqueness if changing
    if (dto.codigo && dto.codigo !== existing.codigo) {
      const existingByCode = await this.prisma.activo.findUnique({
        where: { codigo: dto.codigo },
      });

      if (existingByCode) {
        throw new ConflictException(
          `Ya existe un activo registrado con el código: ${dto.codigo}`,
        );
      }
    }

    // Validate serial number uniqueness if changing
    if (dto.numeroSerie && dto.numeroSerie !== existing.numeroSerie) {
      const existingBySerie = await this.prisma.activo.findUnique({
        where: { numeroSerie: dto.numeroSerie },
      });

      if (existingBySerie) {
        throw new ConflictException(
          `Ya existe un activo registrado con el número de serie: ${dto.numeroSerie}`,
        );
      }
    }

    // Validate category exists if changing
    if (dto.categoriaId && dto.categoriaId !== existing.categoriaId) {
      const categoria = await this.prisma.categoriaActivo.findUnique({
        where: { id: dto.categoriaId },
      });

      if (!categoria) {
        throw new NotFoundException(
          `No se encontró la categoría con ID: ${dto.categoriaId}`,
        );
      }
    }

    const activo = await this.prisma.activo.update({
      where: { id },
      data: {
        ...(dto.codigo !== undefined && { codigo: dto.codigo }),
        ...(dto.nombre !== undefined && { nombre: dto.nombre }),
        ...(dto.descripcion !== undefined && { descripcion: dto.descripcion }),
        ...(dto.marca !== undefined && { marca: dto.marca }),
        ...(dto.modelo !== undefined && { modelo: dto.modelo }),
        ...(dto.numeroSerie !== undefined && { numeroSerie: dto.numeroSerie }),
        ...(dto.fechaAdquisicion !== undefined && {
          fechaAdquisicion: new Date(dto.fechaAdquisicion),
        }),
        ...(dto.costoAdquisicion !== undefined && {
          costoAdquisicion: dto.costoAdquisicion,
        }),
        ...(dto.vencimientoGarantia !== undefined && {
          vencimientoGarantia: new Date(dto.vencimientoGarantia),
        }),
        ...(dto.estado !== undefined && { estado: dto.estado }),
        ...(dto.categoriaId !== undefined && { categoriaId: dto.categoriaId }),
        ...(dto.ubicacionId !== undefined && { ubicacionId: dto.ubicacionId }),
        ...(dto.areaActualId !== undefined && {
          areaActualId: dto.areaActualId,
        }),
        ...(dto.responsableActualId !== undefined && {
          responsableActualId: dto.responsableActualId,
        }),
        actualizadoPorId: userId,
      },
      include: {
        categoria: true,
        ubicacion: true,
        areaActual: true,
      },
    });

    return activo;
  }

  async assign(id: string, dto: AssignAssetDto, userId: string) {
    const assignToUser = dto.usuarioAsignadoId?.trim();
    const assignToArea = dto.areaAsignadaId?.trim();

    if ((!assignToUser && !assignToArea) || (assignToUser && assignToArea)) {
      throw new BadRequestException(
        'Debe asignar el activo a un usuario o a un área, pero no a ambos',
      );
    }

    const existing = await this.prisma.activo.findUnique({
      where: { id },
      select: {
        id: true,
        estado: true,
        areaActualId: true,
        responsableActualId: true,
      },
    });

    if (!existing) {
      throw new NotFoundException(`No se encontró el activo con ID: ${id}`);
    }

    if (existing.estado === EstadoActivo.DADO_DE_BAJA) {
      throw new ConflictException('No se puede asignar un activo dado de baja');
    }

    const finalUsuarioId = assignToUser ?? existing.responsableActualId ?? null;
    const finalAreaId = assignToArea ?? existing.areaActualId ?? null;

    let usuarioAsignado:
      | {
          id: string;
          nombres: string;
          apellidos: string;
        }
      | null = null;
    let areaAsignada: { id: string; nombre: string } | null = null;

    if (assignToUser) {
      usuarioAsignado = await this.prisma.usuario.findUnique({
        where: { id: assignToUser },
        select: {
          id: true,
          nombres: true,
          apellidos: true,
        },
      });

      if (!usuarioAsignado) {
        throw new NotFoundException(
          `No se encontró el usuario con ID: ${assignToUser}`,
        );
      }
    }

    if (assignToArea) {
      areaAsignada = await this.prisma.area.findUnique({
        where: { id: assignToArea },
        select: {
          id: true,
          nombre: true,
        },
      });

      if (!areaAsignada) {
        throw new NotFoundException(
          `No se encontró el área con ID: ${assignToArea}`,
        );
      }
    }

    if (!usuarioAsignado && finalUsuarioId) {
      usuarioAsignado = await this.prisma.usuario.findUnique({
        where: { id: finalUsuarioId },
        select: {
          id: true,
          nombres: true,
          apellidos: true,
        },
      });
    }

    if (!areaAsignada && finalAreaId) {
      areaAsignada = await this.prisma.area.findUnique({
        where: { id: finalAreaId },
        select: {
          id: true,
          nombre: true,
        },
      });
    }

    const observaciones = dto.observaciones?.trim() || undefined;

    const result = await this.prisma.$transaction(async (tx) => {
      const asignacion = await tx.asignacionActivo.create({
        data: {
          activoId: id,
          usuarioAsignadoId: finalUsuarioId,
          areaAsignadaId: finalAreaId,
          asignadoPorId: userId,
          observaciones,
        },
        select: {
          id: true,
          estado: true,
          asignadoEn: true,
          observaciones: true,
        },
      });

      await tx.movimientoActivo.create({
        data: {
          activoId: id,
          tipo: 'ASIGNACION',
          areaOrigenId: existing.areaActualId,
          areaDestinoId: finalAreaId,
          usuarioOrigenId: existing.responsableActualId,
          usuarioDestinoId: finalUsuarioId,
          realizadoPorId: userId,
          asignacionId: asignacion.id,
          detalle: observaciones,
        },
      });

      await tx.activo.update({
        where: { id },
        data: {
          areaActualId: finalAreaId,
          responsableActualId: finalUsuarioId,
          actualizadoPorId: userId,
        },
      });

      return asignacion;
    });

    const activoActualizado = await this.findOne(id);

    return {
      message: usuarioAsignado
        ? `Activo asignado al usuario ${this.buildFullName(
            usuarioAsignado.nombres,
            usuarioAsignado.apellidos,
          )}`
        : `Activo asignado al área ${areaAsignada?.nombre}`,
      asignacion: {
        ...result,
        usuarioAsignado: usuarioAsignado
          ? {
              id: usuarioAsignado.id,
              nombreCompleto: this.buildFullName(
                usuarioAsignado.nombres,
                usuarioAsignado.apellidos,
              ),
            }
          : null,
        areaAsignada: areaAsignada,
      },
      asset: activoActualizado,
    };
  }

  /**
   * Soft-delete an asset (dar de baja).
   * Sets status to DADO_DE_BAJA and records the timestamp.
   */
  async remove(id: string, userId: string) {
    const existing = await this.prisma.activo.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`No se encontró el activo con ID: ${id}`);
    }

    if (existing.estado === EstadoActivo.DADO_DE_BAJA) {
      throw new ConflictException('Este activo ya fue dado de baja');
    }

    const activo = await this.prisma.activo.update({
      where: { id },
      data: {
        estado: EstadoActivo.DADO_DE_BAJA,
        dadoDeBajaEn: new Date(),
        actualizadoPorId: userId,
      },
    });

    return activo;
  }

  /**
   * Generate a unique asset code that does not exist in the database.
   * Format: ACT-XXXXXXXX (8-char hex from UUID).
   */
  async generateUniqueCode(): Promise<string> {
    const maxAttempts = 10;
    for (let i = 0; i < maxAttempts; i++) {
      const uuid = randomUUID().replace(/-/g, '');
      const code = `ACT-${uuid.substring(0, 8).toUpperCase()}`;

      const existing = await this.prisma.activo.findUnique({
        where: { codigo: code },
        select: { id: true },
      });

      if (!existing) {
        return code;
      }
    }

    // Fallback: use full UUID segment for guaranteed uniqueness
    const uuid = randomUUID().replace(/-/g, '');
    return `ACT-${uuid.substring(0, 12).toUpperCase()}`;
  }

  /**
   * Translates enum status values to human-readable labels.
   */
  private formatEstado(estado: string): string {
    const estados: Record<string, string> = {
      OPERATIVO: 'Operativo',
      MANTENIMIENTO: 'Mantenimiento',
      FUERA_DE_SERVICIO: 'Fuera de servicio',
      DADO_DE_BAJA: 'Dado de baja',
    };

    return estados[estado] ?? estado;
  }

  private buildFullName(nombres: string, apellidos?: string | null): string {
    return [nombres, apellidos].filter(Boolean).join(' ').trim();
  }
}
