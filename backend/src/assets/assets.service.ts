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
import {
  AssetSortBy,
  SearchAssetsDto,
  SortType,
} from './dto/search-assets.dto';
import { AssignAssetDto } from './dto/assign-asset.dto';
import { TransferAssetDto } from './dto/transfer-asset.dto';
import {
  EstadoAsignacion,
  EstadoActivo,
  Prisma,
  TipoMovimientoActivo,
} from '../generated/prisma/client';

@Injectable()
export class AssetsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Paginated list of all assets with optional filters.
   */
  async findAll(query: SearchAssetsDto) {
    const {
      page,
      pageSize,
      q,
      estado,
      categoriaId,
      ubicacionId,
      soloTransferibles,
      sortBy = AssetSortBy.CREADO_EN,
      sortType = SortType.DESC,
    } = query;
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

    if (soloTransferibles) {
      where.estado = EstadoActivo.OPERATIVO;
      where.asignaciones = {
        none: {
          estado: EstadoAsignacion.PENDIENTE,
          movimientos: {
            some: {
              tipo: TipoMovimientoActivo.TRANSFERENCIA,
            },
          },
        },
      };
    }

    const orderDirection: Prisma.SortOrder =
      sortType === SortType.ASC ? 'asc' : 'desc';

    const orderBy: Prisma.ActivoOrderByWithRelationInput =
      sortBy === AssetSortBy.CODIGO
        ? { codigo: orderDirection }
        : sortBy === AssetSortBy.NOMBRE
          ? { nombre: orderDirection }
          : sortBy === AssetSortBy.CATEGORIA
            ? { categoria: { nombre: orderDirection } }
            : sortBy === AssetSortBy.UBICACION
              ? { ubicacion: { nombre: orderDirection } }
              : sortBy === AssetSortBy.RESPONSABLE
                ? { responsableActual: { nombres: orderDirection } }
          : sortBy === AssetSortBy.ESTADO
            ? { estado: orderDirection }
            : { creadoEn: orderDirection };

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
        orderBy,
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
        estado: dto.estado,
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

    const nextCodigo =
      dto.codigo !== undefined ? dto.codigo.trim() : existing.codigo;
    const nextNombre =
      dto.nombre !== undefined ? dto.nombre.trim() : existing.nombre;
    const nextCategoriaId =
      dto.categoriaId !== undefined ? dto.categoriaId.trim() : existing.categoriaId;
    const nextUbicacionId =
      dto.ubicacionId !== undefined ? dto.ubicacionId.trim() || null : undefined;
    const nextAreaActualId =
      dto.areaActualId !== undefined ? dto.areaActualId.trim() || null : undefined;
    const nextResponsableActualId =
      dto.responsableActualId !== undefined
        ? dto.responsableActualId.trim() || null
        : undefined;

    if (!nextCodigo) {
      throw new BadRequestException('El código del activo es obligatorio');
    }

    if (!nextNombre) {
      throw new BadRequestException('El nombre del activo es obligatorio');
    }

    if (!nextCategoriaId) {
      throw new BadRequestException('La categoría del activo es obligatoria');
    }

    const isTransferUpdate =
      (nextUbicacionId !== undefined && nextUbicacionId !== existing.ubicacionId) ||
      (nextAreaActualId !== undefined && nextAreaActualId !== existing.areaActualId) ||
      (nextResponsableActualId !== undefined &&
        nextResponsableActualId !== existing.responsableActualId);

    if (isTransferUpdate && existing.estado !== EstadoActivo.OPERATIVO) {
      throw new ConflictException(
        'Solo se puede transferir un activo cuando está en estado Operativo',
      );
    }

    // Validate code uniqueness if changing
    if (nextCodigo !== existing.codigo) {
      const existingByCode = await this.prisma.activo.findUnique({
        where: { codigo: nextCodigo },
      });

      if (existingByCode) {
        throw new ConflictException(
          `Ya existe un activo registrado con el código: ${nextCodigo}`,
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
    if (nextCategoriaId !== existing.categoriaId) {
      const categoria = await this.prisma.categoriaActivo.findUnique({
        where: { id: nextCategoriaId },
      });

      if (!categoria) {
        throw new NotFoundException(
          `No se encontró la categoría con ID: ${nextCategoriaId}`,
        );
      }
    }

    if (nextUbicacionId !== undefined && nextUbicacionId !== existing.ubicacionId) {
      if (nextUbicacionId) {
        const ubicacion = await this.prisma.ubicacion.findUnique({
          where: { id: nextUbicacionId },
        });

        if (!ubicacion) {
          throw new NotFoundException(
            `No se encontró la ubicación con ID: ${nextUbicacionId}`,
          );
        }
      }
    }

    if (nextAreaActualId !== undefined && nextAreaActualId !== existing.areaActualId) {
      if (nextAreaActualId) {
        const area = await this.prisma.area.findUnique({
          where: { id: nextAreaActualId },
        });

        if (!area) {
          throw new NotFoundException(
            `No se encontró el área con ID: ${nextAreaActualId}`,
          );
        }
      }
    }

    if (
      nextResponsableActualId !== undefined &&
      nextResponsableActualId !== existing.responsableActualId
    ) {
      if (nextResponsableActualId) {
        const responsable = await this.prisma.usuario.findUnique({
          where: { id: nextResponsableActualId },
          select: { id: true },
        });

        if (!responsable) {
          throw new NotFoundException(
            `No se encontró el usuario con ID: ${nextResponsableActualId}`,
          );
        }
      }
    }

    const finalAreaActualId =
      nextAreaActualId !== undefined ? nextAreaActualId : existing.areaActualId;
    const finalResponsableActualId =
      nextResponsableActualId !== undefined
        ? nextResponsableActualId
        : existing.responsableActualId;
    const finalUbicacionId =
      nextUbicacionId !== undefined ? nextUbicacionId : existing.ubicacionId;

    const describeChange = (
      label: string,
      previousValue: string | null,
      nextValue: string | null,
    ) =>
      `${label}: ${previousValue ?? 'sin asignar'} -> ${nextValue ?? 'sin asignar'}`;

    const activo = await this.prisma.$transaction(async (tx) => {
      const updatedAsset = await tx.activo.update({
        where: { id },
        data: {
          ...(dto.codigo !== undefined && { codigo: nextCodigo }),
          ...(dto.nombre !== undefined && { nombre: nextNombre }),
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
          ...(dto.categoriaId !== undefined && { categoriaId: nextCategoriaId }),
          ...(dto.ubicacionId !== undefined && { ubicacionId: nextUbicacionId }),
          ...(dto.areaActualId !== undefined && {
            areaActualId: nextAreaActualId,
          }),
          ...(dto.responsableActualId !== undefined && {
            responsableActualId: nextResponsableActualId,
          }),
          actualizadoPorId: userId,
        },
        include: {
          categoria: true,
          ubicacion: true,
          areaActual: true,
        },
      });

      if (isTransferUpdate) {
        const detailParts: string[] = [];

        if (nextUbicacionId !== undefined && nextUbicacionId !== existing.ubicacionId) {
          detailParts.push(
            describeChange('Ubicación', existing.ubicacionId, finalUbicacionId),
          );
        }

        if (nextAreaActualId !== undefined && nextAreaActualId !== existing.areaActualId) {
          detailParts.push(
            describeChange('Área', existing.areaActualId, finalAreaActualId),
          );
        }

        if (
          nextResponsableActualId !== undefined &&
          nextResponsableActualId !== existing.responsableActualId
        ) {
          detailParts.push(
            describeChange(
              'Asignado a',
              existing.responsableActualId,
              finalResponsableActualId,
            ),
          );
        }

        await tx.movimientoActivo.create({
          data: {
            activoId: id,
            tipo: TipoMovimientoActivo.TRANSFERENCIA,
            areaOrigenId: existing.areaActualId,
            areaDestinoId: finalAreaActualId,
            usuarioOrigenId: existing.responsableActualId,
            usuarioDestinoId: finalResponsableActualId,
            realizadoPorId: userId,
            detalle: detailParts.join(' | '),
          },
        });
      }

      return updatedAsset;
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

  async transfer(id: string, dto: TransferAssetDto, userId: string) {
    const areaDestinoId = dto.areaDestinoId.trim();
    const observaciones = dto.observaciones?.trim() || undefined;

    const existing = await this.prisma.activo.findUnique({
      where: { id },
      select: {
        id: true,
        codigo: true,
        nombre: true,
        estado: true,
        areaActualId: true,
        responsableActualId: true,
        areaActual: {
          select: {
            id: true,
            nombre: true,
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException(`No se encontró el activo con ID: ${id}`);
    }

    if (existing.estado !== EstadoActivo.OPERATIVO) {
      throw new ConflictException(
        'Solo se puede transferir un activo cuando está en estado Operativo',
      );
    }

    if (!existing.areaActualId || !existing.areaActual) {
      throw new BadRequestException(
        'El activo debe tener un área de origen registrada antes de transferirse',
      );
    }

    const areaOrigen = existing.areaActual;

    if (areaDestinoId === existing.areaActualId) {
      throw new BadRequestException(
        'El área de destino debe ser distinta del área de origen',
      );
    }

    const [areaDestino, pendingReception] = await Promise.all([
      this.prisma.area.findUnique({
        where: { id: areaDestinoId },
        select: {
          id: true,
          nombre: true,
        },
      }),
      this.prisma.asignacionActivo.findFirst({
        where: {
          activoId: id,
          estado: EstadoAsignacion.PENDIENTE,
          movimientos: {
            some: {
              tipo: TipoMovimientoActivo.TRANSFERENCIA,
            },
          },
        },
        select: {
          id: true,
        },
      }),
    ]);

    if (!areaDestino) {
      throw new NotFoundException(
        `No se encontró el área con ID: ${areaDestinoId}`,
      );
    }

    if (pendingReception) {
      throw new ConflictException(
        'El activo tiene una recepción pendiente y no puede transferirse nuevamente',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const recepcionPendiente = await tx.asignacionActivo.create({
        data: {
          activoId: id,
          areaAsignadaId: areaDestino.id,
          asignadoPorId: userId,
          estado: EstadoAsignacion.PENDIENTE,
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
          tipo: TipoMovimientoActivo.TRANSFERENCIA,
          areaOrigenId: existing.areaActualId,
          areaDestinoId: areaDestino.id,
          usuarioOrigenId: existing.responsableActualId,
          realizadoPorId: userId,
          asignacionId: recepcionPendiente.id,
          detalle:
            observaciones ??
            `Transferencia registrada de ${areaOrigen.nombre} a ${areaDestino.nombre}`,
        },
      });

      await tx.activo.update({
        where: { id },
        data: {
          areaActualId: areaDestino.id,
          responsableActualId: null,
          actualizadoPorId: userId,
        },
      });

      return recepcionPendiente;
    });

    const asset = await this.findOne(id);

    return {
      message: `Transferencia registrada de ${areaOrigen.nombre} a ${areaDestino.nombre}. La recepción quedó pendiente para el área de destino.`,
      transferencia: {
        id: result.id,
        estado: result.estado,
        asignadoEn: result.asignadoEn,
        observaciones: result.observaciones,
        areaOrigen,
        areaDestino,
        registradoPorId: userId,
      },
      asset,
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

  async createFakeBulk(userId: string, count: number): Promise<number> {
    const safeCount = Number.isFinite(count) ? Math.trunc(count) : 0;

    if (safeCount <= 0) {
      throw new BadRequestException(
        'La cantidad de activos ficticios debe ser mayor a 0',
      );
    }

    if (safeCount > 5000) {
      throw new BadRequestException(
        'Por seguridad, la carga rápida permite como máximo 5000 activos por vez',
      );
    }

    const [categorias, ubicaciones] = await Promise.all([
      this.prisma.categoriaActivo.findMany({
        select: { id: true, nombre: true },
        take: 10,
        orderBy: { creadoEn: 'asc' },
      }),
      this.prisma.ubicacion.findMany({
        select: { id: true, nombre: true },
        take: 10,
        orderBy: { creadoEn: 'asc' },
      }),
    ]);

    if (categorias.length === 0) {
      throw new BadRequestException(
        'No hay categorías registradas para generar activos demo',
      );
    }

    if (ubicaciones.length === 0) {
      throw new BadRequestException(
        'No hay ubicaciones registradas para generar activos demo',
      );
    }

    const batchId = Date.now().toString(36).toUpperCase();
    const estadosDemo = [
      EstadoActivo.OPERATIVO,
      EstadoActivo.OPERATIVO,
      EstadoActivo.OPERATIVO,
      EstadoActivo.MANTENIMIENTO,
      EstadoActivo.FUERA_DE_SERVICIO,
      EstadoActivo.DADO_DE_BAJA,
    ];
    const data: Prisma.ActivoCreateManyInput[] = Array.from(
      { length: safeCount },
      (_, index) => {
        const categoria = categorias[index % categorias.length];
        const ubicacion = ubicaciones[index % ubicaciones.length];
        const sequence = String(index + 1).padStart(4, '0');
        const estado = estadosDemo[index % estadosDemo.length];

        return {
          codigo: `DEMO-${batchId}-${sequence}`,
          nombre: `Activo Demo ${sequence}`,
          descripcion: `Registro ficticio generado automáticamente para pruebas de filtrado (${categoria.nombre}, ${estado}).`,
          marca: 'DemoTech',
          modelo: `Serie ${((index % 12) + 1).toString().padStart(2, '0')}`,
          categoriaId: categoria.id,
          ubicacionId: ubicacion.id,
          estado,
          creadoPorId: userId,
          actualizadoPorId: userId,
        };
      },
    );

    const result = await this.prisma.activo.createMany({
      data,
    });

    return result.count;
  }

  async deleteFakeBulk(): Promise<number> {
    const fakeAssets = await this.prisma.activo.findMany({
      where: {
        codigo: {
          startsWith: 'DEMO-',
        },
      },
      select: { id: true },
    });

    if (fakeAssets.length === 0) {
      return 0;
    }

    const fakeAssetIds = fakeAssets.map((asset) => asset.id);

    await this.prisma.$transaction(async (tx) => {
      await tx.asignacionActivo.deleteMany({
        where: {
          activoId: { in: fakeAssetIds },
        },
      });

      await tx.movimientoActivo.deleteMany({
        where: {
          activoId: { in: fakeAssetIds },
        },
      });

      await tx.incidenteActivo.deleteMany({
        where: {
          activoId: { in: fakeAssetIds },
        },
      });

      await tx.documentoActivo.deleteMany({
        where: {
          activoId: { in: fakeAssetIds },
        },
      });

      await tx.activo.deleteMany({
        where: {
          id: { in: fakeAssetIds },
        },
      });
    });

    return fakeAssetIds.length;
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
