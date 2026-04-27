import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../common/prisma.service';
import { SearchLocationsDto } from './dto/search-location.dto';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { CreateAreaDto } from './dto/create-area.dto';
import { ReassignAreaManagerDto } from './dto/reassign-area-manager.dto';
import { Prisma } from '../generated/prisma/client';

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeRoleName(roleName: string) {
    return roleName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[_\s]+/g, ' ')
      .trim()
      .toUpperCase();
  }

  private isAreaManagerRole(roleName?: string | null) {
    if (!roleName) return false;

    const normalized = this.normalizeRoleName(roleName);
    return (
      normalized === 'RESPONSABLE DE AREA' ||
      normalized === 'RESPONSABLE AREA'
    );
  }

  private async assertUserHasPermission(userId: string, permissionCode: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: userId },
      select: {
        rol: {
          select: {
            permisos: {
              select: {
                permiso: {
                  select: { codigo: true },
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
      throw new ForbiddenException('No tienes permisos para gestionar áreas');
    }
  }

  /**
   * Paginated list with optional string-similarity search on nombre.
   */
  async findAll(query: SearchLocationsDto) {
    const { page, pageSize, pattern, edificio, piso, ambiente } = query;
    const skip = (page - 1) * pageSize;

    // When a pattern is provided, fetch all ubicaciones and rank by similarity
    if (pattern && pattern.trim()) {
      return this.findBySimilarity(pattern.trim(), { edificio, piso, ambiente, page, pageSize });
    }

    const where: Prisma.UbicacionWhereInput = {};

    if (edificio) {
      where.edificio = { contains: edificio, mode: 'insensitive' };
    }
    if (piso) {
      where.piso = { contains: piso, mode: 'insensitive' };
    }
    if (ambiente) {
      where.ambiente = { contains: ambiente, mode: 'insensitive' };
    }

    const [ubicaciones, total] = await Promise.all([
      this.prisma.ubicacion.findMany({
        where,
        orderBy: { creadoEn: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.ubicacion.count({ where }),
    ]);

    return { data: ubicaciones, total, page, pageSize };
  }

  /**
   * Get a single location.
   */
  async findOne(id: string) {
    const ubicacion = await this.prisma.ubicacion.findUnique({
      where: { id },
      include: {
        _count: {
          select: { activos: true, areas: true },
        },
      },
    });

    if (!ubicacion) {
      throw new NotFoundException(`No se encontró la ubicación con ID: ${id}`);
    }

    return ubicacion;
  }

  async findAllAreas(userId: string) {
    await this.assertUserHasPermission(userId, 'AREA_MANAGE');

    return this.prisma.area.findMany({
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        ubicacion: {
          select: {
            id: true,
            nombre: true,
            edificio: true,
            piso: true,
            ambiente: true,
          },
        },
        encargado: {
          select: {
            id: true,
            nombres: true,
            apellidos: true,
            correo: true,
            rol: { select: { nombre: true } },
          },
        },
        _count: {
          select: { usuarios: true, activos: true },
        },
      },
      orderBy: { nombre: 'asc' },
    });
  }

  async findAreaResponsibles(userId: string) {
    await this.assertUserHasPermission(userId, 'AREA_MANAGE');

    const usuarios = await this.prisma.usuario.findMany({
      where: { estado: 'ACTIVO' },
      select: {
        id: true,
        nombres: true,
        apellidos: true,
        correo: true,
        rol: { select: { nombre: true } },
        area: { select: { id: true, nombre: true } },
      },
      orderBy: [{ apellidos: 'asc' }, { nombres: 'asc' }],
    });

    return usuarios
      .filter((usuario) => this.isAreaManagerRole(usuario.rol.nombre))
      .map((usuario) => ({
        id: usuario.id,
        nombres: usuario.nombres,
        apellidos: usuario.apellidos,
        nombreCompleto: `${usuario.nombres} ${usuario.apellidos}`.trim(),
        correo: usuario.correo,
        rol: usuario.rol,
        area: usuario.area,
      }));
  }

  async createArea(dto: CreateAreaDto, userId: string) {
    await this.assertUserHasPermission(userId, 'AREA_MANAGE');

    const nombre = dto.nombre.trim();
    const descripcion = dto.descripcion?.trim() || null;
    const ubicacionId = dto.ubicacionId?.trim() || null;
    const encargadoId = dto.encargadoId?.trim() || null;

    if (!nombre) {
      throw new BadRequestException('El nombre del área es obligatorio');
    }

    const existing = await this.prisma.area.findUnique({
      where: { nombre },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('Ya existe un área con ese nombre');
    }

    if (ubicacionId) {
      const ubicacion = await this.prisma.ubicacion.findUnique({
        where: { id: ubicacionId },
        select: { id: true },
      });

      if (!ubicacion) {
        throw new NotFoundException(
          `No se encontró la ubicación con ID: ${ubicacionId}`,
        );
      }
    }

    if (encargadoId) {
      const encargado = await this.prisma.usuario.findUnique({
        where: { id: encargadoId },
        select: {
          id: true,
          estado: true,
          rol: { select: { nombre: true } },
        },
      });

      if (!encargado) {
        throw new NotFoundException(
          `No se encontró el usuario con ID: ${encargadoId}`,
        );
      }

      if (encargado.estado !== 'ACTIVO' || !this.isAreaManagerRole(encargado.rol.nombre)) {
        throw new BadRequestException(
          'Solo se puede asignar como responsable a un usuario con rol Responsable de Área',
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const area = await tx.area.create({
        data: {
          nombre,
          descripcion,
          ubicacionId,
          encargadoId,
        },
        select: {
          id: true,
          nombre: true,
          descripcion: true,
          ubicacion: {
            select: {
              id: true,
              nombre: true,
              edificio: true,
              piso: true,
              ambiente: true,
            },
          },
          encargado: {
            select: {
              id: true,
              nombres: true,
              apellidos: true,
              correo: true,
              rol: { select: { nombre: true } },
            },
          },
          _count: {
            select: { usuarios: true, activos: true },
          },
        },
      });

      if (encargadoId) {
        await tx.area.updateMany({
          where: {
            encargadoId,
            id: { not: area.id },
          },
          data: { encargadoId: null },
        });

        await tx.usuario.update({
          where: { id: encargadoId },
          data: { areaId: area.id },
        });
      }

      return area;
    });
  }

  async reassignAreaManager(
    areaId: string,
    dto: ReassignAreaManagerDto,
    userId: string,
  ) {
    await this.assertUserHasPermission(userId, 'AREA_MANAGE');

    const encargadoId = dto.encargadoId?.trim() || null;

    const existingArea = await this.prisma.area.findUnique({
      where: { id: areaId },
      select: {
        id: true,
        encargadoId: true,
      },
    });

    if (!existingArea) {
      throw new NotFoundException(`No se encontró el área con ID: ${areaId}`);
    }

    if (encargadoId) {
      const encargado = await this.prisma.usuario.findUnique({
        where: { id: encargadoId },
        select: {
          id: true,
          estado: true,
          rol: { select: { nombre: true } },
        },
      });

      if (!encargado) {
        throw new NotFoundException(
          `No se encontró el usuario con ID: ${encargadoId}`,
        );
      }

      if (
        encargado.estado !== 'ACTIVO' ||
        !this.isAreaManagerRole(encargado.rol.nombre)
      ) {
        throw new BadRequestException(
          'Solo se puede asignar como responsable a un usuario con rol Responsable de Área',
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedArea = await tx.area.update({
        where: { id: areaId },
        data: { encargadoId },
        select: {
          id: true,
          nombre: true,
          descripcion: true,
          ubicacion: {
            select: {
              id: true,
              nombre: true,
              edificio: true,
              piso: true,
              ambiente: true,
            },
          },
          encargado: {
            select: {
              id: true,
              nombres: true,
              apellidos: true,
              correo: true,
              rol: { select: { nombre: true } },
            },
          },
          _count: {
            select: { usuarios: true, activos: true },
          },
        },
      });

      if (existingArea.encargadoId && existingArea.encargadoId !== encargadoId) {
        await tx.usuario.updateMany({
          where: {
            id: existingArea.encargadoId,
            areaId,
          },
          data: { areaId: null },
        });
      }

      if (encargadoId) {
        await tx.area.updateMany({
          where: {
            encargadoId,
            id: { not: areaId },
          },
          data: { encargadoId: null },
        });

        await tx.usuario.update({
          where: { id: encargadoId },
          data: { areaId },
        });
      }

      return updatedArea;
    });
  }

  /**
   * Create a new location.
   */
  async create(dto: CreateLocationDto) {
    // Check uniqueness on the composite key
    const existing = await this.prisma.ubicacion.findFirst({
      where: {
        nombre: dto.nombre,
        edificio: dto.edificio ?? null,
        piso: dto.piso ?? null,
        ambiente: dto.ambiente ?? null,
      },
    });

    if (existing) {
      throw new ConflictException(
        'Ya existe una ubicación con la misma combinación de nombre, edificio, piso y ambiente',
      );
    }

    return this.prisma.ubicacion.create({
      data: {
        nombre: dto.nombre!,
        edificio: dto.edificio,
        piso: dto.piso,
        ambiente: dto.ambiente,
        descripcion: dto.descripcion,
      },
    });
  }

  /**
   * Update an existing location.
   */
  async update(id: string, dto: UpdateLocationDto) {
    const existing = await this.prisma.ubicacion.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException(`No se encontró la ubicación con ID: ${id}`);
    }

    // Check composite uniqueness if relevant fields are changing
    const finalNombre = dto.nombre ?? existing.nombre;
    const finalEdificio = dto.edificio !== undefined ? dto.edificio : existing.edificio;
    const finalPiso = dto.piso !== undefined ? dto.piso : existing.piso;
    const finalAmbiente = dto.ambiente !== undefined ? dto.ambiente : existing.ambiente;

    const duplicate = await this.prisma.ubicacion.findFirst({
      where: {
        nombre: finalNombre,
        edificio: finalEdificio ?? null,
        piso: finalPiso ?? null,
        ambiente: finalAmbiente ?? null,
        id: { not: id },
      },
    });

    if (duplicate) {
      throw new ConflictException(
        'Ya existe otra ubicación con la misma combinación de nombre, edificio, piso y ambiente',
      );
    }

    return this.prisma.ubicacion.update({
      where: { id },
      data: {
        ...(dto.nombre !== undefined && { nombre: dto.nombre }),
        ...(dto.edificio !== undefined && { edificio: dto.edificio }),
        ...(dto.piso !== undefined && { piso: dto.piso }),
        ...(dto.ambiente !== undefined && { ambiente: dto.ambiente }),
        ...(dto.descripcion !== undefined && { descripcion: dto.descripcion }),
      },
    });
  }

  /**
   * Delete a location. Prevents deletion if it has associated assets or areas.
   */
  async remove(id: string) {
    const existing = await this.prisma.ubicacion.findUnique({
      where: { id },
      include: {
        _count: {
          select: { activos: true, areas: true },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException(`No se encontró la ubicación con ID: ${id}`);
    }

    if (existing._count.activos > 0) {
      throw new ConflictException(
        `No se puede eliminar la ubicación porque tiene ${existing._count.activos} activo(s) asociado(s)`,
      );
    }

    if (existing._count.areas > 0) {
      throw new ConflictException(
        `No se puede eliminar la ubicación porque tiene ${existing._count.areas} área(s) asociada(s)`,
      );
    }

    return this.prisma.ubicacion.delete({ where: { id } });
  }

  /**
   * String-similarity search: compares pattern against ubicacion.nombre
   * using bigram (Dice coefficient) similarity.
   */
  private async findBySimilarity(
    pattern: string,
    opts: { edificio?: string; piso?: string; ambiente?: string; page: number; pageSize: number },
  ) {
    const where: Prisma.UbicacionWhereInput = {};

    if (opts.edificio) {
      where.edificio = { contains: opts.edificio, mode: 'insensitive' };
    }
    if (opts.piso) {
      where.piso = { contains: opts.piso, mode: 'insensitive' };
    }
    if (opts.ambiente) {
      where.ambiente = { contains: opts.ambiente, mode: 'insensitive' };
    }

    const allUbicaciones = await this.prisma.ubicacion.findMany({ where });

    // Score each location by similarity to the pattern
    const scored = allUbicaciones
      .map((ubi) => ({
        ...ubi,
        _similarity: this.diceSimilarity(pattern.toLowerCase(), ubi.nombre.toLowerCase()),
      }))
      .filter((ubi) => ubi._similarity > 0.1 || ubi.nombre.toLowerCase().includes(pattern.toLowerCase()))
      .sort((a, b) => b._similarity - a._similarity);

    const total = scored.length;
    const start = (opts.page - 1) * opts.pageSize;
    const data = scored.slice(start, start + opts.pageSize).map(({ _similarity, ...rest }) => rest);

    return { data, total, page: opts.page, pageSize: opts.pageSize };
  }

  /**
   * Dice coefficient (bigram similarity) between two strings.
   * Returns a value between 0 (no match) and 1 (identical).
   */
  private diceSimilarity(a: string, b: string): number {
    if (a === b) return 1;
    if (a.length < 2 || b.length < 2) return 0;

    const bigramsA = new Map<string, number>();
    for (let i = 0; i < a.length - 1; i++) {
      const bigram = a.substring(i, i + 2);
      bigramsA.set(bigram, (bigramsA.get(bigram) ?? 0) + 1);
    }

    let intersectionSize = 0;
    for (let i = 0; i < b.length - 1; i++) {
      const bigram = b.substring(i, i + 2);
      const count = bigramsA.get(bigram);
      if (count && count > 0) {
        bigramsA.set(bigram, count - 1);
        intersectionSize++;
      }
    }

    return (2.0 * intersectionSize) / (a.length - 1 + (b.length - 1));
  }
}
