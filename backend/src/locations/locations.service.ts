import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../common/prisma.service';
import { SearchLocationsDto } from './dto/search-location.dto';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { Prisma } from '../generated/prisma/client';

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

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
