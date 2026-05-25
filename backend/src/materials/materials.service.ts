import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import { PrismaService } from '../common/prisma.service';
import { AgentSyncService } from '../agent-sync/agent-sync.service';
import { CreateMaterialDto } from './dto/create-material.dto';

export interface SearchMaterialsQuery {
  q?: string;
  categoriaId?: string;
  sortBy?: string;
  sortType?: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class MaterialsService {
  private readonly logger = new Logger(MaterialsService.name);

  constructor(
    private prisma: PrismaService,
    private readonly agentSync: AgentSyncService,
  ) {}

  async create(createMaterialDto: CreateMaterialDto) {
    const material = await this.prisma.material.create({
      data: {
        codigo: createMaterialDto.codigo,
        nombre: createMaterialDto.nombre,
        descripcion: createMaterialDto.descripcion,
        unidad: createMaterialDto.unidad,
        stockActual: createMaterialDto.stockActual,
        stockMinimo: createMaterialDto.stockMinimo,
        categoriaId: createMaterialDto.categoriaId,
      },
      include: { categoria: true },
    });

    // Fire-and-forget sync to Neo4j
    this.buildAndSyncMaterial(material.id);

    return material;
  }

  async findAll(query?: SearchMaterialsQuery) {
    const { q, categoriaId, sortBy, sortType, page = 1, pageSize = 20 } = query ?? {};

    // Delegate to agent-service for semantic search
    const agentParams: Record<string, unknown> = {
      page, pageSize,
      ...(q && { q }),
      ...(categoriaId && { categoriaId }),
      ...(sortBy && { sortBy }),
      ...(sortType && { sortType }),
    };

    const agentResult = await this.agentSync.searchMaterials(agentParams);
    if (agentResult) {
      return agentResult;
    }

    this.logger.warn('[findAll] Agent unavailable, falling back to Postgres');

    // Postgres fallback
    const where = categoriaId ? { categoriaId } : {};
    const [data, total] = await Promise.all([
      this.prisma.material.findMany({
        where,
        include: { categoria: true },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: sortBy ? { [sortBy]: (sortType ?? 'desc').toLowerCase() } : { creadoEn: 'desc' },
      }),
      this.prisma.material.count({ where }),
    ]);
    return { data, total, page, pageSize };
  }

  private buildAndSyncMaterial(materialId: string): void {
    this.prisma.material
      .findUnique({
        where: { id: materialId },
        include: { categoria: true },
      })
      .then((m) => {
        if (!m) return;
        this.agentSync.syncMaterial({
          id: m.id,
          codigo: m.codigo,
          nombre: m.nombre,
          descripcion: m.descripcion ?? undefined,
          unidad: m.unidad ?? undefined,
          stockActual: m.stockActual != null ? Number(m.stockActual) : undefined,
          stockMinimo: m.stockMinimo != null ? Number(m.stockMinimo) : undefined,
          categoriaId: m.categoriaId ?? undefined,
          categoriaNombre: m.categoria?.nombre ?? undefined,
          creadoEn: m.creadoEn?.toISOString() ?? undefined,
          actualizadoEn: m.actualizadoEn?.toISOString() ?? undefined,
        });
      })
      .catch((err) =>
        this.logger.warn('[Sync] Failed to fetch material for Neo4j sync (%s): %s', materialId, err?.message),
      );
  }

  async findOne(id: string) {
    return this.prisma.material.findUnique({
      where: { id },
      include: {
        categoria: true,
      },
    });
  }

  // ── Imágenes ────────────────────────────────────────────────────────────

  async addImages(materialId: string, files: Express.Multer.File[]) {
    const material = await this.prisma.material.findUnique({ where: { id: materialId } });
    if (!material) throw new NotFoundException('Material no encontrado');

    const created = await this.prisma.$transaction(
      files.map((f) =>
        this.prisma.imagenMaterial.create({
          data: {
            materialId,
            nombreArchivo: f.filename,
            nombreOriginal: f.originalname,
            tipoMime: f.mimetype,
            tamano: f.size,
            ruta: f.path,
          },
        }),
      ),
    );

    return created.map((img) => this.serializeImagen(img));
  }

  async listImages(materialId: string) {
    const material = await this.prisma.material.findUnique({ where: { id: materialId } });
    if (!material) throw new NotFoundException('Material no encontrado');

    const imagenes = await this.prisma.imagenMaterial.findMany({
      where: { materialId },
      orderBy: { creadoEn: 'asc' },
    });
    return imagenes.map((img) => this.serializeImagen(img));
  }

  async deleteImage(materialId: string, imageId: string) {
    const imagen = await this.prisma.imagenMaterial.findFirst({
      where: { id: imageId, materialId },
    });
    if (!imagen) throw new NotFoundException('Imagen no encontrada');

    await this.prisma.imagenMaterial.delete({ where: { id: imageId } });

    if (fs.existsSync(imagen.ruta)) {
      fs.unlinkSync(imagen.ruta);
    }
  }

  private serializeImagen(img: {
    id: string;
    materialId: string;
    nombreArchivo: string;
    nombreOriginal: string;
    tipoMime: string;
    tamano: number;
    ruta: string;
    creadoEn: Date;
  }) {
    return {
      id: img.id,
      materialId: img.materialId,
      nombreOriginal: img.nombreOriginal,
      tipoMime: img.tipoMime,
      tamano: img.tamano,
      url: `/uploads/materiales/${img.materialId}/${img.nombreArchivo}`,
      creadoEn: img.creadoEn,
    };
  }
}
