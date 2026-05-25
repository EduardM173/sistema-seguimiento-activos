import { Injectable, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import { PrismaService } from '../common/prisma.service';
import { CreateMaterialDto } from './dto/create-material.dto';

@Injectable()
export class MaterialsService {
  constructor(private prisma: PrismaService) {}

  async create(createMaterialDto: CreateMaterialDto) {
    return this.prisma.material.create({
      data: {
        codigo: createMaterialDto.codigo,
        nombre: createMaterialDto.nombre,
        descripcion: createMaterialDto.descripcion,
        unidad: createMaterialDto.unidad,
        stockActual: createMaterialDto.stockActual,
        stockMinimo: createMaterialDto.stockMinimo,
        categoriaId: createMaterialDto.categoriaId,
      },
    });
  }

  async findAll() {
    return this.prisma.material.findMany({
      include: {
        categoria: true,
      },
    });
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
